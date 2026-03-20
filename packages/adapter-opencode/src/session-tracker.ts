import type { createOpencodeClient } from '@opencode-ai/sdk';
import type { Session, FileDiff } from '@opencode-ai/sdk';

interface EvalSession {
  session_id: string;
  created_at: string;
  ended_at?: string;
  platform: string;
  model: string;
  domain?: string;
  initial_prompt: string | null;
  initial_context?: {
    context_type: string;
    git_branch?: string;
    git_commit?: string;
    cwd?: string;
  };
  messages: { id: string; role: string; createdAt?: string }[];
  final_diff?: { path: string; originalContent?: string; modifiedContent?: string; status: string }[];
  outcome: string;
  signals: {
    turn_count: number;
    user_edits: number;
    time_to_accept?: number;
  };
}

interface SessionState {
  session: Session;
  finalDiff?: FileDiff[];
  startedAt: string;
  error?: string;
}

type OpenCodeClient = ReturnType<typeof createOpencodeClient>;

const DEFAULT_DATA_DIR = `${process.env.HOME}/.engram`;

function ensureDirectory(path: string): void {
  const fs = require('fs');
  const dirname = require('path').dirname;
  const dir = dirname(path);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function appendSession(session: EvalSession): void {
  const fs = require('fs');
  const path = require('path');
  const filePath = path.join(DEFAULT_DATA_DIR, 'sessions.jsonl');
  ensureDirectory(filePath);
  const line = JSON.stringify(session) + '\n';
  fs.appendFileSync(filePath, line, 'utf-8');
  console.log('[engram] Session saved to:', filePath);
}

export class SessionTracker {
  private sessions = new Map<string, SessionState>();
  private client: OpenCodeClient;

  constructor(client: OpenCodeClient) {
    this.client = client;
  }

  onSessionCreated(session: Session) {
    console.log('[engram] Session created:', session.id);
    this.sessions.set(session.id, {
      session,
      startedAt: new Date().toISOString(),
    });
  }

  onSessionUpdated(session: Session) {
    const state = this.sessions.get(session.id);
    if (state) {
      state.session = session;
    } else {
      this.sessions.set(session.id, {
        session,
        startedAt: new Date().toISOString(),
      });
    }
  }

  onSessionStatus(sessionID: string, status: string) {
    const state = this.sessions.get(sessionID);
    if (state && status === 'idle') {
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

    const outcome = state.error ? 'abandoned' : 
      (!state.finalDiff || state.finalDiff.length === 0) ? 'rejected' : 'accepted';

    const evalSession: EvalSession = {
      session_id: sessionID,
      created_at: state.startedAt,
      ended_at: new Date().toISOString(),
      platform: 'opencode',
      model: 'unknown',
      domain: 'coding',
      initial_prompt: null,
      initial_context: {
        context_type: 'files',
        cwd: state.session.directory,
      },
      messages: [],
      final_diff: state.finalDiff?.map(diff => ({
        path: diff.file,
        originalContent: diff.before,
        modifiedContent: diff.after,
        status: 'modified',
      })),
      outcome,
      signals: {
        turn_count: 0,
        user_edits: state.finalDiff?.length || 0,
      },
    };

    appendSession(evalSession);
    console.log('[engram] Session saved:', sessionID, 'outcome:', outcome);
    this.sessions.delete(sessionID);
  }
}