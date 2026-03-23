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

// Load .env then .env.local (local overrides)
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '.env.local'), override: true });

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '10mb' }));

// ---------------------------------------------------------------------------
// Auto-discover and mount all api/*.ts handlers
// ---------------------------------------------------------------------------

const apiDir = path.resolve(__dirname, 'api');

function makeVercelAdapter(handler: Function) {
  return async (req: express.Request, res: express.Response) => {
    await handler(req, res);
  };
}

async function mountRoutes() {
  const entries = fs.readdirSync(apiDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      // Mount sub-directory routes: api/foo/bar.ts → /api/foo/bar
      const subDir = path.join(apiDir, entry.name);
      const subEntries = fs.readdirSync(subDir, { withFileTypes: true });
      for (const sub of subEntries) {
        if (!sub.isFile() || !sub.name.endsWith('.ts')) continue;
        const routeName = sub.name.replace(/\.ts$/, '');
        const routePath = `/api/${entry.name}/${routeName === 'index' ? '' : routeName}`;
        try {
          const mod = await import(path.join(subDir, sub.name));
          if (mod.default) {
            app.all(routePath, makeVercelAdapter(mod.default));
            console.log(`  ✓ /api/${entry.name}/${routeName}`);
          }
        } catch {
          // skip routes that fail to import (missing deps, etc.)
        }
      }
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      const routeName = entry.name.replace(/\.ts$/, '');
      const routePath = `/api/${routeName}`;
      try {
        const mod = await import(path.join(apiDir, entry.name));
        if (mod.default) {
          app.all(routePath, makeVercelAdapter(mod.default));
          console.log(`  ✓ /api/${routeName}`);
        }
      } catch {
        // skip
      }
    }
  }
}

mountRoutes().then(() => {
  createServer(app).listen(PORT, () => {
    console.log(`\nAPI server running at http://localhost:${PORT}`);
    console.log('Vite frontend should be at http://localhost:5173\n');
  });
});
