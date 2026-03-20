# API Reference

## EvalSession Type

```typescript
interface EvalSession {
  // Metadata
  session_id: string;
  created_at: string;
  ended_at?: string;
  platform: "opencode" | "claude-code" | string;
  model: string;
  domain?: string;

  // Initial state
  initial_prompt: string | null;
  initial_context?: {
    context_type: "files" | "documents" | "none";
    git_branch?: string;
    git_commit?: string;
    cwd?: string;
  };

  // Conversation history
  messages: ConversationMessage[];

  // Final state
  final_diff?: FileDiff[];
  outcome: "accepted" | "modified" | "rejected" | "abandoned";

  // Behavioral signals
  signals: {
    turn_count: number;
    user_edits: number;
    time_to_accept?: number;
    tool_calls?: number;
  };

  // Human annotations
  annotations?: {
    quality_score?: 1 | 2 | 3 | 4 | 5;
    tags?: string[];
    notes?: string;
  };
}
```

## Core Functions

### appendSession(session, path?)

Write session to JSONL storage.

```typescript
import { appendSession } from '@engram/core';

appendSession(session);
```

### readSessions(path?)

Read all sessions.

```typescript
import { readSessions } from '@engram/core';

const sessions = readSessions();
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| ENGRAM_DATA_DIR | Data storage directory | ~/.engram |