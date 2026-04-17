import Database from 'better-sqlite3';
import type { StorageAdapter } from './types.js';
import type { AgentEvent, Session, SessionMetrics, SessionFilters } from '../types.js';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type, timestamp);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  total_turns INTEGER NOT NULL,
  total_tokens_in INTEGER NOT NULL,
  total_tokens_out INTEGER NOT NULL,
  total_tokens_reasoning INTEGER,
  total_tool_calls INTEGER NOT NULL,
  total_errors INTEGER NOT NULL,
  total_retries INTEGER NOT NULL,
  time_in_starting_ms INTEGER NOT NULL,
  time_in_working_ms INTEGER NOT NULL,
  time_in_stalled_ms INTEGER NOT NULL,
  time_in_waiting_ms INTEGER NOT NULL,
  end_reason TEXT NOT NULL,
  task_completed INTEGER NOT NULL,
  completion_type TEXT,
  agent_name TEXT NOT NULL,
  agent_version TEXT NOT NULL,
  agent_framework TEXT,
  model_provider TEXT NOT NULL,
  model_id TEXT NOT NULL,
  interface_type TEXT NOT NULL,
  task_category TEXT,
  complexity_tier TEXT,
  session_mode TEXT NOT NULL,
  content_type TEXT
);

CREATE TABLE IF NOT EXISTS metrics (
  session_id TEXT PRIMARY KEY,
  computed_at TEXT NOT NULL,
  tokens_per_session INTEGER NOT NULL,
  turns_per_session INTEGER NOT NULL,
  tool_calls_per_session INTEGER NOT NULL,
  duration_seconds REAL NOT NULL,
  errors_per_session INTEGER NOT NULL,
  time_per_turn_avg REAL NOT NULL,
  time_to_first_token REAL,
  tokens_per_turn_avg REAL NOT NULL,
  tool_call_duration_ms_avg REAL,
  tool_call_duration_ms_p50 REAL,
  tool_call_duration_ms_p95 REAL,
  tool_success_rate REAL,
  retry_count_total INTEGER NOT NULL,
  stall_duration_ms_avg REAL,
  stall_duration_ms_total INTEGER NOT NULL,
  r_time_to_first_token REAL,
  r_output_speed REAL,
  r_resume_speed REAL,
  r_time_per_turn REAL NOT NULL,
  rel_start_failure_rate REAL NOT NULL,
  rel_stall_ratio REAL NOT NULL,
  rel_stall_count INTEGER NOT NULL,
  rel_avg_stall_duration REAL,
  rel_error_rate INTEGER NOT NULL,
  rel_hidden_retries INTEGER NOT NULL,
  a_questions_asked INTEGER NOT NULL,
  a_user_corrections INTEGER NOT NULL,
  a_first_try_success_rate REAL NOT NULL,
  a_user_active_time_pct REAL NOT NULL,
  a_work_multiplier REAL,
  c_output_quality_score REAL,
  c_clean_output_rate REAL,
  c_quality_decay REAL,
  c_useful_token_pct REAL NOT NULL,
  comp_task_completion_rate REAL NOT NULL,
  comp_redo_rate REAL,
  comp_gave_up_rate REAL NOT NULL,
  comp_where_they_gave_up TEXT,
  comp_time_to_done REAL,
  comp_came_back_rate REAL
);
`;

export class SQLiteStorage implements StorageAdapter {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(SCHEMA_SQL);
  }

  writeEvents(events: AgentEvent[]): void {
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO events (event_id, session_id, timestamp, event_type, payload) VALUES (?, ?, ?, ?, ?)'
    );
    const tx = this.db.transaction((evts: AgentEvent[]) => {
      for (const e of evts) {
        stmt.run(e.event_id, e.session_id, e.timestamp, e.event_type, JSON.stringify(e.payload));
      }
    });
    tx(events);
  }

  writeSession(session: Session): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sessions (
        session_id, user_id, started_at, ended_at, duration_ms,
        total_turns, total_tokens_in, total_tokens_out, total_tokens_reasoning,
        total_tool_calls, total_errors, total_retries,
        time_in_starting_ms, time_in_working_ms, time_in_stalled_ms, time_in_waiting_ms,
        end_reason, task_completed, completion_type,
        agent_name, agent_version, agent_framework, model_provider, model_id,
        interface_type, task_category, complexity_tier, session_mode, content_type
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);
    stmt.run(
      session.session_id, session.user_id, session.started_at, session.ended_at, session.duration_ms,
      session.total_turns, session.total_tokens_in, session.total_tokens_out, session.total_tokens_reasoning,
      session.total_tool_calls, session.total_errors, session.total_retries,
      session.time_in_starting_ms, session.time_in_working_ms, session.time_in_stalled_ms, session.time_in_waiting_ms,
      session.end_reason, session.task_completed ? 1 : 0, session.completion_type,
      session.agent_name, session.agent_version, session.agent_framework, session.model_provider, session.model_id,
      session.interface_type, session.task_category, session.complexity_tier, session.session_mode, session.content_type
    );
  }

  writeMetrics(metrics: SessionMetrics): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO metrics (
        session_id, computed_at,
        tokens_per_session, turns_per_session, tool_calls_per_session,
        duration_seconds, errors_per_session, time_per_turn_avg,
        time_to_first_token, tokens_per_turn_avg,
        tool_call_duration_ms_avg, tool_call_duration_ms_p50, tool_call_duration_ms_p95,
        tool_success_rate, retry_count_total,
        stall_duration_ms_avg, stall_duration_ms_total,
        r_time_to_first_token, r_output_speed, r_resume_speed, r_time_per_turn,
        rel_start_failure_rate, rel_stall_ratio, rel_stall_count,
        rel_avg_stall_duration, rel_error_rate, rel_hidden_retries,
        a_questions_asked, a_user_corrections, a_first_try_success_rate,
        a_user_active_time_pct, a_work_multiplier,
        c_output_quality_score, c_clean_output_rate, c_quality_decay, c_useful_token_pct,
        comp_task_completion_rate, comp_redo_rate, comp_gave_up_rate,
        comp_where_they_gave_up, comp_time_to_done, comp_came_back_rate
      ) VALUES (
        ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )
    `);
    stmt.run(
      metrics.session_id, metrics.computed_at,
      metrics.tokens_per_session, metrics.turns_per_session, metrics.tool_calls_per_session,
      metrics.duration_seconds, metrics.errors_per_session, metrics.time_per_turn_avg,
      metrics.time_to_first_token, metrics.tokens_per_turn_avg,
      metrics.tool_call_duration_ms_avg, metrics.tool_call_duration_ms_p50, metrics.tool_call_duration_ms_p95,
      metrics.tool_success_rate, metrics.retry_count_total,
      metrics.stall_duration_ms_avg, metrics.stall_duration_ms_total,
      metrics.r_time_to_first_token, metrics.r_output_speed, metrics.r_resume_speed, metrics.r_time_per_turn,
      metrics.rel_start_failure_rate, metrics.rel_stall_ratio, metrics.rel_stall_count,
      metrics.rel_avg_stall_duration, metrics.rel_error_rate, metrics.rel_hidden_retries,
      metrics.a_questions_asked, metrics.a_user_corrections, metrics.a_first_try_success_rate,
      metrics.a_user_active_time_pct, metrics.a_work_multiplier,
      metrics.c_output_quality_score, metrics.c_clean_output_rate, metrics.c_quality_decay, metrics.c_useful_token_pct,
      metrics.comp_task_completion_rate, metrics.comp_redo_rate, metrics.comp_gave_up_rate,
      metrics.comp_where_they_gave_up, metrics.comp_time_to_done, metrics.comp_came_back_rate
    );
  }

  querySessions(filters?: SessionFilters): Session[] {
    let sql = 'SELECT * FROM sessions WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.dateFrom) {
      sql += ' AND started_at >= ?';
      params.push(filters.dateFrom);
    }
    if (filters?.dateTo) {
      sql += ' AND started_at <= ?';
      params.push(filters.dateTo);
    }
    if (filters?.agentName) {
      sql += ' AND agent_name = ?';
      params.push(filters.agentName);
    }
    if (filters?.modelId) {
      sql += ' AND model_id = ?';
      params.push(filters.modelId);
    }
    sql += ' ORDER BY started_at DESC';
    if (filters?.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(rowToSession);
  }

  queryMetrics(filters?: SessionFilters): SessionMetrics[] {
    let sql = `
      SELECT m.* FROM metrics m
      JOIN sessions s ON m.session_id = s.session_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters?.dateFrom) {
      sql += ' AND s.started_at >= ?';
      params.push(filters.dateFrom);
    }
    if (filters?.dateTo) {
      sql += ' AND s.started_at <= ?';
      params.push(filters.dateTo);
    }
    sql += ' ORDER BY s.started_at DESC';
    if (filters?.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(rowToMetrics);
  }

  queryEvents(sessionId: string): AgentEvent[] {
    const rows = this.db
      .prepare('SELECT * FROM events WHERE session_id = ? ORDER BY timestamp ASC')
      .all(sessionId) as Record<string, unknown>[];
    return rows.map((r) => ({
      event_id: r.event_id as string,
      session_id: r.session_id as string,
      timestamp: r.timestamp as string,
      event_type: r.event_type as AgentEvent['event_type'],
      payload: JSON.parse(r.payload as string),
    }));
  }

  /**
   * Return (session_id, tool_name, tool_category) rows from every
   * `tool_call_start` event. Used by the server to build per-session
   * tool-category counts for the Distributions donut (DASH-6). We don't
   * store a denormalized total on `sessions` because the set of categories
   * may evolve — re-deriving from raw events keeps the source-of-truth in
   * one place while staying cheap (one SQL query, JSON-parsed once per row).
   */
  queryToolCallStartRows(): Array<{ session_id: string; tool_name: string; tool_category: string | null }> {
    const rows = this.db
      .prepare("SELECT session_id, payload FROM events WHERE event_type = 'tool_call_start'")
      .all() as Array<{ session_id: string; payload: string }>;
    const out: Array<{ session_id: string; tool_name: string; tool_category: string | null }> = [];
    for (const r of rows) {
      try {
        const p = JSON.parse(r.payload) as { tool_name?: string; tool_category?: string };
        if (typeof p.tool_name === 'string') {
          out.push({
            session_id: r.session_id,
            tool_name: p.tool_name,
            tool_category: typeof p.tool_category === 'string' ? p.tool_category : null,
          });
        }
      } catch {
        // Skip malformed payloads; counts remain accurate for well-formed ones.
      }
    }
    return out;
  }

  getSessionCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM sessions').get() as { cnt: number };
    return row.cnt;
  }

  getEventCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM events').get() as { cnt: number };
    return row.cnt;
  }

  getDateRange(): { earliest: string | null; latest: string | null } {
    const row = this.db
      .prepare('SELECT MIN(started_at) as earliest, MAX(started_at) as latest FROM sessions')
      .get() as { earliest: string | null; latest: string | null };
    return row;
  }

  close(): void {
    this.db.close();
  }
}

function rowToSession(r: Record<string, unknown>): Session {
  return {
    session_id: r.session_id as string,
    user_id: r.user_id as string | null,
    started_at: r.started_at as string,
    ended_at: r.ended_at as string,
    duration_ms: r.duration_ms as number,
    total_turns: r.total_turns as number,
    total_tokens_in: r.total_tokens_in as number,
    total_tokens_out: r.total_tokens_out as number,
    total_tokens_reasoning: r.total_tokens_reasoning as number | null,
    total_tool_calls: r.total_tool_calls as number,
    total_errors: r.total_errors as number,
    total_retries: r.total_retries as number,
    time_in_starting_ms: r.time_in_starting_ms as number,
    time_in_working_ms: r.time_in_working_ms as number,
    time_in_stalled_ms: r.time_in_stalled_ms as number,
    time_in_waiting_ms: r.time_in_waiting_ms as number,
    end_reason: r.end_reason as Session['end_reason'],
    task_completed: Boolean(r.task_completed),
    completion_type: r.completion_type as Session['completion_type'],
    agent_name: r.agent_name as string,
    agent_version: r.agent_version as string,
    agent_framework: r.agent_framework as string | null,
    model_provider: r.model_provider as string,
    model_id: r.model_id as string,
    interface_type: r.interface_type as Session['interface_type'],
    task_category: r.task_category as Session['task_category'],
    complexity_tier: r.complexity_tier as Session['complexity_tier'],
    session_mode: r.session_mode as Session['session_mode'],
    content_type: r.content_type as Session['content_type'],
  };
}

function rowToMetrics(r: Record<string, unknown>): SessionMetrics {
  return {
    session_id: r.session_id as string,
    computed_at: r.computed_at as string,
    tokens_per_session: r.tokens_per_session as number,
    turns_per_session: r.turns_per_session as number,
    tool_calls_per_session: r.tool_calls_per_session as number,
    duration_seconds: r.duration_seconds as number,
    errors_per_session: r.errors_per_session as number,
    time_per_turn_avg: r.time_per_turn_avg as number,
    time_to_first_token: r.time_to_first_token as number | null,
    tokens_per_turn_avg: r.tokens_per_turn_avg as number,
    tool_call_duration_ms_avg: r.tool_call_duration_ms_avg as number | null,
    tool_call_duration_ms_p50: r.tool_call_duration_ms_p50 as number | null,
    tool_call_duration_ms_p95: r.tool_call_duration_ms_p95 as number | null,
    tool_success_rate: r.tool_success_rate as number | null,
    retry_count_total: r.retry_count_total as number,
    stall_duration_ms_avg: r.stall_duration_ms_avg as number | null,
    stall_duration_ms_total: r.stall_duration_ms_total as number,
    r_time_to_first_token: r.r_time_to_first_token as number | null,
    r_output_speed: r.r_output_speed as number | null,
    r_resume_speed: r.r_resume_speed as number | null,
    r_time_per_turn: r.r_time_per_turn as number,
    rel_start_failure_rate: r.rel_start_failure_rate as number,
    rel_stall_ratio: r.rel_stall_ratio as number,
    rel_stall_count: r.rel_stall_count as number,
    rel_avg_stall_duration: r.rel_avg_stall_duration as number | null,
    rel_error_rate: r.rel_error_rate as number,
    rel_hidden_retries: r.rel_hidden_retries as number,
    a_questions_asked: r.a_questions_asked as number,
    a_user_corrections: r.a_user_corrections as number,
    a_first_try_success_rate: r.a_first_try_success_rate as number,
    a_user_active_time_pct: r.a_user_active_time_pct as number,
    a_work_multiplier: r.a_work_multiplier as number | null,
    c_output_quality_score: r.c_output_quality_score as number | null,
    c_clean_output_rate: r.c_clean_output_rate as number | null,
    c_quality_decay: r.c_quality_decay as number | null,
    c_useful_token_pct: r.c_useful_token_pct as number,
    comp_task_completion_rate: r.comp_task_completion_rate as number,
    comp_redo_rate: r.comp_redo_rate as number | null,
    comp_gave_up_rate: r.comp_gave_up_rate as number,
    comp_where_they_gave_up: r.comp_where_they_gave_up as SessionMetrics['comp_where_they_gave_up'],
    comp_time_to_done: r.comp_time_to_done as number | null,
    comp_came_back_rate: r.comp_came_back_rate as number | null,
  };
}
