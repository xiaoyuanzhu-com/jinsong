import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { SQLiteStorage } from './storage/sqlite.js';
import { importJsonFile } from './ingest/json.js';
import { generateReport } from './report/generate.js';
import { detectConnector, getConnector, listConnectors } from './connectors/index.js';
import { computeMetrics } from './compute/metrics.js';
import type { AgentEvent } from './types.js';

function getDbPath(): string {
  // Check for .jinsong/ in cwd, else use ~/.jinsong/
  const localDir = join(process.cwd(), '.jinsong');
  if (existsSync(localDir)) {
    return join(localDir, 'data.db');
  }
  const homeDir = process.env.HOME ?? process.env.USERPROFILE ?? '.';
  const globalDir = join(homeDir, '.jinsong');
  if (!existsSync(globalDir)) {
    mkdirSync(globalDir, { recursive: true });
  }
  return join(globalDir, 'data.db');
}

function importWithConnector(
  filePath: string,
  format: string | undefined,
  storage: SQLiteStorage
): { totalEvents: number; sessionsProcessed: number; errors: string[] } {
  // If format is explicitly "json", use the legacy JSON importer
  if (format === 'json') {
    return importJsonFile(filePath, storage);
  }

  // Resolve connector: explicit format or auto-detect
  const connector = format
    ? getConnector(format)
    : detectConnector(filePath);

  if (!connector) {
    // Fall back to legacy JSON import for backward compatibility
    if (filePath.endsWith('.json')) {
      return importJsonFile(filePath, storage);
    }
    return {
      totalEvents: 0,
      sessionsProcessed: 0,
      errors: [`No connector found for: ${filePath}. Available connectors: ${listConnectors().join(', ')}`],
    };
  }

  console.log(`  Connector: ${connector.name}`);

  // Convert the file/directory to Jinsong events
  let sessionEventSets: AgentEvent[][];
  try {
    sessionEventSets = connector.convert(filePath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { totalEvents: 0, sessionsProcessed: 0, errors: [`Conversion failed: ${msg}`] };
  }

  if (sessionEventSets.length === 0) {
    return { totalEvents: 0, sessionsProcessed: 0, errors: ['No sessions found in the input'] };
  }

  const errors: string[] = [];
  let totalEvents = 0;
  let sessionsProcessed = 0;

  for (const events of sessionEventSets) {
    if (events.length === 0) continue;

    // Ensure all events have session_id
    for (const event of events) {
      if (!event.session_id) {
        event.session_id = randomUUID();
      }
    }

    // Sort by timestamp
    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    totalEvents += events.length;

    // Store events
    storage.writeEvents(events);

    // Compute and store session + metrics
    try {
      const { session, metrics } = computeMetrics(events);
      storage.writeSession(session);
      storage.writeMetrics(metrics);
      sessionsProcessed++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to compute session ${events[0]?.session_id}: ${msg}`);
    }
  }

  return { totalEvents, sessionsProcessed, errors };
}

const program = new Command();

program
  .name('jinsong')
  .description('Agent experience quality metrics')
  .version('0.1.0');

program
  .command('import')
  .description('Import telemetry from a file or directory (auto-detects format)')
  .argument('<path>', 'Path to file or directory to import')
  .option('--format <name>', 'Connector to use (claude-code, json, cursor, chatgpt, langchain, openai)')
  .option('--db <path>', 'SQLite database path')
  .action((inputPath: string, opts: { format?: string; db?: string }) => {
    const dbPath = opts.db ?? getDbPath();
    const filePath = resolve(inputPath);

    if (!existsSync(filePath)) {
      console.error(`Path not found: ${filePath}`);
      process.exit(1);
    }

    const storage = new SQLiteStorage(dbPath);
    try {
      console.log(`Importing ${filePath}...`);
      const result = importWithConnector(filePath, opts.format, storage);
      console.log(`  Events: ${result.totalEvents}`);
      console.log(`  Sessions: ${result.sessionsProcessed}`);
      if (result.errors.length > 0) {
        console.log(`  Errors: ${result.errors.length}`);
        for (const err of result.errors.slice(0, 10)) {
          console.log(`    - ${err}`);
        }
      }
      console.log(`  Database: ${dbPath}`);
    } finally {
      storage.close();
    }
  });

program
  .command('status')
  .description('Show summary of stored data')
  .option('--db <path>', 'SQLite database path')
  .action((opts: { db?: string }) => {
    const dbPath = opts.db ?? getDbPath();

    if (!existsSync(dbPath)) {
      console.log('No data found. Run `jinsong import <file>` first.');
      return;
    }

    const storage = new SQLiteStorage(dbPath);
    try {
      const sessionCount = storage.getSessionCount();
      const eventCount = storage.getEventCount();
      const dateRange = storage.getDateRange();

      console.log('Jinsong Status');
      console.log('──────────────');
      console.log(`  Sessions: ${sessionCount}`);
      console.log(`  Events:   ${eventCount}`);
      if (dateRange.earliest) {
        console.log(`  Earliest: ${dateRange.earliest.substring(0, 19)}`);
        console.log(`  Latest:   ${dateRange.latest?.substring(0, 19)}`);
      }
      console.log(`  Database: ${dbPath}`);
    } finally {
      storage.close();
    }
  });

program
  .command('report')
  .description('Generate HTML report')
  .option('--out <path>', 'Output file path', 'jinsong-report.html')
  .option('--db <path>', 'SQLite database path')
  .action((opts: { out: string; db?: string }) => {
    const dbPath = opts.db ?? getDbPath();
    const outputPath = resolve(opts.out);

    if (!existsSync(dbPath)) {
      console.error('No data found. Run `jinsong import <file>` first.');
      process.exit(1);
    }

    const storage = new SQLiteStorage(dbPath);
    try {
      console.log('Generating report...');
      generateReport(storage, outputPath);
      console.log(`  Report: ${outputPath}`);
    } finally {
      storage.close();
    }
  });

program.parse();
