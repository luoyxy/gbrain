# 插件作者指南 (v0.15)#

`gbrain` 通过 `GBRAIN_PLUGIN_PATH` 从外部仓库发现子代理定义。如果你维护一个下游代理（你的 OpenClaw 部署、工作流主机、私有工具）并希望随其附带自定义子代理，请将插件目录放在该环境变量路径上。

本指南面向插件作者。CLI 用户无需阅读此文。

## 最小可行插件#

```
/path/to/my-plugin/
├── gbrain.plugin.json
└── subagents/
    └── my-summarizer.md
```

`gbrain.plugin.json`：

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "plugin_version": "gbrain-plugin-v1"
}
```

`subagents/my-summarizer.md`：

```markdown
---
name: my-summarizer
model: claude-sonnet-4-6
allowed_tools:
  - brain_search
  - brain_get_page
---

你是一个大脑页面总结器。给定一个 slug，获取页面并生成一份 3 句话的摘要。
```

## 启用它 #

```bash
export GBRAIN_PLUGIN_PATH="/path/to/my-plugin"
gbrain jobs work           # worker 启动时打印插件加载行
gbrain agent run "总结会议/2026-04-20" --subagent-def my-summarizer
```

多个插件：冒号分隔，就像 `$PATH` 一样。

```bash
export GBRAIN_PLUGIN_PATH="/path/to/plugin-a:/path/to/plugin-b"
```

## 规则（按设计严格）#

**路径策略。** 仅绝对路径。相对路径、`~` 前缀路径和 URL 风格路径（`https://`、`file://`）都会被拒绝并附带警告。你控制插件在磁盘上的位置；`gbrain` 不会猜测。

**冲突策略。** 如果两个插件附带同名 `name` 的子代理，则 `GBRAIN_PLUGIN_PATH` 中先列出的那个获胜。另一个会被附带警告丢弃，其中会命名两个来源。

**信任策略。** 插件仅在 v0.15 中附带子代理定义：

- 你**不能** 声明新工具。
- 你**不能** 扩展大脑工具允许列表。
- 你**不能** 覆盖任何 `agentSafe` 或类似标志。
- 你的 `allowed_tools:` frontmatter 字段**必须** 是派生的大脑工具注册表的子集。不在注册表中的名称会在插件加载时被拒绝（worker 启动时），而不是在子代理调度时 —— 因此拼写错误会给你一个响亮的启动错误，而不是凌晨 3 点的"工具从未触发"。

v0.16+ 可能会通过单独的合同打开插件声明的工具。不要指望它。

## `gbrain.plugin.json` #

| 字段 | 类型 | 必需 | 备注 |
|---|---|---|---|
| `name` | string | 是 | 人类可读的插件 ID。出现在警告和冲突日志中。 |
| `version` | string | 是 | 你的插件的 semver。信息性的。 |
| `plugin_version` | string | 是 | 合同锁定。对于 v0.15，必须等同于 `"gbrain-plugin-v1"`。 |
| `subagents` | string | 否 | 子目录名称（默认 `"subagents"`）。转义尝试会被拒绝。 |
| `description` | string | 否 | 出现在未来的 `gbrain plugin list` 中。 |

## 子代理定义文件 #

带有 YAML frontmatter 的纯 Markdown。正文是系统提示。frontmatter 控制运行时行为。

已识别的 frontmatter 字段：

| 字段 | 类型 | 必需 | 备注 |
|---|---|---|---|
| `name` | string | 否 | 用作 `--subagent-def` 的子代理标识符。默认默认为文件基本名称。 |
| `model` | string | 否 | Anthropic 模型 ID。默认为处理程序默认值（sonnet）。 |
| `max_turns` | number | 否 | 助手轮次上限。默认为 20。 |
| `allowed_tools` | string[] | 否 | 工具名称允许列表。必须是从 `src/core/tool-registry.ts` 派生的工具注册表的子集。不匹配的名称会在 worker 启动时出错。 |

未知的 frontmatter 字段会被保留但忽略。v0.16 可能会消耗更多。

## 会咬伤你的注意事项 #

1. **插件定义在运行期间不会更改。** 加载器在 worker 启动时读取磁盘一次。编辑子代理定义不会重新生成效果 —— 直到你重新启动 worker。这是故意的 —— 实时重新加载会破坏可崩溃恢复的重放。

2. **`~/.gbrain/audit/subagent-jobs-*.jsonl` 仅是本地的。** 如果你的 worker 在与 `gbrain agent logs` 调用者不同的主机上运行，则 CLI 不会看到心跳。v0.16 将统一此；目前假设 worker + CLI 共享一个文件系统。

3. **工具调用始终以 `ctx.remote = true` 运行。** 即使在本地 CLI 调用上。对网关 `ctx.remote === false` 设置门控的工具（file_upload 的严格禁闭、`put_page` 的命名空间检查）会应用。良好的默认设置；你通过 `allowed_tools:` 选择的任何子代理定义都不能具有超出大脑允许范围的本地文件系统触达 —— 这是设计使然。

4. **`put_page` 写入是命名空间划定范围的。** ID 为 42 的子代理只能写入 `wiki/agents/42/...`。这同时在 frontmatter 中（模型看到的 slug 模式）和服务器端在 `put_page` 操作中（如果 `viaSubagent=true` 则失败关闭，如果 `viaSubagent=true` 则失败关闭）强制执行。不要试图绕过它；你会在 `gbrain agent get <id>` 中得到一个权限错误。

## 示例：下游 OpenClaw 插件 #

```
~/your-openclaw/
└── gbrain-plugin/
    ├── gbrain.plugin.json
    └── subagents/
        ├── meeting-ingestion.md
        ├── signal-detector.md
        └── daily-task-prep.md
```

`~/your-openclaw/gbrain-plugin/gbrain.plugin.json`：

```json
{
  "name": "your-openclaw",
  "version": "2026.4.20",
  "plugin_version": "gbrain-plugin-v1",
  "description": "你的 OpenClaw 个人的大脑子代理"
}
```

环境：

```bash
export GBRAIN_PLUGIN_PATH="$HOME/your-openclaw/gbrain-plugin"
```

然后你的 OpenClaw 调用 `gbrain agent run --subagent-def meeting-ingestion --fanout-by ...` 并且其定义会自动加载。

## 相关 #

- `skills/migrations/v0.32.2.md` — 面向代理的迁移指南
- `CHANGELOG.md` v0.32.2 条目 — 发布宣言
- `scripts/check-system-of-record.sh` — 强制执行规则
