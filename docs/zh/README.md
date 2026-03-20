# engram

Agent 任务评估数据集采集系统

[English](./README.md) | 中文

## 特性

- 跨平台数据采集：支持 OpenCode、Claude Code
- 统一数据模型：EvalSession 结构，跨平台兼容
- 轻量存储：JSONL 格式存储会话数据
- CLI 工具：engram 命令行管理采集数据

## 快速开始

```bash
# 安装依赖
pnpm install

# 安装平台适配器
engram install --platform opencode
# 或
engram install --platform claude-code

# 查看已采集的会话
engram list

# 导出数据
engram export --format jsonl
```

## 支持平台

- OpenCode (Plugin 系统)
- Claude Code (Hooks)

## 文档

- [安装指南](./installation.md)
- [使用教程](./usage.md)
- [架构设计](./architecture.md)
- [API 参考](./api.md)

## License

MIT