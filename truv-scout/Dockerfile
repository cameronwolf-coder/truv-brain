FROM python:3.11-slim

WORKDIR /app

# Copy both packages — outreach_intel is a shared dependency imported by truv_scout
COPY outreach_intel/ ./outreach_intel/
COPY truv-scout/requirements.txt ./truv-scout/requirements.txt

RUN pip install --no-cache-dir -r truv-scout/requirements.txt

COPY truv-scout/truv_scout/ ./truv-scout/truv_scout/
COPY truv-scout/truv_scout/config/ ./truv-scout/truv_scout/config/

# Make outreach_intel importable as a sibling package
ENV PYTHONPATH=/app

WORKDIR /app/truv-scout

CMD ["sh", "-c", "uvicorn truv_scout.app:app --host 0.0.0.0 --port ${PORT:-8000}"]
