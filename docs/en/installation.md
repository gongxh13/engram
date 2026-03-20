# Installation Guide

## Requirements

- Node.js 18+
- pnpm 8+
- Bun (for OpenCode plugin build)

## Installation

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Install Platform Adapter

#### OpenCode

```bash
engram install --platform opencode
```

#### Claude Code

```bash
engram install --platform claude-code
```

### 3. Verify Installation

```bash
engram list
```

After first run, data will be stored in `~/.engram/`.

## Data Storage Location

- Default: `~/.engram/sessions.jsonl`
- Customize via `ENGRAM_DATA_DIR` environment variable