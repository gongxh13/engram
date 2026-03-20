import type { createOpencodeClient } from '@opencode-ai/sdk';
import type { Session, Message, Part, FileDiff } from '@opencode-ai/sdk';
import { appendSession } from '@engram/core';
import type { EvalSession } from '@engram/core';

interface SessionState {
  session: Session;
  messages: Message[];
  finalDiff?: FileDiff[];
  startedAt: string;
  error?: string;
}

type OpenCodeClient = ReturnType<typeof createOpencodeClient>;

export class SessionTracker {
  private sessions = new Map<string, SessionState>();
  private client: OpenCodeClient;

  constructor(client: OpenCodeClient) {
    this.client = client;
  }

  onSessionCreated(session: Session) {
    this.sessions.set(session.id, {
      session,
      messages: [],
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
        messages: [],
        startedAt: new Date().toISOString(),
      });
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

  async finalizeSession(sessionID: string) {
    const state = this.sessions.get(sessionID);
    if (!state) return;

    try {
      // Get final messages
      const messagesResp = await this.client.session.messages({ 
        path: { id: sessionID } 
      });
      
      if (messagesResp.data) {
        state.messages = messagesResp.data.map(m => m.info);
      }

      // Get final diff
      if (!state.finalDiff) {
        const diffResp = await this.client.session.diff({ 
          path: { id: sessionID } 
        });
        state.finalDiff = diffResp.data;
      }

      const evalSession = this.convertToEvalSession(state, sessionID);
      appendSession(evalSession);
      this.sessions.delete(sessionID);
    } catch (err) {
      console.error('Failed to finalize session:', err);
    }
  }

  private convertToEvalSession(state: SessionState, sessionID: string): EvalSession {
    const endTime = state.session.time?.updated 
      ? new Date(state.session.time.updated).toISOString()
      : new Date().toISOString();
    const startTime = state.startedAt;

    const outcome = this.determineOutcome(state);

    // Get initial prompt from first user message
    const firstUserMsg = state.messages.find(m => m.role === 'user');
    const initialPrompt = firstUserMsg ? this.extractPromptFromMessage(firstUserMsg) : null;

    return {
      session_id: sessionID,
      created_at: startTime,
      ended_at: endTime,
      platform: 'opencode',
      model: 'unknown',
      domain: 'coding',
      initial_prompt: initialPrompt,
      initial_context: {
        context_type: 'files',
        cwd: state.session.directory,
      },
      messages: state.messages.map(msg => this.convertMessage(msg)),
      final_diff: state.finalDiff?.map(diff => this.convertFileDiff(diff)),
      outcome,
      signals: {
        turn_count: state.messages.filter(m => m.role === 'assistant').length,
        user_edits: state.finalDiff?.length || 0,
      },
    };
  }

  private extractPromptFromMessage(message: Message): string {
    const msg = message as any;
    if (msg.parts && Array.isArray(msg.parts)) {
      const textPart = msg.parts.find((p: Part) => p.type === 'text');
      if (textPart && 'text' in textPart) {
        return textPart.text || '';
      }
    }
    return '';
  }

  private determineOutcome(state: SessionState): 'accepted' | 'modified' | 'rejected' | 'abandoned' {
    if (state.error) return 'abandoned';
    if (!state.finalDiff || state.finalDiff.length === 0) return 'rejected';
    return 'accepted';
  }

  private convertMessage(message: Message) {
    const msg = message as any;
    return {
      id: message.id,
      role: message.role,
      createdAt: msg.time?.created ? String(msg.time.created) : undefined,
    };
  }

  private convertFileDiff(diff: FileDiff) {
    return {
      path: diff.file,
      originalContent: diff.before,
      modifiedContent: diff.after,
      status: 'modified' as const,
    };
  }
}
