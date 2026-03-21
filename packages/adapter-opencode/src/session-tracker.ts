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
    toolCalls?: any[];
  }>;
  sub_sessions?: Array<{
    id: string;
    messages: any[];
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

function loadSubSessionMessages(subSessionID: string): any[] {
  const messages: any[] = [];
  const msgDir = join(homedir(), '.local/share/opencode/storage/message', subSessionID);
  
  if (!existsSync(msgDir)) {
    return messages;
  }

  try {
    const files = readdirSync(msgDir).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      try {
        const content = readFileSync(join(msgDir, file), 'utf-8');
        const msg = JSON.parse(content);
        
        const msgData: any = {
          id: msg.id,
          role: msg.role,
        };
        
        if (msg.role === 'user') {
          msgData.content = msg.summary?.body || msg.summary?.title || '';
        } else if (msg.role === 'assistant') {
          msgData.model = msg.model;
          msgData.tokens = msg.tokens;
          
          const partsDir = join(homedir(), '.local/share/opencode/storage/part', subSessionID, msg.id);
          if (existsSync(partsDir)) {
            const partFiles = readdirSync(partsDir).filter(f => f.endsWith('.json'));
            let textContent = '';
            const toolCalls: any[] = [];
            
            for (const pf of partFiles) {
              try {
                const pcontent = readFileSync(join(partsDir, pf), 'utf-8');
                const part = JSON.parse(pcontent);
                
                if (part.type === 'text') {
                  textContent += part.text;
                } else if (part.type === 'tool') {
                  toolCalls.push({
                    tool: part.tool,
                    status: part.state?.status || 'unknown',
                    input: part.state?.input,
                    output: part.state?.output,
                  });
                }
              } catch (e) {}
            }
            
            msgData.content = textContent;
            if (toolCalls.length > 0) {
              msgData.toolCalls = toolCalls;
            }
          }
        }
        
        messages.push(msgData);
      } catch (e) {}
    }
  } catch (e) {}

  return messages;
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

    const subSessions: Array<{ id: string; messages: any[] }> = [];
    for (const msg of state.messages) {
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          if (tc.tool === 'task' && tc.output) {
            const match = tc.output.match(/task_id:\s*(ses_[a-zA-Z0-9]+)/);
            if (match) {
              const subSessionID = match[1];
              const subMessages = loadSubSessionMessages(subSessionID);
              if (subMessages.length > 0) {
                subSessions.push({
                  id: subSessionID,
                  messages: subMessages,
                });
              }
            }
          }
        }
      }
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
      sub_sessions: subSessions.length > 0 ? subSessions : undefined,
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