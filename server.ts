/**
 * Local development server — serves /api/* routes using the same handlers
 * as the Vercel functions, so `npm run dev:local` works without Vercel CLI.
 *
 * Reads env vars from .env and .env.local automatically via dotenv.
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env then .env.local (local overrides).
// Use override: true on both so .env file values win over any stale shell env vars.
dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });
dotenv.config({ path: path.resolve(__dirname, '.env.local'), override: true });

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '10mb' }));

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

mountRoutes().then(() => {
  createServer(app).listen(PORT, () => {
    console.log(`\nAPI server running at http://localhost:${PORT}`);
    console.log('Vite frontend should be at http://localhost:5173\n');
  });
});
