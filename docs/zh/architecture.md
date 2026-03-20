# 架构设计

## Monorepo 结构

```
engram/
├── packages/
│   ├── core/                    # 共享核心
│   ├── adapter-opencode/        # OpenCode 适配器
│   ├── adapter-claude-code/     # Claude Code 适配器
│   └── cli/                     # CLI 工具
├── apps/
│   └── viewer/                  # Web 界面
└── docs/                        # 文档
```

## 核心模块

### @engram/core

共享核心包，提供：
- EvalSession 类型定义
- JSONL 读写功能
- 信号统计 (turn_count, user_edits 等)

### adapter-opencode

OpenCode Plugin 实现：
- 监听会话事件
- 拉取 diff 和 messages
- 委托 core 写入存储

### adapter-claude-code

Claude Code Hooks 实现：
- SessionStart: 记录初始状态
- Stop: 解析 transcript JSONL 并存储

### engram (CLI)

命令行工具：
- `install` - 安装平台适配器
- `list` - 列出采集的会话
- `export` - 导出数据
- `replay` - 会话回放
- `stats` - 统计信息

## 数据流

1. 用户在 IDE/编辑器中开始会话
2. 平台适配器监听事件，创建 EvalSession
3. 会话过程中收集 messages、diff、signals
4. 会话结束时写入 JSONL 存储
5. 用户通过 CLI 查询/导出数据