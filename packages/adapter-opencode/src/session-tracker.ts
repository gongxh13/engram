import type { createOpencodeClient } from '@opencode-ai/sdk';
import type { Session, Message, Part, FileDiff } from '@opencode-ai/sdk';

interface SessionState {
  session: Session;
  messages: Message[];
  finalDiff?: FileDiff[];
  initialPrompt?: string;
  model?: string;
  error?: string;
  startedAt: string;
}

type OpenCodeClient = ReturnType<typeof createOpencodeClient>;

export class SessionTracker {
  private sessions = new Map<string, SessionState>();
  private client: OpenCodeClient;

  constructor(client: OpenCodeClient) {
    this.client = client;
  }

  async onSessionCreated(sessionID: string, session: Session) {
    const vcsInfo = await this.client.vcs.info().catch(() => null);
    
    this.sessions.set(sessionID, {
      session,
      messages: [],
      startedAt: new Date().toISOString(),
    });

    // Get initial messages
    const messagesResp = await this.client.session.messages({ 
      path: { id: sessionID } 
    });
    
    const state = this.sessions.get(sessionID);
    if (state && messagesResp.data) {
      state.messages = messagesResp.data.map(m => m.info);
      state.initialPrompt = messagesResp.data[0]?.parts?.[0]?.text;
      state.model = session.model;
    }
  }

  async onSessionUpdated(sessionID: string, properties: Record<string, unknown>) {
    const state = this.sessions.get(sessionID);
    if (state && properties.title) {
      state.session.title = properties.title as string;
    }
  }

  async onMessageDone(sessionID: string, messageID: string) {
    const state = this.sessions.get(sessionID);
    if (!state) return;

    try {
      const msgResp = await this.client.session.message({ 
        path: { id: sessionID, messageID } 
      });
      
      if (msgResp.data) {
        const existingIndex = state.messages.findIndex(m => m.id === messageID);
        if (existingIndex >= 0) {
          state.messages[existingIndex] = msgResp.data.info;
        } else {
          state.messages.push(msgResp.data.info);
        }
      }
    } catch (error) {
      console.error('Failed to fetch message:', error);
    }
  }

  onSessionDiff(sessionID: string, diff: FileDiff[]) {
    const state = this.sessions.get(sessionID);
    if (state) {
      state.finalDiff = diff;
    }
  }

  onSessionError(sessionID: string, error: string) {
    const state = this.sessions.get(sessionID);
    if (state) {
      state.error = error;
    }
  }

  async finalizeSession(sessionID: string) {
    const state = this.sessions.get(sessionID);
    if (!state) return null;

    try {
      // Get final diff if not already captured
      if (!state.finalDiff) {
        const diffResp = await this.client.session.diff({ 
          path: { id: sessionID } 
        });
        state.finalDiff = diffResp.data;
      }

      // Get final messages
      const messagesResp = await this.client.session.messages({ 
        path: { id: sessionID } 
      });
      
      if (messagesResp.data) {
        state.messages = messagesResp.data.map(m => m.info);
      }

      const evalSession = this.convertToEvalSession(state, sessionID);
      this.sessions.delete(sessionID);
      
      return evalSession;
    } catch (error) {
      console.error('Failed to finalize session:', error);
      return null;
    }
  }

  private convertToEvalSession(state: SessionState, sessionID: string) {
    const endTime = state.session.updatedAt || new Date().toISOString();
    const startTime = state.startedAt;
    const timeToAccept = state.session.status === 'completed' 
      ? (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000 
      : undefined;

    const outcome = this.determineOutcome(state);

    return {
      session_id: sessionID,
      created_at: startTime,
      ended_at: endTime,
      platform: 'opencode',
      model: state.model || 'unknown',
      domain: 'coding',
      initial_prompt: state.initialPrompt || null,
      initial_context: {
        context_type: 'files',
        git_branch: state.session.gitBranch,
        git_commit: state.session.gitCommit,
        cwd: state.session.directory,
      },
      messages: state.messages.map(msg => this.convertMessage(msg)),
      final_diff: state.finalDiff,
      outcome,
      signals: {
        turn_count: state.messages.filter(m => m.role === 'assistant').length,
        user_edits: state.finalDiff?.length || 0,
        time_to_accept: timeToAccept,
      },
    };
  }

  private determineOutcome(state: SessionState): 'accepted' | 'modified' | 'rejected' | 'abandoned' {
    if (state.error) return 'abandoned';
    if (!state.finalDiff || state.finalDiff.length === 0) return 'rejected';
    return 'accepted';
  }

  private convertMessage(message: Message) {
    return {
      id: message.id,
      role: message.role,
      createdAt: message.createdAt,
      status: message.status,
    };
  }
}
