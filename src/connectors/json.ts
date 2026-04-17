import { readFileSync, existsSync, statSync } from 'node:fs';
import type { AgentEvent, EventType } from '../types.js';
import type { Connector } from './types.js';

const VALID_EVENT_TYPES: Set<string> = new Set<EventType>([
  'session_start', 'prompt_submit', 'first_token', 'output_chunk',
  'tool_call_start', 'tool_call_end', 'retry_start', 'retry_end',
  'user_input_requested', 'user_input_received', 'user_correction',
  'error', 'task_complete', 'user_cancel', 'session_end',
]);

/**
 * Detect if a file is a Jinsong-native JSON events file.
 * It must be a .json file containing an array of objects with event_type fields.
 */
function isJinsongJson(filePath: string): boolean {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return false;
    const first = parsed[0];
    return (
      typeof first === 'object' &&
      first !== null &&
      typeof first.event_type === 'string' &&
      VALID_EVENT_TYPES.has(first.event_type)
    );
  } catch {
    return false;
  }
}

export const connector: Connector = {
  name: 'json',

  detect(path: string): boolean {
    if (!existsSync(path)) return false;
    const stat = statSync(path);
    if (!stat.isFile()) return false;
    if (!path.endsWith('.json')) return false;
    return isJinsongJson(path);
  },

  convert(path: string): AgentEvent[][] {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    const events: AgentEvent[] = [];
    for (const item of parsed) {
      if (
        typeof item === 'object' &&
        item !== null &&
        typeof item.event_id === 'string' &&
        typeof item.timestamp === 'string' &&
        typeof item.event_type === 'string' &&
        VALID_EVENT_TYPES.has(item.event_type) &&
        typeof item.payload === 'object'
      ) {
        events.push({
          event_id: item.event_id,
          session_id: item.session_id ?? '',
          timestamp: item.timestamp,
          event_type: item.event_type as EventType,
          payload: item.payload,
        });
      }
    }

    if (events.length === 0) return [];

    // Group by session_id
    const sessionMap = new Map<string, AgentEvent[]>();
    for (const event of events) {
      const sid = event.session_id || 'default';
      const group = sessionMap.get(sid) ?? [];
      group.push(event);
      sessionMap.set(sid, group);
    }

    return Array.from(sessionMap.values());
  },
};
