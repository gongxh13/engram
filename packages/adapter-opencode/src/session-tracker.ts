import type { createOpencodeClient, Session, FileDiff, Message as OpenCodeMessage, AssistantMessage, TextPart, ToolPart, AgentPart } from '@opencode-ai/sdk';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
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
      const existingToolIdx = msg.toolCalls.findIndex(t => t.tool === toolPart.tool);
      const toolCall = {
        tool: toolPart.tool,
        status: (toolPart.state as any)?.status || 'unknown',
        input: (toolPart.state as any)?.input,
        output: (toolPart.state as any)?.output,
      };
      if (existingToolIdx >= 0) {
        msg.toolCalls[existingToolIdx] = toolCall;
      } else {
        msg.toolCalls.push(toolCall);
      }
    } else if (part.type === 'agent') {
      const agentPart = part as AgentPart;
      if (!msg.subAgents) {
        msg.subAgents = [];
      }
      const subAgent = {
        name: agentPart.name,
        source: agentPart.source?.value,
      };
      const existingIdx = msg.subAgents.findIndex(a => a.name === agentPart.name);
      if (existingIdx >= 0) {
        msg.subAgents[existingIdx] = subAgent;
      } else {
        msg.subAgents.push(subAgent);
      }
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