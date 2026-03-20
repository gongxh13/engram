# 使用教程

## CLI 命令

### 安装平台适配器

```bash
engram install --platform <platform>
```

Options:
- `opencode` - OpenCode 插件
- `claude-code` - Claude Code Hooks

### 查看会话列表

```bash
engram list
```

### 导出数据

```bash
engram export --format jsonl
engram export --format csv
```

Options:
- `--format` - 输出格式 (jsonl, csv)
- `--output` - 输出文件路径

### 会话回放

```bash
engram replay <session-id>
```

### 统计信息

```bash
engram stats
```

显示采集会话的统计信息，包括平台分布、模型使用等。

## 数据格式

采集的会话数据为 JSONL 格式，每行一个 JSON 对象：

```json
{
  "session_id": "xxx",
  "created_at": "2024-01-01T00:00:00Z",
  "platform": "opencode",
  "model": "claude-sonnet-4-5",
  "messages": [...],
  "outcome": "accepted"
}
```