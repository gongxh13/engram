import type { createOpencodeClient, Session, FileDiff, Message as OpenCodeMessage, UserMessage, AssistantMessage, TextPart } from '@opencode-ai/sdk';

import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';

interface EvalSession {
  session_id: string;
  created_at: string;
  updated_at: string;
  platform: string;
  model: string;
  initial_prompt: string | null;
  initial_context?: {
    context_type: string;
    cwd?: string;
  };
  messages: any[];
  final_diff?: Array<{
    path: string;
    originalContent?: string;
    modifiedContent?: string;
    status: string;
  }>;
  signals: {
    turn_count: number;
    user_edits: number;
  };
}

function appendSession(session: EvalSession): void {
  const filePath = join(homedir(), '.engram', 'sessions.jsonl');
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const line = JSON.stringify(session) + '\n';
  appendFileSync(filePath, line, 'utf-8');
}

interface SessionState {
  session: Session;
  finalDiff?: FileDiff[];
  startedAt: string;
  error?: string;
  saved?: boolean;
  initialPrompt?: string;
  model?: string;
  messages: OpenCodeMessage[];
  messageParts: Map<string, TextPart[]>;
}

type OpenCodeClient = ReturnType<typeof createOpencodeClient>;

export class SessionTracker {
  private sessions = new Map<string, SessionState>();
  private client: OpenCodeClient;

  constructor(client: OpenCodeClient) {
    this.client = client;
  }

  onSessionCreated(session: Session) {
    const state: SessionState = {
      session,
      startedAt: new Date().toISOString(),
      messages: [],
      model: 'unknown',
      messageParts: new Map(),
    };
    this.sessions.set(session.id, state);
  }

  onSessionUpdated(session: Session) {
    const state = this.sessions.get(session.id);
    if (state) {
      state.session = session;
    } else {
      this.sessions.set(session.id, {
        session,
        startedAt: new Date().toISOString(),
        messages: [],
        model: 'unknown',
        messageParts: new Map(),
      });
    }
  }

  onMessageUpdated(message: OpenCodeMessage) {
    const state = this.sessions.get(message.sessionID);
    if (!state) return;

    state.messages.push(message);

    if (message.role === 'user' && !state.initialPrompt) {
      const parts = state.messageParts.get(message.id);
      const textPart = parts?.find((p) => p.type === 'text');
      if (textPart) {
        state.initialPrompt = textPart.text;
      }
    }

    if (message.role === 'assistant' && state.model === 'unknown') {
      const assistantMsg = message as AssistantMessage;
      if (assistantMsg.providerID && assistantMsg.modelID) {
        state.model = `${assistantMsg.providerID}@${assistantMsg.modelID}`;
      }
    }
  }

  onMessagePartUpdated(part: TextPart) {
    const state = this.sessions.get(part.sessionID);
    if (!state) return;

    let parts = state.messageParts.get(part.messageID);
    if (!parts) {
      parts = [];
      state.messageParts.set(part.messageID, parts);
    }
    
    const existingIdx = parts.findIndex((p) => p.id === part.id);
    if (existingIdx >= 0) {
      parts[existingIdx] = part;
    } else {
      parts.push(part);
    }
  }

  onSessionStatus(sessionID: string, status: string) {
    const state = this.sessions.get(sessionID);
    if (state && status === 'idle' && !state.saved) {
      this.finalizeSession(sessionID);
    }
  }

  onSessionDiff(sessionID: string, diff: FileDiff[]) {
    const state = this.sessions.get(sessionID);
    if (state) {
      state.finalDiff = diff;
    }
  }

  onSessionError(sessionID: string, error: unknown) {
    const state = this.sessions.get(sessionID);
    if (state) {
      state.error = String(error);
    }
  }

  private finalizeSession(sessionID: string) {
    const state = this.sessions.get(sessionID);
    if (!state) return;

    const turnCount = Math.floor(state.messages.length / 2);

    const evalSession: EvalSession = {
      session_id: sessionID,
      created_at: state.startedAt,
      updated_at: new Date(state.session.time.updated).toISOString(),
      platform: 'opencode',
      model: state.model || 'unknown',
      initial_prompt: state.initialPrompt || null,
      initial_context: {
        context_type: 'files',
        cwd: state.session.directory,
      },
      messages: [],
      final_diff: state.finalDiff?.map((diff) => ({
        path: diff.file,
        originalContent: diff.before,
        modifiedContent: diff.after,
        status: 'modified',
      })),
      signals: {
        turn_count: turnCount,
        user_edits: 0,
      },
    };

    appendSession(evalSession);
    state.saved = true;
    this.sessions.delete(sessionID);
  }
}