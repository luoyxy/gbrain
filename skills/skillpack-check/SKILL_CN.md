---
name: skillpack-check
version: 1.0.0
description: |
  运行 `gbrain skillpack-check` 为gbrain安装生成代理可读的JSON健康报告。
  包装 `gbrain doctor` + `gbrain apply-migrations --list`，
  以便主机代理（你的OpenClaw的morning-briefing、任何OpenClaw cron）
  可以一目了然地查看skillpack是否需要关注。

  当用户询问"gbrain健康吗？"、cron触发早晨检查时，
  或主动在某些事情看起来不对时使用（作业未运行、brain未更新、autopilot静默）。
triggers:
  - "skillpack check"
  - "is gbrain healthy"
  - "gbrain health"
  - "check the brain"
  - "is the brain working"
tools:
  - shell
mutating: false
---

# Skillpack 检查

## 契约

运行 `gbrain skillpack-check` 返回带有以下内容的JSON报告：

- **`healthy`** (bool): 如果不需要操作则为true。
- **`summary`** (string): 可以在简报中安全引用的一行摘要。
- **`actions`** (string[]): 每个修复命令。如果非空，运行它们。
- **`doctor`**: 完整的 `gbrain doctor --fast --json` 输出（文件系统检查）。
- **`migrations`**: 来自 `apply-migrations --list` 的已应用/待定/部分计数。

退出代码：
- `0` — 健康，无需操作。
- `1` — 需要操作。读取 `actions[]` 并执行。
- `2` — 无法确定（二进制崩溃或缺少子命令）。调查。

## 何时运行

- **每日cron**（例如你的OpenClaw的 `morning-briefing`）: `gbrain skillpack-check --quiet`。
  仅退出代码告诉你是否有错误；仅在退出 != 0时在
  简报中显示一行。在happy-path简报中没有JSON噪音。
- **按需**: 调试时使用 `gbrain skillpack-check` 获取完整JSON。
- **在CI管道中**: 相同模式 — 退出代码门控，JSON是证据。

## 如何处理输出

### 正常路径（`healthy: true`）

仅在被询问时在代理输出中显示摘要。没有其他的。

### 需要操作（`healthy: false`）

`actions[]` 数组包含要按顺序运行的命令。执行它们：

```bash
for cmd in $(echo "$REPORT" | jq -r '.actions[]'); do
  eval "$cmd"
done
```

常见的 `actions[]` 条目及其含义：

- `gbrain apply-migrations --yes` — 迁移待定或半完成。
  运行此命令（它是幂等的）。如果退出 `status: "partial"`，主机有
  需要插件注册的非内置cron处理程序 — 遵循
  `skills/migrations/v0.11.0.md`。
- `gbrain embed --stale` — 嵌入已过时。
- `gbrain check-backlinks --fix` — 死链接或缺少反向链接。
- 自由文本操作（源消息中没有 `Run:` 前缀）— 需要代理判断。
  在报告中引用它给用户。

### 确定失败（`exit 2`）

视为紧急。可能意味着gbrain二进制文件从 `$PATH` 中丢失或
必需的子命令崩溃。检查：

1. `which gbrain` 返回路径
2. `gbrain --version` 退出0
3. `~/.gbrain/` 可访问

## 输出格式

```json
{
  "version": "0.11.1",
  "ts": "2026-04-18T12:34:56.789Z",
  "healthy": false,
  "summary": "gbrain skillpack needs attention: 1 action(s) — gbrain apply-migrations --yes",
  "actions": ["gbrain apply-migrations --yes"],
  "doctor": {
    "exit_code": 1,
    "checks": [
      { "name": "minions_migration", "status": "fail", "message": "MINIONS HALF-INSTALLED (partial migration: 0.11.0). Run: gbrain apply-migrations --yes" }
    ]
  },
  "migrations": {
    "applied_count": 0,
    "pending_count": 0,
    "partial_count": 1,
    "stdout": "..."
  }
}
```

## 反模式

- ❌ 在发送其输出的cron中运行而不使用 `--quiet` — 你会在
  每封每日电子邮件中收到完整的JSON blob。在cron中使用 `--quiet`。
- ❌ 忽略退出代码2。崩溃的doctor比失败的检查更糟糕，
  因为你甚至不知道出了什么问题。
- ❌ 在每次聊天轮次运行。每小时一次（或按用户请求）就足够了。
- ❌ 将警告视为失败。只有 `fail` 状态需要操作；
  `warn` 是信息性的。

## 输出格式

技能本身不写入文件；它将CLI输出逐字报告给
用户（或代理的简报管道）。首先是一行摘要，
然后是操作列表，然后（仅当相关时）完整的JSON用于调试。

## 相关

- `gbrain doctor` — 底层文件系统和数据库检查。skillpack-check
  组合此。
- `gbrain apply-migrations --list` — 迁移状态视图。
- `skills/migrations/v0.11.0.md` — 解决 `pending-host-work.jsonl` 项目的
  主机代理指令手册。
- `docs/guides/minions-fix.md` — 对半迁移安装的故障排除。
