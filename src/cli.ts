import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { SQLiteStorage } from './storage/sqlite.js';
import { importJsonFile } from './ingest/json.js';
import { generateReport } from './report/generate.js';

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

const program = new Command();

program
  .name('jinsong')
  .description('Agent experience quality metrics')
  .version('0.1.0');

program
  .command('import')
  .description('Import JSON telemetry file')
  .argument('<file>', 'Path to JSON file containing events')
  .option('--db <path>', 'SQLite database path')
  .action((file: string, opts: { db?: string }) => {
    const dbPath = opts.db ?? getDbPath();
    const filePath = resolve(file);

    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`);
      process.exit(1);
    }

    const storage = new SQLiteStorage(dbPath);
    try {
      console.log(`Importing ${filePath}...`);
      const result = importJsonFile(filePath, storage);
      console.log(`  Events: ${result.totalEvents}`);
      console.log(`  Sessions: ${result.sessionsProcessed}`);
      if (result.errors.length > 0) {
        console.log(`  Errors: ${result.errors.length}`);
        for (const err of result.errors.slice(0, 5)) {
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
