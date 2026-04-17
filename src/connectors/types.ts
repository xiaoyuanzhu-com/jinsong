import type { AgentEvent } from '../types.js';

/**
 * A connector reads an external agent session format and converts it
 * to Jinsong's AgentEvent[] format.
 */
export interface Connector {
  /** Human-readable name, e.g. "claude-code" */
  name: string;

  /** Can this connector handle the given file or directory? */
  detect(path: string): boolean;

  /** Read the file/directory and return Jinsong events (one array per session). */
  convert(path: string): AgentEvent[][];
}

/**
 * Result of an import operation across one or more sessions.
 */
export interface ConnectorImportResult {
  totalEvents: number;
  sessionsProcessed: number;
  errors: string[];
}
