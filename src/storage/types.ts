import type { AgentEvent, Session, SessionMetrics, SessionFilters } from '../types.js';

export interface StorageAdapter {
  writeEvents(events: AgentEvent[]): void;
  writeSession(session: Session): void;
  writeMetrics(metrics: SessionMetrics): void;
  querySessions(filters?: SessionFilters): Session[];
  queryMetrics(filters?: SessionFilters): SessionMetrics[];
  queryEvents(sessionId: string): AgentEvent[];
  close(): void;
}
