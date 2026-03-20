# @engram/adapter-opencode

OpenCode platform adapter for engram.

## Installation

```bash
pnpm install
pnpm build
```

## Usage

Add to your `opencode.json`:

```json
{
  "plugin": ["@engram/adapter-opencode"]
}
```

Or use as a local plugin by placing the built file in `~/.config/opencode/plugins/`.

## Events Handled

- `session.created` - Session creation
- `session.updated` - Session updates
- `message.updated` - Message updates
- `session.diff` - File diff updates
- `session.idle` - Session completion
- `session.deleted` - Session deletion
- `session.error` - Session errors

## Data Collected

- Session metadata (id, created_at, ended_at, model)
- Initial prompt
- Git context (branch, commit, cwd)
- Messages (conversation history)
- File diffs (all changes)
- Signals (turn_count, user_edits, time_to_accept)