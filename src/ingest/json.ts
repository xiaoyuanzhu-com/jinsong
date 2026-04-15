import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type { AgentEvent, EventType } from '../types.js';
import type { SQLiteStorage } from '../storage/sqlite.js';
import { computeMetrics } from '../compute/metrics.js';

const VALID_EVENT_TYPES: Set<string> = new Set<EventType>([
  'session_start',
  'prompt_submit',
  'first_token',
  'output_chunk',
  'tool_call_start',
  'tool_call_end',
  'retry_start',
  'retry_end',
  'user_input_requested',
  'user_input_received',
  'user_correction',
  'error',
  'task_complete',
  'user_cancel',
  'session_end',
]);

interface ImportResult {
  totalEvents: number;
  sessionsProcessed: number;
  errors: string[];
}

export function importJsonFile(filePath: string, storage: SQLiteStorage): ImportResult {
  const raw = readFileSync(filePath, 'utf-8');
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { totalEvents: 0, sessionsProcessed: 0, errors: ['Invalid JSON'] };
  }

  if (!Array.isArray(parsed)) {
    return { totalEvents: 0, sessionsProcessed: 0, errors: ['Expected a JSON array of events'] };
  }

  const errors: string[] = [];
  const events: AgentEvent[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    const validation = validateEvent(item, i);
    if (validation.error) {
      errors.push(validation.error);
      continue;
    }
    events.push(validation.event!);
  }

  if (events.length === 0) {
    return { totalEvents: 0, sessionsProcessed: 0, errors };
  }

  // Assign session_id if missing
  for (const event of events) {
    if (!event.session_id) {
      event.session_id = randomUUID();
    }
  }

  // Group by session_id
  const sessionMap = new Map<string, AgentEvent[]>();
  for (const event of events) {
    const group = sessionMap.get(event.session_id) ?? [];
    group.push(event);
    sessionMap.set(event.session_id, group);
  }

  // Store all events
  storage.writeEvents(events);

  // Process each session
  let sessionsProcessed = 0;
  for (const [, sessionEvents] of sessionMap) {
    // Sort by timestamp
    sessionEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    try {
      const { session, metrics } = computeMetrics(sessionEvents);
      storage.writeSession(session);
      storage.writeMetrics(metrics);
      sessionsProcessed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to compute session ${sessionEvents[0]?.session_id}: ${msg}`);
    }
  }

  return {
    totalEvents: events.length,
    sessionsProcessed,
    errors,
  };
}

function validateEvent(
  item: unknown,
  index: number
): { event?: AgentEvent; error?: string } {
  if (typeof item !== 'object' || item === null) {
    return { error: `Event ${index}: not an object` };
  }

  const obj = item as Record<string, unknown>;

  if (!obj.event_id || typeof obj.event_id !== 'string') {
    return { error: `Event ${index}: missing or invalid event_id` };
  }
  if (!obj.timestamp || typeof obj.timestamp !== 'string') {
    return { error: `Event ${index}: missing or invalid timestamp` };
  }
  if (!obj.event_type || typeof obj.event_type !== 'string' || !VALID_EVENT_TYPES.has(obj.event_type)) {
    return { error: `Event ${index}: missing or invalid event_type "${obj.event_type}"` };
  }
  if (!obj.payload || typeof obj.payload !== 'object') {
    return { error: `Event ${index}: missing or invalid payload` };
  }

  return {
    event: {
      event_id: obj.event_id as string,
      session_id: (obj.session_id as string) ?? '',
      timestamp: obj.timestamp as string,
      event_type: obj.event_type as EventType,
      payload: obj.payload as AgentEvent['payload'],
    },
  };
}
