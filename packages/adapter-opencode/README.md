# @engram/adapter-opencode

OpenCode 平台适配器，用于采集 OpenCode 会话数据。

## 安装

在 `opencode.json` 中添加配置：

```json
{
  "plugin": ["@engram/adapter-opencode"]
}
```

OpenCode 启动时会自动安装插件。

## 本地开发

为贡献者提供的本地开发指南：

```bash
cd packages/adapter-opencode

# 首次设置：构建并创建符号链接
npm run link

# 开发模式：保持运行，自动重新构建代码
npm run dev

# 完成开发后：移除符号链接
npm run unlink
```

测试方法：
```bash
opencode run "create test.txt with hello"
cat ~/.engram/sessions.jsonl
```

数据将保存到 `~/.engram/sessions.jsonl`。