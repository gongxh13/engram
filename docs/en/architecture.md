# Architecture Design

## Monorepo Structure

```
engram/
├── packages/
│   ├── core/                    # Shared core
│   ├── adapter-opencode/        # OpenCode adapter
│   ├── adapter-claude-code/     # Claude Code adapter
│   └── cli/                     # CLI tool
├── apps/
│   └── viewer/                  # Web UI
└── docs/                        # Documentation
```

## Core Modules

### @engram/core

Shared core package:
- EvalSession type definitions
- JSONL read/write functions
- Signal statistics (turn_count, user_edits, etc.)

### adapter-opencode

OpenCode Plugin implementation:
- Listen to session events
- Fetch diffs and messages
- Delegate to core for storage

### adapter-claude-code

Claude Code Hooks implementation:
- SessionStart: record initial state
- Stop: parse transcript JSONL and store

### engram (CLI)

Command-line tool:
- `install` - Install platform adapter
- `list` - List collected sessions
- `export` - Export data
- `replay` - Session replay
- `stats` - Statistics

## Data Flow

1. User starts session in IDE/editor
2. Platform adapter listens to events, creates EvalSession
3. During session: collect messages, diffs, signals
4. On session end: write to JSONL storage
5. User queries/exports data via CLI