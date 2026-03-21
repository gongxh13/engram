# engram

Agent Task Evaluation Data Collection System

[English](./docs/en/README.md) | [中文](./docs/zh/README.md)

## Features

- Cross-platform data collection: OpenCode, Claude Code
- Unified data model: EvalSession structure, cross-platform compatible
- Lightweight storage: JSONL format for session data
- CLI tool: engram command to manage collected data

## Quick Start

```bash
# Install dependencies
pnpm install

# Install platform adapter
engram install --platform opencode
# or
engram install --platform claude-code

# List collected sessions
engram list

# Export data
engram export --format jsonl
```

## Supported Platforms

- OpenCode (Plugin system)
- Claude Code (Hooks)

## Documentation

- [Installation](./docs/installation.md)
- [Usage](./docs/usage.md)
- [Architecture](./docs/architecture.md)
- [API Reference](./docs/api.md)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local development setup.

## License

MIT