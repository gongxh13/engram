# Usage Guide

## CLI Commands

### Install Platform Adapter

```bash
engram install --platform <platform>
```

Options:
- `opencode` - OpenCode plugin
- `claude-code` - Claude Code Hooks

### List Sessions

```bash
engram list
```

### Export Data

```bash
engram export --format jsonl
engram export --format csv
```

Options:
- `--format` - Output format (jsonl, csv)
- `--output` - Output file path

### Replay Session

```bash
engram replay <session-id>
```

### Statistics

```bash
engram stats
```

Shows collected session statistics including platform distribution, model usage, etc.

## Data Format

Collected session data is in JSONL format, one JSON object per line:

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