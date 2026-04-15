import { writeFileSync } from 'node:fs';
import type { SQLiteStorage } from '../storage/sqlite.js';
import type { SessionFilters } from '../types.js';
import { renderReport } from './template.js';

export function generateReport(
  storage: SQLiteStorage,
  outputPath: string,
  filters?: SessionFilters,
): void {
  const sessions = storage.querySessions(filters);
  const metrics = storage.queryMetrics(filters);

  // Align metrics with sessions by session_id
  const metricsMap = new Map(metrics.map((m) => [m.session_id, m]));
  const alignedMetrics = sessions.map((s) => metricsMap.get(s.session_id)!).filter(Boolean);

  const html = renderReport(sessions, alignedMetrics);
  writeFileSync(outputPath, html, 'utf-8');
}
