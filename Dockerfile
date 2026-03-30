# =============================================================================
# truv-brain unified container
# Serves: React SPA + Express API routes + Scout FastAPI + LOS/POS Bot (reverse-proxied)
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build the React SPA
# ---------------------------------------------------------------------------
FROM node:20-slim AS frontend

WORKDIR /app

COPY package*.json ./
RUN npm ci

# Copy source needed for the Vite build
COPY src/ ./src/
COPY public/ ./public/
COPY outreach_intel/persona_analysis_results.json ./outreach_intel/
COPY index.html tsconfig*.json vite.config.ts postcss.config.js tailwind.config.js ./

ARG GIT_SHA=unknown
ENV GIT_SHA=${GIT_SHA}

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: Install Python dependencies (Scout + LOS/POS Bot)
# ---------------------------------------------------------------------------
FROM python:3.11-slim AS pydeps

COPY truv-scout/requirements.txt /tmp/scout-requirements.txt
COPY los-pos-bot/requirements.txt /tmp/lospos-requirements.txt
RUN pip install --no-cache-dir --target=/pydeps \
    -r /tmp/scout-requirements.txt \
    -r /tmp/lospos-requirements.txt

# ---------------------------------------------------------------------------
# Stage 3: Production runtime
# ---------------------------------------------------------------------------
FROM node:20-slim

# Install Python 3 runtime (no pip needed — deps are pre-built)
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-distutils && \
    rm -rf /var/lib/apt/lists/* && \
    ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

# Node production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# tsx is needed to run server.ts in production
RUN npx tsx --version > /dev/null 2>&1 || npm install tsx

# Built React SPA from stage 1
COPY --from=frontend /app/dist ./dist

# Python dependencies from stage 2
COPY --from=pydeps /pydeps /opt/pydeps

# Server + API routes
COPY server.ts ./
COPY api/ ./api/

# Scout application
COPY truv-scout/truv_scout/ ./truv-scout/truv_scout/

# LOS/POS Bot application
COPY los-pos-bot/los_pos_bot/ ./los-pos-bot/los_pos_bot/

# Shared Python package (imported by Scout)
COPY outreach_intel/ ./outreach_intel/

# Python can find pydeps + outreach_intel as a sibling package
ENV PYTHONPATH=/opt/pydeps:/app
ENV NODE_ENV=production
ENV PORT=8080

RUN useradd -m -u 1001 appuser \
    && chown -R appuser:appuser /app /opt/pydeps
USER appuser

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:8080/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["npx", "tsx", "server.ts"]
