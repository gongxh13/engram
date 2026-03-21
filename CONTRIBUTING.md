# Contributing to engram

## Local Development

### Prerequisites

- Node.js 18+
- pnpm
- OpenCode installed

### Quick Start

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm -r build
```

### Developing @engram/adapter-opencode

```bash
cd packages/adapter-opencode

# First-time setup: build and link to OpenCode plugins directory
npm run link

# Development mode: auto-rebuild on file changes
# (run in separate terminal)
npm run dev

# Test your changes
opencode run "create test.txt with hello"
cat ~/.engram/sessions.jsonl

# When done: remove symlinks
npm run unlink
```

### Project Structure

```
engram/
├── packages/
│   ├── core/                    # Core types and storage
│   │   └── src/
│   │       ├── schema.ts        # EvalSession type definitions
│   │       └── storage.ts       # JSONL read/write utilities
│   │
│   ├── adapter-opencode/        # OpenCode plugin
│   │   └── src/
│   │       ├── plugin.ts        # Plugin entry point
│   │       └── session-tracker.ts  # Session tracking logic
│   │
│   └── adapter-claude-code/     # Claude Code adapter (TODO)
│
├── docs/                        # Documentation
└── pnpm-workspace.yaml          # Workspace config
```

### Adding a New Adapter

1. Create new package under `packages/adapter-<platform>/`
2. Implement plugin that listens to platform events
3. Convert events to `EvalSession` format
4. Use `@engram/core` for storage utilities
5. Update documentation