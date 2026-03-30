/**
 * Unified server for truv-brain.
 *
 * Development: `npm run dev:local` runs this alongside Vite.
 * Production:  Serves the built React SPA from dist/ and all API routes.
 *
 * Reads env vars from .env and .env.local automatically via dotenv
 * (skipped when NODE_ENV=production — env vars come from App Runner).
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn, type ChildProcess } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// In dev, load .env files. In production, env vars are injected by App Runner.
if (!IS_PRODUCTION) {
  dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });
  dotenv.config({ path: path.resolve(__dirname, '.env.local'), override: true });
}

const app = express();
// App Runner injects PORT. Local dev uses API_PORT or 3001.
const PORT = process.env.PORT || process.env.API_PORT || 3001;

// CORS: in production restrict to known origins. In dev, allow Vite's port.
const ALLOWED_ORIGINS = IS_PRODUCTION
  ? ['https://brdytqha8f.us-east-1.awsapprunner.com']
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];
app.use(helmet());
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use(express.json({ limit: '10mb' }));

// ---------------------------------------------------------------------------
// Health check — App Runner pings this to verify the container is alive
// ---------------------------------------------------------------------------

let scoutHealthy = !IS_PRODUCTION; // In dev, Scout is external — assume healthy
let losPosHealthy = !IS_PRODUCTION; // In dev, LOS/POS bot is external — assume healthy

app.get('/health', (_req, res) => {
  if (IS_PRODUCTION && !scoutHealthy) {
    res.status(503).json({ status: 'degraded', scout: 'starting' });
    return;
  }
  res.json({ status: 'ok', scout: scoutHealthy ? 'ok' : 'down', losPos: losPosHealthy ? 'ok' : 'down' });
});

// ---------------------------------------------------------------------------
// Auto-discover and mount all api/*.ts handlers
// Supports:
//   - Nested directories (any depth)
//   - Vercel [param] segments → Express :param dynamic routes
//   - req.params merged into req.query so Vercel handlers can read them
//   - Static routes mounted before dynamic ones to avoid shadowing
// ---------------------------------------------------------------------------

const apiDir = path.resolve(__dirname, 'api');

/** Convert Vercel [param] filename segments to Express :param syntax */
function toExpressSegment(segment: string): string {
  return segment.replace(/\[([^\]]+)\]/g, ':$1');
}

function makeVercelAdapter(handler: Function) {
  return async (req: express.Request, res: express.Response) => {
    // Merge dynamic path params into req.query so Vercel handlers can read
    // them via req.query (e.g. const { id } = req.query).
    // req.query is a getter in Express, so use defineProperty to override it.
    Object.defineProperty(req, 'query', {
      value: { ...req.params, ...req.query },
      writable: true,
      configurable: true,
    });
    await handler(req, res);
  };
}

interface RouteEntry {
  expressPath: string;
  filePath: string;
  isDynamic: boolean; // true if any segment is a :param
}

function collectRoutes(dir: string, prefix: string): RouteEntry[] {
  const routes: RouteEntry[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const segment = toExpressSegment(entry.name);
      const isDynamic = entry.name.startsWith('[');
      const subRoutes = collectRoutes(fullPath, `${prefix}/${segment}`);
      // Mark all sub-routes as dynamic if the directory itself is dynamic
      if (isDynamic) subRoutes.forEach(r => { r.isDynamic = true; });
      routes.push(...subRoutes);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      const baseName = entry.name.replace(/\.ts$/, '');
      const segment = baseName === 'index' ? '' : toExpressSegment(baseName);
      const expressPath = segment ? `${prefix}/${segment}` : prefix;
      const isDynamic = baseName.startsWith('[');
      routes.push({ expressPath, filePath: fullPath, isDynamic });
    }
  }

  return routes;
}

// ---------------------------------------------------------------------------
// Scout reverse proxy (production only)
// Spawns uvicorn as a child process and proxies /scout/* → localhost:8001
// ---------------------------------------------------------------------------

let scoutProcess: ChildProcess | null = null;
const SCOUT_PORT = 8001;

async function startScout(): Promise<void> {
  if (!IS_PRODUCTION) return;

  const scoutDir = path.resolve(__dirname, 'truv-scout');
  if (!fs.existsSync(scoutDir)) {
    console.warn('[Scout] truv-scout/ directory not found — skipping Scout startup');
    return;
  }

  console.log(`[Scout] Starting uvicorn on port ${SCOUT_PORT}...`);

  scoutProcess = spawn('python3', [
    '-m', 'uvicorn',
    'truv_scout.app:app',
    '--host', '0.0.0.0',
    '--port', String(SCOUT_PORT),
  ], {
    cwd: scoutDir,
    env: {
      ...process.env,
      PYTHONPATH: [process.env.PYTHONPATH, path.resolve(__dirname)].filter(Boolean).join(':'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  scoutProcess.stdout?.on('data', (data: Buffer) => {
    process.stdout.write(`[Scout] ${data}`);
  });

  scoutProcess.stderr?.on('data', (data: Buffer) => {
    process.stderr.write(`[Scout] ${data}`);
  });

  scoutProcess.on('exit', (code) => {
    console.error(`[Scout] Process exited with code ${code}`);
    scoutHealthy = false;
  });

  // Wait for Scout to be ready (poll health endpoint)
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const resp = await fetch(`http://127.0.0.1:${SCOUT_PORT}/health`);
      if (resp.ok) {
        console.log('[Scout] Ready.');
        scoutHealthy = true;
        return;
      }
    } catch {
      // Not ready yet
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.error('[Scout] Failed to start within 30s — continuing without Scout');
  // Mark as healthy anyway so the main service passes health checks.
  // Scout endpoints will return 502 but the container itself is functional.
  scoutHealthy = true;
}

function setupScoutProxy() {
  if (!IS_PRODUCTION) return;

  // Proxy all /scout/* requests to the Scout FastAPI process
  app.all('/scout/{*path}', async (req, res) => {
    // Strip the /scout prefix to get the path for the Scout service
    const scoutPath = req.originalUrl.replace(/^\/scout\/?/, '');
    const targetUrl = `http://127.0.0.1:${SCOUT_PORT}/${scoutPath}`;

    try {
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') headers[key] = value;
      }
      delete headers['host'];

      const proxyRes = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
      });

      res.status(proxyRes.status);
      for (const [key, value] of proxyRes.headers.entries()) {
        if (key.toLowerCase() !== 'transfer-encoding') {
          res.setHeader(key, value);
        }
      }

      const body = await proxyRes.arrayBuffer();
      res.send(Buffer.from(body));
    } catch (err) {
      console.error(`[Scout Proxy] Error forwarding ${req.method} ${req.path}:`, err);
      res.status(502).json({ error: 'Scout service unavailable' });
    }
  });
}

// ---------------------------------------------------------------------------
// LOS/POS Bot reverse proxy (production only)
// Spawns uvicorn as a child process and proxies /los-pos/* → localhost:8002
// ---------------------------------------------------------------------------

let losPosProcess: ChildProcess | null = null;
const LOSPOS_PORT = 8002;

async function startLosPos(): Promise<void> {
  if (!IS_PRODUCTION) return;

  const losPosDir = path.resolve(__dirname, 'los-pos-bot');
  if (!fs.existsSync(losPosDir)) {
    console.warn('[LOS/POS] los-pos-bot/ directory not found — skipping LOS/POS bot startup');
    return;
  }

  console.log(`[LOS/POS] Starting uvicorn on port ${LOSPOS_PORT}...`);

  losPosProcess = spawn('python3', [
    '-m', 'uvicorn',
    'los_pos_bot.app:app',
    '--host', '0.0.0.0',
    '--port', String(LOSPOS_PORT),
  ], {
    cwd: losPosDir,
    env: {
      ...process.env,
      PYTHONPATH: [process.env.PYTHONPATH, path.resolve(__dirname)].filter(Boolean).join(':'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  losPosProcess.stdout?.on('data', (data: Buffer) => {
    process.stdout.write(`[LOS/POS] ${data}`);
  });

  losPosProcess.stderr?.on('data', (data: Buffer) => {
    process.stderr.write(`[LOS/POS] ${data}`);
  });

  losPosProcess.on('exit', (code) => {
    console.error(`[LOS/POS] Process exited with code ${code}`);
    losPosHealthy = false;
  });

  // Wait for LOS/POS bot to be ready (poll health endpoint)
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const resp = await fetch(`http://127.0.0.1:${LOSPOS_PORT}/health`);
      if (resp.ok) {
        console.log('[LOS/POS] Ready.');
        losPosHealthy = true;
        return;
      }
    } catch {
      // Not ready yet
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.error('[LOS/POS] Failed to start within 30s — continuing without LOS/POS bot');
  losPosHealthy = true;
}

const LOSPOS_WEBHOOK_SECRET = process.env.LOSPOS_WEBHOOK_SECRET;

function setupLosPosProxy() {
  if (!IS_PRODUCTION) return;

  // Proxy all /los-pos/* requests to the LOS/POS bot FastAPI process
  app.all('/los-pos/{*path}', async (req, res) => {
    const losPosPath = (req.params as Record<string, string>).path || '';
    const targetUrl = `http://127.0.0.1:${LOSPOS_PORT}/${losPosPath}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`;

    try {
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string') headers[key] = value;
      }
      delete headers['host'];
      // Inject internal auth token so FastAPI endpoints can verify the caller
      if (LOSPOS_WEBHOOK_SECRET) headers['x-scout-token'] = LOSPOS_WEBHOOK_SECRET;

      const proxyRes = await fetch(targetUrl, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
      });

      res.status(proxyRes.status);
      for (const [key, value] of proxyRes.headers.entries()) {
        if (key.toLowerCase() !== 'transfer-encoding') {
          res.setHeader(key, value);
        }
      }

      const body = await proxyRes.arrayBuffer();
      res.send(Buffer.from(body));
    } catch (err) {
      console.error(`[LOS/POS Proxy] Error forwarding ${req.method} ${req.path}:`, err);
      res.status(502).json({ error: 'LOS/POS bot service unavailable' });
    }
  });
}

// ---------------------------------------------------------------------------
// Boot sequence
// ---------------------------------------------------------------------------

async function mountRoutes() {
  const routes = collectRoutes(apiDir, '/api');

  // Mount static routes first so they are not shadowed by dynamic :param routes
  const staticRoutes = routes.filter(r => !r.isDynamic);
  const dynamicRoutes = routes.filter(r => r.isDynamic);

  for (const route of [...staticRoutes, ...dynamicRoutes]) {
    try {
      const mod = await import(route.filePath);
      if (mod.default) {
        app.all(route.expressPath, makeVercelAdapter(mod.default));
        console.log(`  ✓ ${route.expressPath}`);
      }
    } catch {
      // skip routes that fail to import (missing deps etc.)
    }
  }
}

async function boot() {
  // 1. Mount API routes
  await mountRoutes();

  // 2. Scout proxy (production only — in dev, Scout runs separately)
  setupScoutProxy();

  // 2b. LOS/POS bot proxy (production only)
  setupLosPosProxy();

  // 3. Static file serving (production only — in dev, Vite serves the SPA)
  if (IS_PRODUCTION) {
    const distDir = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distDir)) {
      // Serve presentations as static HTML (no SPA fallback)
      const presentationsDir = path.join(distDir, 'presentations');
      if (fs.existsSync(presentationsDir)) {
        app.use('/presentations', express.static(presentationsDir));
        console.log('[Static] Serving /presentations/ as standalone HTML');
      }

      app.use(express.static(distDir));
      // SPA fallback: any non-API, non-scout, non-presentations route serves index.html
      // Express 5 path-to-regexp v8: use {*path} for wildcards
      app.get('{*path}', (req, res) => {
        // Let express.static handle actual presentation HTML files,
        // but serve the SPA for /presentations/ itself (the index route)
        if (req.path.startsWith('/presentations/') && req.path !== '/presentations/') return;
        res.sendFile(path.join(distDir, 'index.html'));
      });
      console.log('[Static] Serving dist/ with SPA fallback');
    } else {
      console.warn('[Static] dist/ not found — run `npm run build` first');
    }
  }

  // 4. Start child processes (production only)
  await Promise.all([startScout(), startLosPos()]);

  // 5. Start listening
  const server = createServer(app);
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[API] ERROR: Port ${PORT} is already in use.`);
      console.error(`[API] Run this to free it:  lsof -ti:${PORT} | xargs kill -9\n`);
    } else {
      console.error('[API] Server error:', err);
    }
    process.exit(1);
  });

  server.listen(PORT, () => {
    console.log(`\n[Server] Running on port ${PORT} (${IS_PRODUCTION ? 'production' : 'development'})`);
    if (!IS_PRODUCTION) {
      console.log('Vite frontend should be at http://localhost:5173\n');
    }
  });

  // Graceful shutdown
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      console.log(`\n[Server] ${signal} received — shutting down...`);
      if (scoutProcess) {
        scoutProcess.kill('SIGTERM');
      }
      if (losPosProcess) {
        losPosProcess.kill('SIGTERM');
      }
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 5000);
    });
  }
}

boot();
