import type {
  AgentEvent,
  Session,
  TrackerState,
  SessionStartPayload,
  PromptSubmitPayload,
  FirstTokenPayload,
  ToolCallStartPayload,
  ToolCallEndPayload,
  RetryStartPayload,
  RetryEndPayload,
  ErrorPayload,
  TaskCompletePayload,
  UserCancelPayload,
  SessionEndPayload,
  OutputChunkPayload,
  UserCorrectionPayload,
  ContentType,
} from '../types.js';

interface StateDurations {
  Starting: number;
  Working: number;
  Stalled: number;
  Waiting: number;
  Failed: number;
  Ended: number;
}

export class SessionTracker {
  private currentState: TrackerState = 'Starting';
  private stateEntryTime: number = 0;
  private durations: StateDurations = {
    Starting: 0,
    Working: 0,
    Stalled: 0,
    Waiting: 0,
    Failed: 0,
    Ended: 0,
  };

  private turnNumber: number = 0;
  private pendingToolCalls: Set<string> = new Set();

  // Accumulators
  private totalTokensIn: number = 0;
  private totalTokensOut: number = 0;
  private totalToolCalls: number = 0;
  private totalErrors: number = 0;
  private totalRetries: number = 0;
  private userCorrections: number = 0;
  private questionsAsked: number = 0;
  private stallTransitions: number = 0;

  private startedAt: string = '';
  private endedAt: string = '';
  private endReason: Session['end_reason'] = 'completed';
  private taskCompleted: boolean = false;
  private completionType: Session['completion_type'] = null;
  private startFailed: boolean = false;

  // Dimension fields
  private agentName: string = '';
  private agentVersion: string = '';
  private agentFramework: string | null = null;
  private modelProvider: string = '';
  private modelId: string = '';
  private interfaceType: Session['interface_type'] = 'CLI';
  private taskCategory: Session['task_category'] = null;
  private complexityTier: Session['complexity_tier'] = null;
  private sessionMode: Session['session_mode'] = 'multi_turn_interactive';

  // For cancel tracking
  private cancelState: TrackerState | null = null;

  // First prompt timestamp for time_to_done calculation
  private firstPromptTimestamp: number | null = null;
  private taskCompleteTimestamp: number | null = null;

  private sessionId: string = '';

  processEvent(event: AgentEvent): void {
    const ts = new Date(event.timestamp).getTime();

    if (event.event_type === 'session_start') {
      this.sessionId = event.session_id;
      this.currentState = 'Starting';
      this.stateEntryTime = ts;
      this.startedAt = event.timestamp;
      const p = event.payload as SessionStartPayload;
      this.agentName = p.agent_name;
      this.agentVersion = p.agent_version;
      this.agentFramework = p.agent_framework ?? null;
      this.modelProvider = p.model_provider;
      this.modelId = p.model_id;
      this.interfaceType = p.interface_type;
      this.sessionMode = p.session_mode;
      return;
    }

    switch (event.event_type) {
      case 'prompt_submit': {
        const p = event.payload as PromptSubmitPayload;
        if (p.token_count) this.totalTokensIn += p.token_count;
        if (p.task_category) this.taskCategory = p.task_category;
        if (p.complexity_tier) this.complexityTier = p.complexity_tier;
        this.turnNumber = p.turn_number;
        if (this.firstPromptTimestamp === null) {
          this.firstPromptTimestamp = ts;
        }

        if (this.currentState === 'Working') {
          this.flushState(ts);
          this.currentState = 'Starting';
          this.stateEntryTime = ts;
        } else if (this.currentState === 'Waiting') {
          this.flushState(ts);
          this.currentState = 'Starting';
          this.stateEntryTime = ts;
        }
        // If already Starting, stay Starting
        break;
      }

      case 'first_token': {
        if (this.currentState === 'Starting') {
          this.flushState(ts);
          this.currentState = 'Working';
          this.stateEntryTime = ts;
        }
        break;
      }

      case 'output_chunk': {
        const p = event.payload as OutputChunkPayload;
        this.totalTokensOut += p.token_count;
        if (this.currentState === 'Stalled') {
          this.flushState(ts);
          this.currentState = 'Working';
          this.stateEntryTime = ts;
        }
        break;
      }

      case 'tool_call_start': {
        const p = event.payload as ToolCallStartPayload;
        this.totalToolCalls++;
        this.pendingToolCalls.add(p.tool_call_id);
        if (this.currentState === 'Working') {
          this.stallTransitions++;
          this.flushState(ts);
          this.currentState = 'Stalled';
          this.stateEntryTime = ts;
        }
        // If already Stalled, stay Stalled (nested tool calls)
        break;
      }

      case 'tool_call_end': {
        const p = event.payload as ToolCallEndPayload;
        this.pendingToolCalls.delete(p.tool_call_id);
        if (this.currentState === 'Stalled' && this.pendingToolCalls.size === 0) {
          this.flushState(ts);
          this.currentState = 'Working';
          this.stateEntryTime = ts;
        }
        break;
      }

      case 'retry_start': {
        this.totalRetries++;
        if (this.currentState === 'Working') {
          this.stallTransitions++;
          this.flushState(ts);
          this.currentState = 'Stalled';
          this.stateEntryTime = ts;
        }
        break;
      }

      case 'retry_end': {
        const p = event.payload as RetryEndPayload;
        if (p.status === 'budget_exhausted') {
          this.flushState(ts);
          this.currentState = 'Failed';
          this.stateEntryTime = ts;
        } else if (p.status === 'success' && this.currentState === 'Stalled' && this.pendingToolCalls.size === 0) {
          this.flushState(ts);
          this.currentState = 'Working';
          this.stateEntryTime = ts;
        }
        break;
      }

      case 'user_input_requested': {
        this.questionsAsked++;
        if (this.currentState === 'Working') {
          this.flushState(ts);
          this.currentState = 'Waiting';
          this.stateEntryTime = ts;
        }
        break;
      }

      case 'user_input_received': {
        if (this.currentState === 'Waiting') {
          this.flushState(ts);
          this.currentState = 'Working';
          this.stateEntryTime = ts;
        }
        break;
      }

      case 'user_correction': {
        this.userCorrections++;
        // No state change
        break;
      }

      case 'error': {
        const p = event.payload as ErrorPayload;
        this.totalErrors++;
        if (p.is_fatal) {
          if (this.currentState === 'Starting') {
            this.startFailed = true;
          }
          this.flushState(ts);
          this.currentState = 'Failed';
          this.stateEntryTime = ts;
        }
        break;
      }

      case 'task_complete': {
        const p = event.payload as TaskCompletePayload;
        this.taskCompleted = true;
        this.completionType = p.completion_type;
        this.taskCompleteTimestamp = ts;
        if (p.output_token_count != null) {
          // Use as authoritative total if provided
        }
        if (this.currentState === 'Working') {
          this.flushState(ts);
          this.currentState = 'Ended';
          this.stateEntryTime = ts;
        }
        break;
      }

      case 'user_cancel': {
        const p = event.payload as UserCancelPayload;
        this.cancelState = p.current_state ?? this.currentState;
        if (this.isActiveState(this.currentState)) {
          this.flushState(ts);
          this.currentState = 'Ended';
          this.stateEntryTime = ts;
        }
        break;
      }

      case 'session_end': {
        const p = event.payload as SessionEndPayload;
        this.endedAt = event.timestamp;
        this.endReason = p.end_reason;
        if (p.total_tokens_in != null) this.totalTokensIn = p.total_tokens_in;
        if (p.total_tokens_out != null) this.totalTokensOut = p.total_tokens_out;
        if (p.total_tool_calls != null) this.totalToolCalls = p.total_tool_calls;
        if (this.currentState !== 'Ended') {
          this.flushState(ts);
          this.currentState = 'Ended';
          this.stateEntryTime = ts;
        }
        break;
      }
    }
  }

  private isActiveState(state: TrackerState): boolean {
    return state === 'Starting' || state === 'Working' || state === 'Stalled' || state === 'Waiting';
  }

  private flushState(now: number): void {
    const elapsed = now - this.stateEntryTime;
    if (elapsed > 0) {
      this.durations[this.currentState] += elapsed;
    }
  }

  buildSession(): Session {
    const durationMs =
      this.endedAt && this.startedAt
        ? new Date(this.endedAt).getTime() - new Date(this.startedAt).getTime()
        : 0;

    const contentType = this.inferContentType(durationMs);

    return {
      session_id: this.sessionId,
      user_id: null,
      started_at: this.startedAt,
      ended_at: this.endedAt,
      duration_ms: durationMs,
      total_turns: this.turnNumber,
      total_tokens_in: this.totalTokensIn,
      total_tokens_out: this.totalTokensOut,
      total_tokens_reasoning: null,
      total_tool_calls: this.totalToolCalls,
      total_errors: this.totalErrors,
      total_retries: this.totalRetries,
      time_in_starting_ms: this.durations.Starting,
      time_in_working_ms: this.durations.Working,
      time_in_stalled_ms: this.durations.Stalled,
      time_in_waiting_ms: this.durations.Waiting,
      end_reason: this.endReason,
      task_completed: this.taskCompleted,
      completion_type: this.completionType,
      agent_name: this.agentName,
      agent_version: this.agentVersion,
      agent_framework: this.agentFramework,
      model_provider: this.modelProvider,
      model_id: this.modelId,
      interface_type: this.interfaceType,
      task_category: this.taskCategory,
      complexity_tier: this.complexityTier,
      session_mode: this.sessionMode,
      content_type: contentType,
    };
  }

  getStateDurations(): StateDurations {
    return { ...this.durations };
  }

  getStallTransitions(): number {
    return this.stallTransitions;
  }

  getUserCorrections(): number {
    return this.userCorrections;
  }

  getQuestionsAsked(): number {
    return this.questionsAsked;
  }

  getStartFailed(): boolean {
    return this.startFailed;
  }

  getCancelState(): TrackerState | null {
    return this.cancelState;
  }

  getFirstPromptTimestamp(): number | null {
    return this.firstPromptTimestamp;
  }

  getTaskCompleteTimestamp(): number | null {
    return this.taskCompleteTimestamp;
  }

  private inferContentType(durationMs: number): ContentType {
    const turns = this.turnNumber;
    const toolCalls = this.totalToolCalls;
    const durationSec = durationMs / 1000;

    if (turns <= 2 && toolCalls <= 2 && durationSec < 30) {
      return 'quick_answer';
    }
    if (this.sessionMode === 'multi_turn_autonomous' || this.sessionMode === 'background_batch') {
      return 'autonomous_workflow';
    }
    if (turns > 15 || toolCalls > 20 || durationSec > 900) {
      return 'deep_session';
    }
    return 'guided_task';
  }
}
