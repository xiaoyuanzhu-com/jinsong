import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve as resolvePath, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SQLiteStorage } from '../storage/sqlite.js';
import { renderLiveUI } from './ui.js';

export interface ServerStatus {
  discovered: number;
  processed: number;
  skipped: number;
  errors: number;
  scanning: boolean;
  startedAt: string;
}

export interface LiveServer {
  url: string;
  close(): Promise<void>;
  broadcast(event: string, data: unknown): void;
  setStatus(patch: Partial<ServerStatus>): void;
}

interface Client {
  res: ServerResponse;
}

// --- Static UI (Vite build output) ---------------------------------------

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function mimeFor(filePath: string): string {
  const i = filePath.lastIndexOf('.');
  if (i < 0) return 'application/octet-stream';
  return MIME_TYPES[filePath.slice(i).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * Fallback classifier when a stored `tool_call_start` payload lacks the
 * `tool_category` field. Mirrors `inferToolCategory()` in
 * `src/connectors/claude-code.ts` — kept deliberately tiny so /api/sessions
 * stays free of connector imports.
 */
function inferToolCategoryFallback(name: string): string {
  const n = name.toLowerCase();
  if (n === 'bash' || n === 'execute') return 'execution';
  if (
    n === 'read' ||
    n === 'glob' ||
    n === 'grep' ||
    n === 'edit' ||
    n === 'write'
  ) {
    return 'file_system';
  }
  if (n === 'webfetch' || n === 'websearch') return 'browser';
  return 'other';
}

/**
 * Locate the Vite-built UI assets folder (`ui/dist/`). The server runs in two
 * layouts:
 *   - Source (tsx/ts-node, tests): <repo>/src/server/index.ts → <repo>/ui/dist
 *   - tsup bundle (cli.cjs):       <repo>/dist/cli.cjs        → <repo>/ui/dist
 * We probe a few candidate roots and return the first one that contains
 * `index.html`. Returns `null` when no built UI is present (we'll fall back to
 * the hand-rolled template in `ui.ts`).
 */
function findUiDist(): string | null {
  // __dirname isn't available in ESM; use import.meta.url when present,
  // otherwise fall back to process.cwd(). Both tsup (cjs) and tsx (esm) paths
  // are covered below.
  let here: string;
  try {
    here = fileURLToPath(import.meta.url);
  } catch {
    here = typeof __filename !== 'undefined' ? __filename : process.cwd();
  }

  const candidates = [
    // tsup bundle: <root>/dist/cli.cjs → ../ui/dist
    resolvePath(here, '..', '..', 'ui', 'dist'),
    // ts source: <root>/src/server/index.ts → ../../ui/dist
    resolvePath(here, '..', '..', '..', 'ui', 'dist'),
    // cwd fallback
    resolvePath(process.cwd(), 'ui', 'dist'),
  ];

  for (const c of candidates) {
    if (existsSync(join(c, 'index.html'))) return c;
  }
  return null;
}

async function tryServeStatic(
  distRoot: string,
  urlPath: string,
  res: ServerResponse,
): Promise<boolean> {
  // Strip query string + leading slash, default to index.html
  const clean = urlPath.split('?')[0].split('#')[0];
  const rel = clean === '/' ? 'index.html' : clean.replace(/^\/+/, '');

  // Prevent path traversal: resolve, then verify it stays under distRoot.
  const full = normalize(join(distRoot, rel));
  const rootWithSep = distRoot.endsWith(sep) ? distRoot : distRoot + sep;
  if (full !== distRoot && !full.startsWith(rootWithSep)) return false;

  try {
    const st = await stat(full);
    if (!st.isFile()) return false;
    const data = await readFile(full);
    res.writeHead(200, {
      'Content-Type': mimeFor(full),
      'Content-Length': data.length,
      // index.html: no-cache so deploys show up immediately.
      // Hashed assets under /assets/*: safe to cache aggressively.
      'Cache-Control': /\/assets\//.test(clean)
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

async function serveSpaFallback(
  distRoot: string,
  res: ServerResponse,
): Promise<boolean> {
  try {
    const data = await readFile(join(distRoot, 'index.html'));
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

// -------------------------------------------------------------------------

export async function startLiveServer(
  storage: SQLiteStorage,
  port: number,
): Promise<LiveServer> {
  const status: ServerStatus = {
    discovered: 0,
    processed: 0,
    skipped: 0,
    errors: 0,
    scanning: true,
    startedAt: new Date().toISOString(),
  };

  const clients: Client[] = [];

  function broadcast(event: string, data: unknown): void {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of clients) {
      try {
        c.res.write(payload);
      } catch {
        // client disconnected; will be cleaned up on 'close'
      }
    }
  }

  function json(res: ServerResponse, code: number, body: unknown): void {
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  }

  const uiDist = findUiDist();
  if (uiDist) {
    console.log(`  UI: serving built assets from ${uiDist}`);
  } else {
    console.log('  UI: using built-in template (ui/dist/ not found)');
  }

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/';
    const pathOnly = url.split('?')[0];

    // API: JSON sessions
    if (pathOnly === '/api/sessions') {
      try {
        const sessions = storage.querySessions();
        const metrics = storage.queryMetrics();
        const metricsBySession = new Map(metrics.map(m => [m.session_id, m]));

        // DASH-6: per-session tool-category counts for the Distributions donut.
        // Re-derive category from the stored tool_name if the payload didn't
        // already carry one (older rows, alternate connectors). One query,
        // one pass — O(events) total, bounded by the existing events table.
        const toolRows = storage.queryToolCallStartRows();
        const toolCategoryBySession = new Map<string, Record<string, number>>();
        for (const r of toolRows) {
          const cat = r.tool_category ?? inferToolCategoryFallback(r.tool_name);
          let bucket = toolCategoryBySession.get(r.session_id);
          if (!bucket) {
            bucket = {};
            toolCategoryBySession.set(r.session_id, bucket);
          }
          bucket[cat] = (bucket[cat] ?? 0) + 1;
        }

        const rows = sessions.map(s => ({
          session: s,
          metrics: metricsBySession.get(s.session_id) ?? null,
          tool_category_counts: toolCategoryBySession.get(s.session_id) ?? {},
        }));
        json(res, 200, { sessions: rows });
      } catch (err) {
        json(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    // API: status
    if (pathOnly === '/api/status') {
      json(res, 200, status);
      return;
    }

    // SSE stream
    if (pathOnly === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write(': connected\n\n');
      res.write(`event: status\ndata: ${JSON.stringify(status)}\n\n`);

      const client: Client = { res };
      clients.push(client);

      // Keep-alive ping every 25s
      const ping = setInterval(() => {
        try {
          res.write(': ping\n\n');
        } catch {
          /* ignore */
        }
      }, 25000);

      req.on('close', () => {
        clearInterval(ping);
        const i = clients.indexOf(client);
        if (i >= 0) clients.splice(i, 1);
      });
      return;
    }

    // /api/* and /raw/* that didn't match above → 404 JSON (don't SPA-fallback
    // into index.html — that would hide API bugs behind HTML).
    if (pathOnly.startsWith('/api/') || pathOnly.startsWith('/raw/')) {
      json(res, 404, { error: 'Not found' });
      return;
    }

    // Static UI: try to serve the requested path from ui/dist/
    if (uiDist) {
      if (await tryServeStatic(uiDist, pathOnly, res)) return;
      // SPA fallback: any non-asset, non-API route → index.html
      // (exclude obvious asset paths so missing /assets/foo.js returns 404)
      if (!pathOnly.startsWith('/assets/')) {
        if (await serveSpaFallback(uiDist, res)) return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    // Fallback: no built UI — serve the hand-rolled template at `/` only.
    if (pathOnly === '/' || pathOnly === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderLiveUI());
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const addr = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${addr.port}`;

  return {
    url,
    async close(): Promise<void> {
      for (const c of clients) {
        try {
          c.res.end();
        } catch {
          /* ignore */
        }
      }
      clients.length = 0;
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
    broadcast,
    setStatus(patch) {
      Object.assign(status, patch);
      broadcast('status', status);
    },
  };
}
