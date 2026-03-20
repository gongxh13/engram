export interface EvalSession {
  session_id: string;
  created_at: string;
  ended_at?: string;
  platform: 'opencode' | 'claude-code' | string;
  model: string;
  domain?: string;

  initial_prompt: string | null;
  initial_context?: {
    context_type: 'files' | 'documents' | 'none';
    git_branch?: string;
    git_commit?: string;
    cwd?: string;
  };

  messages: ConversationMessage[];

  final_diff?: FileDiff[];
  outcome: 'accepted' | 'modified' | 'rejected' | 'abandoned';

  signals: {
    turn_count: number;
    user_edits: number;
    time_to_accept?: number;
    tool_calls?: number;
  };

  annotations?: {
    quality_score?: 1 | 2 | 3 | 4 | 5;
    tags?: string[];
    notes?: string;
  };
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  createdAt?: string;
  status?: 'pending' | 'in_progress' | 'done' | 'error';
  parts?: MessagePart[];
}

export interface MessagePart {
  id: string;
  type: 'text' | 'tool_use' | 'tool_result' | 'image';
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string;
}

export interface FileDiff {
  path: string;
  originalContent?: string;
  modifiedContent?: string;
  patch?: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
}
