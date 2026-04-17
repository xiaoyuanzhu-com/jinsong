import { randomUUID } from 'node:crypto';
import type { SQLiteStorage } from './storage/sqlite.js';
import { getAllConnectors } from './connectors/index.js';
import { computeMetrics } from './compute/metrics.js';
import type { Connector } from './connectors/types.js';
import type { Session, SessionMetrics } from './types.js';

export interface DiscoveryJob {
  connectorName: string;
  path: string;
}

export interface ImportedSession {
  session: Session;
  metrics: SessionMetrics;
  connectorName: string;
  path: string;
}

export interface DiscoveryHooks {
  onDiscovered?: (jobs: DiscoveryJob[]) => void;
  onSessionImported?: (imported: ImportedSession) => void;
  onSessionSkipped?: (sessionId: string, reason: string) => void;
  onError?: (msg: string) => void;
  onComplete?: () => void;
}

/**
 * Walk every registered connector, call discover(), and ingest each new session.
 * Skips sessions whose session_id is already in storage. Yields to the event
 * loop between files so SSE/UI callers can stream progress.
 */
export async function discoverAndImport(
  storage: SQLiteStorage,
  hooks: DiscoveryHooks = {},
): Promise<void> {
  const connectors = getAllConnectors();

  // Collect all jobs first, so UI knows the total up-front
  const jobs: (DiscoveryJob & { connector: Connector })[] = [];
  for (const c of connectors) {
    let paths: string[] = [];
    try {
      paths = c.discover();
    } catch (err) {
      hooks.onError?.(`${c.name}.discover() failed: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    for (const p of paths) jobs.push({ connectorName: c.name, path: p, connector: c });
  }
  hooks.onDiscovered?.(jobs.map(j => ({ connectorName: j.connectorName, path: j.path })));

  const existing = new Set(storage.querySessions().map(s => s.session_id));

  for (const job of jobs) {
    try {
      const sessionSets = job.connector.convert(job.path);

      for (const events of sessionSets) {
        if (events.length === 0) continue;

        let sid = events[0].session_id;
        if (!sid) {
          sid = randomUUID();
          for (const e of events) if (!e.session_id) e.session_id = sid;
        }

        if (existing.has(sid)) {
          hooks.onSessionSkipped?.(sid, 'already in database');
          continue;
        }

        events.sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );

        storage.writeEvents(events);
        const { session, metrics } = computeMetrics(events);
        storage.writeSession(session);
        storage.writeMetrics(metrics);
        existing.add(sid);
        hooks.onSessionImported?.({
          session,
          metrics,
          connectorName: job.connectorName,
          path: job.path,
        });
      }
    } catch (err) {
      hooks.onError?.(`${job.path}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Yield to event loop so SSE broadcasts flush between jobs
    await new Promise<void>(resolve => setImmediate(resolve));
  }

  hooks.onComplete?.();
}
