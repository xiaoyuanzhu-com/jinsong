import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { AgentEvent, EventType } from '../types.js';
import type { Connector } from './types.js';

// ─── Claude Code JSONL message shapes ────────────────────────────────────────

interface CCMessage {
  type: string; // 'queue-operation' | 'progress' | 'user' | 'assistant' | 'last-prompt'
  timestamp?: string;
  sessionId?: string;
  uuid?: string;
  parentUuid?: string;
  isSidechain?: boolean;
  isMeta?: boolean;
  toolUseResult?: Record<string, unknown>;
  sourceToolUseID?: string;
  message?: {
    role?: string;
    model?: string;
    content?: unknown; // string | ContentBlock[]
    stop_reason?: string | null;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };
}

interface ContentBlock {
  type: string; // 'text' | 'thinking' | 'tool_use' | 'tool_result'
  text?: string;
  thinking?: string;
  name?: string;
  id?: string;
  tool_use_id?: string;
  content?: unknown;
}

// ─── Correction heuristic ────────────────────────────────────────────────────

const CORRECTION_PREFIXES = [
  'no,', 'no ', 'nope', 'actually', 'stop', 'wait', 'wrong', 'that\'s not',
  'don\'t', 'do not', 'instead', 'I meant', 'not what I',
];

function looksLikeCorrection(text: string): boolean {
  const lower = text.trim().toLowerCase();
  return CORRECTION_PREFIXES.some(p => lower.startsWith(p));
}

// ─── Tool category inference ─────────────────────────────────────────────────

function inferToolCategory(name: string): string {
  const n = name.toLowerCase();
  if (n === 'bash' || n === 'execute') return 'execution';
  if (n === 'read' || n === 'glob' || n === 'grep') return 'file_system';
  if (n === 'edit' || n === 'write') return 'file_system';
  if (n === 'webfetch' || n === 'websearch') return 'browser';
  if (n === 'todowrite' || n === 'todoread') return 'other';
  if (n.startsWith('mcp__')) return 'other';
  return 'other';
}

// ─── SHA-256 hash helper ─────────────────────────────────────────────────────

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

// ─── Extract text from content ───────────────────────────────────────────────

function extractText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const texts: string[] = [];
    for (const block of content) {
      if (typeof block === 'string') texts.push(block);
      else if (block && typeof block === 'object') {
        const b = block as ContentBlock;
        if (b.type === 'text' && b.text) texts.push(b.text);
      }
    }
    return texts.join('\n');
  }
  return '';
}

// ─── Convert a single JSONL session file ─────────────────────────────────────

function convertSession(filePath: string): AgentEvent[] {
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.split('\n').filter(l => l.trim());

  const messages: CCMessage[] = [];
  for (const line of lines) {
    try {
      messages.push(JSON.parse(line));
    } catch {
      // skip malformed lines
    }
  }

  if (messages.length === 0) return [];

  // Derive session ID from the file or from sessionId field
  const sessionId = messages.find(m => m.sessionId)?.sessionId
    ?? basename(filePath, extname(filePath));

  const events: AgentEvent[] = [];
  let eventSeq = 0;
  let turnNumber = 0;
  let firstUserSeen = false;
  let firstTokenEmitted = false;
  let lastPromptSubmitTs: number | null = null;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalToolCalls = 0;
  let modelId = 'unknown';
  let modelFound = false;
  let sessionStartTs: string | null = null;
  let sessionEndTs: string | null = null;

  // Track tool calls: tool_use_id -> { name, startTs }
  const pendingTools = new Map<string, { name: string; startTs: number }>();

  // Track timestamps for tool results delivered via user messages
  const toolResultTimestamps = new Map<string, string>();

  function makeEvent(
    type: EventType,
    timestamp: string,
    payload: Record<string, unknown>
  ): AgentEvent {
    eventSeq++;
    return {
      event_id: `${sessionId}-e${String(eventSeq).padStart(4, '0')}`,
      session_id: sessionId,
      timestamp,
      event_type: type,
      payload: payload as AgentEvent['payload'],
    };
  }

  for (const msg of messages) {
    const ts = msg.timestamp;
    if (!ts) continue;

    if (!sessionStartTs) sessionStartTs = ts;
    sessionEndTs = ts;

    const msgType = msg.type.toLowerCase();

    // ─── USER messages ─────────────────────────────────────────────────
    if (msgType === 'user') {
      // Skip meta messages (system injections)
      if (msg.isMeta) continue;

      const content = msg.message?.content;

      // Check if this is a tool result
      if (Array.isArray(content)) {
        const blocks = content as ContentBlock[];
        const isToolResult = blocks.some(b => b.type === 'tool_result');
        if (isToolResult) {
          // This is a tool result message — emit tool_call_end for each result
          for (const block of blocks) {
            if (block.type === 'tool_result' && block.tool_use_id) {
              const pending = pendingTools.get(block.tool_use_id);
              if (pending) {
                const durationMs = new Date(ts).getTime() - pending.startTs;
                const toolResult = msg.toolUseResult;
                let status: 'success' | 'failure' | 'timeout' = 'success';
                let errorMessage: string | undefined;

                // Check for errors in tool result
                if (toolResult) {
                  if (toolResult.stderr && typeof toolResult.stderr === 'string' && toolResult.stderr.length > 0) {
                    // stderr doesn't necessarily mean failure
                  }
                  if (toolResult.interrupted) {
                    status = 'timeout';
                  }
                }
                // Check content for error indication
                const resultContent = block.content;
                if (typeof resultContent === 'string' && resultContent.includes('Error:')) {
                  // Heuristic — not all "Error:" strings mean the tool failed
                }

                events.push(makeEvent('tool_call_end', ts, {
                  tool_call_id: block.tool_use_id,
                  tool_name: pending.name,
                  status,
                  duration_ms: Math.max(0, durationMs),
                  ...(errorMessage ? { error_message: errorMessage } : {}),
                }));
                pendingTools.delete(block.tool_use_id);
              }
            }
          }
          continue;
        }
      }

      // This is a real user message (not a tool result)
      // Check if it came from a sub-agent tool
      if (msg.sourceToolUseID) continue;

      const text = extractText(content);
      if (!text.trim()) continue;

      // Emit session_start + prompt_submit on first real user message
      if (!firstUserSeen) {
        firstUserSeen = true;
        turnNumber = 1;

        events.push(makeEvent('session_start', ts, {
          agent_name: 'Claude Code',
          agent_version: '1.0.0',
          agent_framework: 'Anthropic Agent SDK',
          model_provider: 'Anthropic',
          model_id: modelId,
          interface_type: 'CLI',
          session_mode: 'multi_turn_interactive',
        }));

        events.push(makeEvent('prompt_submit', ts, {
          prompt_hash: sha256(text),
          turn_number: turnNumber,
          token_count: Math.ceil(text.length / 4), // rough approximation
        }));
        lastPromptSubmitTs = new Date(ts).getTime();
      } else {
        // Subsequent user message
        turnNumber++;

        // Check if it looks like a correction
        if (looksLikeCorrection(text)) {
          events.push(makeEvent('user_correction', ts, {
            turn_number: turnNumber,
            correction_type: 'redirect',
          }));
        }

        // Check if this is a response to a question (user_input_received)
        // Heuristic: if there was no tool call between last assistant and this user message,
        // it's likely a response to a question
        const lastEvent = events[events.length - 1];
        if (lastEvent && lastEvent.event_type === 'user_input_requested') {
          const waitMs = new Date(ts).getTime() - new Date(lastEvent.timestamp).getTime();
          events.push(makeEvent('user_input_received', ts, {
            wait_duration_ms: Math.max(0, waitMs),
            response_token_count: Math.ceil(text.length / 4),
          }));
        }

        // Always emit a new prompt_submit for each user turn
        events.push(makeEvent('prompt_submit', ts, {
          prompt_hash: sha256(text),
          turn_number: turnNumber,
          token_count: Math.ceil(text.length / 4),
        }));
        lastPromptSubmitTs = new Date(ts).getTime();
        firstTokenEmitted = false; // reset for new turn
      }
    }

    // ─── ASSISTANT messages ────────────────────────────────────────────
    if (msgType === 'assistant') {
      const amsg = msg.message;
      if (!amsg) continue;

      // Extract model info
      if (!modelFound && amsg.model) {
        modelId = amsg.model;
        modelFound = true;
        // Patch the session_start event's model_id
        const startEvent = events.find(e => e.event_type === 'session_start');
        if (startEvent) {
          (startEvent.payload as Record<string, unknown>).model_id = modelId;
        }
      }

      // Extract token usage
      if (amsg.usage) {
        const u = amsg.usage;
        if (u.input_tokens) totalTokensIn += u.input_tokens;
        if (u.cache_creation_input_tokens) totalTokensIn += u.cache_creation_input_tokens;
        if (u.cache_read_input_tokens) totalTokensIn += u.cache_read_input_tokens;
        if (u.output_tokens) totalTokensOut += u.output_tokens;
      }

      const contentBlocks = Array.isArray(amsg.content) ? amsg.content as ContentBlock[] : [];

      for (const block of contentBlocks) {
        // Text block — first_token or output_chunk
        if (block.type === 'text' && block.text) {
          if (!firstTokenEmitted && lastPromptSubmitTs !== null) {
            const latencyMs = new Date(ts).getTime() - lastPromptSubmitTs;
            events.push(makeEvent('first_token', ts, {
              latency_ms: Math.max(0, latencyMs),
            }));
            firstTokenEmitted = true;
          }

          events.push(makeEvent('output_chunk', ts, {
            token_count: Math.ceil(block.text.length / 4),
            chunk_type: 'text',
            is_valid: true,
          }));
        }

        // Tool use block — tool_call_start
        if (block.type === 'tool_use' && block.name && block.id) {
          totalToolCalls++;
          pendingTools.set(block.id, { name: block.name, startTs: new Date(ts).getTime() });

          events.push(makeEvent('tool_call_start', ts, {
            tool_call_id: block.id,
            tool_name: block.name,
            tool_provider: 'built-in',
            tool_category: inferToolCategory(block.name),
            stall_reason: 'tool_call',
          }));
        }
      }

      // Check for end_turn with no tool_use — might be asking a question or completing
      if (amsg.stop_reason === 'end_turn') {
        const hasToolUse = contentBlocks.some(b => b.type === 'tool_use');
        if (!hasToolUse) {
          const textContent = contentBlocks
            .filter(b => b.type === 'text' && b.text)
            .map(b => b.text!)
            .join('\n');

          // Heuristic: if the text ends with a question mark, it's asking a question
          const trimmed = textContent.trim();
          if (trimmed.endsWith('?')) {
            events.push(makeEvent('user_input_requested', ts, {
              input_type: 'clarification',
              question_hash: sha256(trimmed.slice(-100)),
            }));
          }
        }
      }
    }
  }

  // ─── Close any remaining pending tool calls ─────────────────────────────
  for (const [toolId, pending] of pendingTools) {
    const endTs = sessionEndTs ?? new Date().toISOString();
    events.push(makeEvent('tool_call_end', endTs, {
      tool_call_id: toolId,
      tool_name: pending.name,
      status: 'timeout',
      duration_ms: Math.max(0, new Date(endTs).getTime() - pending.startTs),
    }));
  }

  // ─── Emit task_complete if last assistant had end_turn ──────────────────
  const lastAssistant = [...messages].reverse().find(
    m => m.type.toLowerCase() === 'assistant' && m.message?.stop_reason === 'end_turn'
  );
  if (lastAssistant && sessionEndTs) {
    // Check there's meaningful text output (not just tool calls)
    const contentBlocks = Array.isArray(lastAssistant.message?.content)
      ? lastAssistant.message!.content as ContentBlock[]
      : [];
    const hasText = contentBlocks.some(b => b.type === 'text' && b.text && b.text.trim().length > 10);
    if (hasText) {
      events.push(makeEvent('task_complete', sessionEndTs, {
        completion_type: 'full',
        output_token_count: totalTokensOut,
      }));
    }
  }

  // ─── Emit session_end ──────────────────────────────────────────────────
  if (sessionStartTs && sessionEndTs) {
    const totalDuration = new Date(sessionEndTs).getTime() - new Date(sessionStartTs).getTime();
    const hasTaskComplete = events.some(e => e.event_type === 'task_complete');

    events.push(makeEvent('session_end', sessionEndTs, {
      end_reason: hasTaskComplete ? 'completed' : 'user_cancelled',
      total_duration_ms: Math.max(0, totalDuration),
      total_tokens_in: totalTokensIn,
      total_tokens_out: totalTokensOut,
      total_tool_calls: totalToolCalls,
    }));
  }

  return events;
}

// ─── Scan directory for JSONL files ──────────────────────────────────────────

function findJsonlFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(d: string): void {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

// ─── Detect Claude Code format ───────────────────────────────────────────────

function isClaudeCodeJsonl(filePath: string): boolean {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    // Read first few lines
    const firstLines = raw.split('\n').slice(0, 10).filter(l => l.trim());
    for (const line of firstLines) {
      try {
        const obj = JSON.parse(line);
        const t = (obj.type ?? '').toLowerCase();
        if (t === 'queue-operation' || t === 'user' || t === 'assistant' || t === 'progress') {
          // Check for Claude Code specific fields
          if (obj.sessionId || obj.uuid || obj.parentUuid || obj.entrypoint) {
            return true;
          }
          // Check for assistant message with expected shape
          if (t === 'assistant' && obj.message?.model) {
            return true;
          }
          if (t === 'user' && obj.message?.role === 'user') {
            return true;
          }
        }
      } catch {
        // not valid JSON line
      }
    }
  } catch {
    // file not readable
  }
  return false;
}

// ─── Claude Code Connector ───────────────────────────────────────────────────

export const connector: Connector = {
  name: 'claude-code',

  detect(path: string): boolean {
    if (!existsSync(path)) return false;

    const stat = statSync(path);

    if (stat.isFile()) {
      return path.endsWith('.jsonl') && isClaudeCodeJsonl(path);
    }

    if (stat.isDirectory()) {
      // Check if it looks like a Claude Code project directory
      // e.g., ~/.claude/projects/-home-user-project/
      if (path.includes('.claude/projects')) return true;

      // Or check if directory contains JSONL files with Claude Code format
      const jsonlFiles = findJsonlFiles(path);
      for (const f of jsonlFiles.slice(0, 3)) {
        if (isClaudeCodeJsonl(f)) return true;
      }
    }

    return false;
  },

  convert(path: string): AgentEvent[][] {
    const stat = statSync(path);
    const sessions: AgentEvent[][] = [];

    if (stat.isFile()) {
      const events = convertSession(path);
      if (events.length > 0) sessions.push(events);
    } else if (stat.isDirectory()) {
      const jsonlFiles = findJsonlFiles(path);
      for (const f of jsonlFiles) {
        if (isClaudeCodeJsonl(f)) {
          try {
            const events = convertSession(f);
            if (events.length > 0) sessions.push(events);
          } catch {
            // skip files that fail to parse
          }
        }
      }
    }

    return sessions;
  },
};
