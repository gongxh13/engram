# API 参考

## EvalSession 类型

```typescript
interface EvalSession {
  // 元信息
  session_id: string;
  created_at: string;
  ended_at?: string;
  platform: "opencode" | "claude-code" | string;
  model: string;
  domain?: string;

  // 初始状态
  initial_prompt: string | null;
  initial_context?: {
    context_type: "files" | "documents" | "none";
    git_branch?: string;
    git_commit?: string;
    cwd?: string;
  };

  // 对话历史
  messages: ConversationMessage[];

  // 最终状态
  final_diff?: FileDiff[];
  outcome: "accepted" | "modified" | "rejected" | "abandoned";

  // 行为信号
  signals: {
    turn_count: number;
    user_edits: number;
    time_to_accept?: number;
    tool_calls?: number;
  };

  // 人工标注
  annotations?: {
    quality_score?: 1 | 2 | 3 | 4 | 5;
    tags?: string[];
    notes?: string;
  };
}
```

## 核心函数

### appendSession(session, path?)

将会话写入 JSONL 存储。

```typescript
import { appendSession } from '@engram/core';

appendSession(session);
```

### readSessions(path?)

读取所有会话。

```typescript
import { readSessions } from '@engram/core';

const sessions = readSessions();
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| ENGRAM_DATA_DIR | 数据存储目录 | ~/.engram |