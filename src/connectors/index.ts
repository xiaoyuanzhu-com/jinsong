import type { Connector } from './types.js';
import { connector as claudeCode } from './claude-code.js';
import { connector as json } from './json.js';
import { connector as cursor } from './cursor.js';
import { connector as chatgpt } from './chatgpt.js';
import { connector as langchain } from './langchain.js';
import { connector as openai } from './openai.js';

export type { Connector, ConnectorImportResult } from './types.js';

/**
 * All registered connectors, ordered by detection priority.
 * Claude Code is checked first (JSONL), then native JSON, then stubs.
 */
const connectors: Connector[] = [claudeCode, json, cursor, chatgpt, langchain, openai];

/**
 * Auto-detect which connector can handle the given path.
 * Returns the first match, or null if no connector recognizes the format.
 */
export function detectConnector(path: string): Connector | null {
  return connectors.find(c => c.detect(path)) ?? null;
}

/**
 * Look up a connector by name.
 */
export function getConnector(name: string): Connector | null {
  return connectors.find(c => c.name === name) ?? null;
}

/**
 * List all registered connector names.
 */
export function listConnectors(): string[] {
  return connectors.map(c => c.name);
}

/**
 * Return all registered connectors.
 */
export function getAllConnectors(): Connector[] {
  return connectors;
}
