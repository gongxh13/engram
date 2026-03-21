import type { createOpencodeClient, Session, FileDiff, Message as OpenCodeMessage, AssistantMessage, TextPart, ToolPart, AgentPart } from '@opencode-ai/sdk';

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
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
  messages: Array<{
    role: string;
    content?: string;
    model?: { providerID: string; modelID: string };
    tokens?: { input: number; output: number; reasoning: number };
    toolCalls?: Array<{
      tool: string;
      status: string;
      input?: any;
      output?: any;
      error?: string;
      sub_session_id?: string;
    }>;
  }>;
  final_diff?: Array<{
    path: string;
    originalContent?: string;
    modifiedContent?: string;
    status: string;
  }>;
  signals: {
    turn_count: number;
  };
}

function appendSession(session: EvalSession): void {
  const filePath = join(homedir(), '.engram', 'sessions.json');
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  
  let sessions: EvalSession[] = [];
  if (existsSync(filePath)) {
    try {
      const content = readFileSync(filePath, 'utf-8');
      sessions = JSON.parse(content);
    } catch (e) {
      sessions = [];
    }
  }
  
  sessions.push(session);
  writeFileSync(filePath, JSON.stringify(sessions, null, 2), 'utf-8');
}



interface SessionMessage {
  id: string;
  role: string;
  content?: string;
  model?: { providerID: string; modelID: string };
  tokens?: { input: number; output: number; reasoning: number };
  toolCalls?: Array<{
    tool: string;
    status: string;
    input?: any;
    output?: any;
  }>;
  subAgents?: Array<{
    name: string;
    source?: string;
  }>;
}

interface SessionState {
  session: Session;
  finalDiff?: FileDiff[];
  startedAt: string;
  turnCount: number;
  model?: string;
  messages: SessionMessage[];
  messageParts: Map<string, (TextPart | ToolPart | AgentPart)[]>;
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
      turnCount: 0,
      messages: [],
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
        turnCount: 0,
        messages: [],
        messageParts: new Map(),
      });
    }
  }

  onMessageUpdated(message: OpenCodeMessage) {
    const state = this.sessions.get(message.sessionID);
    if (!state) return;

    const existingMsgIdx = state.messages.findIndex(m => m.id === message.id);

    if (message.role === 'user') {
      if (existingMsgIdx < 0) {
        state.turnCount += 1;
        
        const parts = state.messageParts.get(message.id);
        const textPart = parts?.find((p) => p.type === 'text');
        
        state.messages.push({
          id: message.id,
          role: 'user',
          content: textPart?.text || '',
        });
      }
    }

    if (message.role === 'assistant') {
      const assistantMsg = message as AssistantMessage;
      
      if (existingMsgIdx >= 0) {
        state.messages[existingMsgIdx].tokens = assistantMsg.tokens;
      } else {
        state.messages.push({
          id: message.id,
          role: 'assistant',
          model: { providerID: assistantMsg.providerID, modelID: assistantMsg.modelID },
          tokens: assistantMsg.tokens,
        });
      }
      
      if (assistantMsg.providerID && assistantMsg.modelID && !state.model) {
        state.model = `${assistantMsg.providerID}@${assistantMsg.modelID}`;
      }
    }
  }

  onMessagePartUpdated(part: TextPart | ToolPart | AgentPart) {
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

    const msg = state.messages.find(m => m.id === part.messageID);
    if (!msg) return;

    if (part.type === 'text') {
      const allText = parts.filter(p => p.type === 'text').map(p => (p as TextPart).text).join('');
      msg.content = allText;
    } else if (part.type === 'tool') {
      const toolPart = part as ToolPart;
      if (!msg.toolCalls) {
        msg.toolCalls = [];
      }
      const toolState = toolPart.state as any;
      const status = toolState?.status || 'unknown';
      
      const existingIdx = msg.toolCalls.findIndex((t: any) => 
        t.tool === toolPart.tool && 
        (t.status === 'pending' || t.status === 'running' || t.status === 'unknown') &&
        !t.sub_session_id
      );
      
      if (status === 'pending' || existingIdx < 0) {
        const toolCall: any = {
          tool: toolPart.tool,
          status,
          input: toolState?.input,
          output: toolState?.output,
        };
        if (status === 'error' && toolState?.error) {
          toolCall.error = toolState.error;
        }
        if (toolPart.tool === 'task' && toolCall.output) {
          const match = toolCall.output.match(/task_id:\s*(ses_[a-zA-Z0-9]+)/);
          if (match) {
            toolCall.sub_session_id = match[1];
          }
        }
        msg.toolCalls.push(toolCall);
      } else {
        const tc = msg.toolCalls[existingIdx] as any;
        tc.status = status;
        tc.output = toolState?.output;
        if (status === 'error' && toolState?.error) {
          tc.error = toolState.error;
        }
        if (toolPart.tool === 'task' && tc.output) {
          const match = tc.output.match(/task_id:\s*(ses_[a-zA-Z0-9]+)/);
          if (match) {
            tc.sub_session_id = match[1];
          }
        }
      }
    }
    
    if (part.type === 'agent') {
      console.log('agent part:', JSON.stringify(part));
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

  private finalizeSession(sessionID: string) {
    const state = this.sessions.get(sessionID);
    if (!state) return;

    const firstUserMsg = state.messages.find(m => m.role === 'user');
    let initialPrompt = firstUserMsg?.content || null;
    if (initialPrompt) {
      initialPrompt = initialPrompt.replace(/^["']|["']/g, '').trim();
    }

    const evalSession: EvalSession = {
      session_id: sessionID,
      created_at: state.startedAt,
      updated_at: new Date(state.session.time.updated).toISOString(),
      platform: 'opencode',
      model: state.model || 'unknown',
      initial_prompt: initialPrompt,
      initial_context: {
        context_type: 'files',
        cwd: state.session.directory,
      },
      messages: state.messages,
      final_diff: state.finalDiff?.map((diff) => ({
        path: diff.file,
        originalContent: diff.before,
        modifiedContent: diff.after,
        status: 'modified',
      })),
      signals: {
        turn_count: state.turnCount,
      },
    };

    appendSession(evalSession);
    this.sessions.delete(sessionID);
  }
}