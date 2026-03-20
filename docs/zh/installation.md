# 安装指南

## 环境要求

- Node.js 18+
- pnpm 8+
- Bun (用于 OpenCode 插件构建)

## 安装步骤

### 1. 安装依赖

```bash
pnpm install
```

### 2. 安装平台适配器

#### OpenCode

```bash
engram install --platform opencode
```

#### Claude Code

```bash
engram install --platform claude-code
```

### 3. 验证安装

```bash
engram list
```

首次运行后，会在 `~/.engram/` 目录下创建数据存储。

## 数据存储位置

- 默认路径: `~/.engram/sessions.jsonl`
- 可通过环境变量 `ENGRAM_DATA_DIR` 自定义