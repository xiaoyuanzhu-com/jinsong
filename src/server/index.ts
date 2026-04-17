import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
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

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/';

    if (url === '/' || url === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderLiveUI());
      return;
    }

    if (url === '/api/sessions') {
      try {
        const sessions = storage.querySessions();
        const metrics = storage.queryMetrics();
        const metricsBySession = new Map(metrics.map(m => [m.session_id, m]));
        const rows = sessions.map(s => ({
          session: s,
          metrics: metricsBySession.get(s.session_id) ?? null,
        }));
        json(res, 200, { sessions: rows });
      } catch (err) {
        json(res, 500, { error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }

    if (url === '/api/status') {
      json(res, 200, status);
      return;
    }

    if (url === '/events') {
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
