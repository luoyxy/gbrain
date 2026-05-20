# 小型代理修复 — 修复半迁移的安装#

**简而言之：** 在 v0.11.1+ 版本上，一切都应该自动修复。如果 Minions 部分设置（没有 `~/.gbrain/preferences.json`，autopilot 仍是内联的，cron 作业仍在 `agentTurn` 上），请运行：

```bash
gbrain apply-migrations --yes
```

这是幂等的。在已经迁移的 v0.11.1 安装上，这是一个低成本的无操作。

## 背景

v0.11.0 发布了 Minions 模式、队列、worker 和迁移技能 — 但迁移技能本身在升级时从未触发。`runPostUpgrade` 打印了功能介绍就停止了。v0.11.0 从未公开发布；v0.11.1 是第一个公开的 Minions 版本，修复了这个重大错误（迁移在 `gbrain upgrade` 和 `postinstall` 钩子时自动触发）。

如果你在使用 v0.11.1 之前的分支构建（例如在 v0.11.1 标记之前的 `minions-jobs` 分支），Minions 可能已安装但未连接：模式是 v7，但没有 `~/.gbrain/preferences.json`，autopilot 仍内联运行，cron 作业仍调用 `agentTurn`。

本指南涵盖两种路径：规范的 v0.11.1+ 修复，以及适用于没有 `apply-migrations` 的 v0.11.1 之前二进制文件的临时解决方案。

## 检测半迁移状态

```bash
gbrain doctor
```

如果安装是半迁移的，你会看到：

```
[FAIL] minions_migration: MINIONS HALF-INSTALLED (partial migration: 0.11.0). Run: gbrain apply-migrations --yes
```

或

```
[FAIL] minions_config: MINIONS HALF-INSTALLED (schema v7+ but no ~/.gbrain/preferences.json). Run: gbrain apply-migrations --yes
```

对于机器可读的报告（cron 友好）：

```bash
gbrain skillpack-check --quiet && echo healthy || echo needs_action
gbrain skillpack-check | jq -r '.actions[]'    # 打印要运行的确切命令
```

## 修复（v0.11.1 或更高版本）

```bash
gbrain apply-migrations --yes
```

读取 `~/.gbrain/migrations/completed.jsonl`，与 TS 迁移注册表对比，运行所有待处理的操作。七个阶段：

```
A. 模式        gbrain init --migrate-only
B. 冒烟测试    gbrain jobs smoke
C. 模式        提示（或 --yes 默认 pain_triggered）
D. 首选项      写入 ~/.gbrain/preferences.json
E. 主机        AGENTS.md 标记注入 + gbrain 内置的 cron 重写；
               主机特定处理程序的 JSONL TODO
F. 安装        gbrain autopilot --install（环境感知）
G. 记录        追加 completed.jsonl status:"complete"
```

如果阶段 E 发出主机特定处理程序的 TODO（例如你的 OpenClaw 的 ~29 个非 gbrain cron），迁移将以 `status: "partial"` 完成。你的主机代理使用 `skills/migrations/v0.11.0.md` + `docs/guides/plugin-handlers.md` 遍历 TODO，在主机仓库中交付处理程序注册，然后重新运行 `gbrain apply-migrations --yes`。新可注册 cron 条目被重写，JSONL 行标记为 `status: "complete"`。

## 临时解决方案（v0.11.1 之前的二进制文件，还没有 apply-migrations）

如果你卡在没有 `apply-migrations` 的分支构建上：

```bash
curl -fsSL https://raw.githubusercontent.com/garrytan/gbrain/v0.11.1/scripts/fix-v0.11.0.sh | bash
```

这个 bash 脚本从 shell 环境中执行 apply-migrations 的功能：

1. `gbrain init --migrate-only` — 模式 v7。
2. `gbrain jobs smoke` — 验证 Minions 健康状态。
3. 提示 `minion_mode`（在非 TTY 上默认为 `pain_triggered`）。
4. 原子写入 `~/.gbrain/preferences.json`。
5. 追加 `~/.gbrain/migrations/completed.jsonl`，`status: "partial"` 和 `apply_migrations_pending: true`。这个部分记录是 v0.11.1 的 `apply-migrations` 在用户升级后接管剩余阶段的信号。
6. 检测主机代理仓库并打印重写指令（从 curl 管道脚本永远不会自动编辑）。
7. 打印下一步：`Run: gbrain autopilot --install`。

一旦安装了 v0.11.1，重新运行 `gbrain apply-migrations --yes` 以完成剩余阶段（主机重写 + autopilot 安装）。临时解决方案的 `status: "partial"` 记录被设计为干净地恢复（它不会污染永久迁移路径）。

## 验证修复已生效

```bash
# 1. 首选项存在且可读
cat ~/.gbrain/preferences.json

# 2. 迁移已记录
cat ~/.gbrain/migrations/completed.jsonl

# 3. Autopilot 正在监督 Minions worker 子进程
gbrain autopilot --status
ps aux | grep 'jobs work'

# 4. 作业显示在队列中
gbrain jobs list

# 5. 任何仍待处理的主机特定 TODO
cat ~/.gbrain/migrations/pending-host-work.jsonl 2>/dev/null || echo "(none — all host work is done)"

# 6. Doctor + skillpack-check 都应该干净
gbrain doctor
gbrain skillpack-check --quiet && echo ok
```

## 如果修复失败

每个阶段都是幂等的。重新运行是安全的。常见失败模式：

- **阶段 B 冒烟测试失败：** 模式未应用。检查 `~/.gbrain/config.json` 是否有有效的 `database_url`（或 PGLite 的 `database_path`）。直接运行 `gbrain init --migrate-only` 并查看错误。
- **阶段 F 安装失败：** 你的主机环境与任何检测到的目标不匹配。显式传递 `--target <macos|linux-systemd|ephemeral-container|linux-cron>`。
- **待处理的主机工作从未清除：** 你的主机代理尚未交付处理程序注册。读取 `~/.gbrain/migrations/pending-host-work.jsonl`，打开 `skills/migrations/v0.11.0.md`，并遵循主机代理指令手册。

## 相关文档

- `skills/migrations/v0.11.0.md` — 主机代理的完整迁移技能。
- `skills/skillpack-check/SKILL.md` — 何时及如何运行健康检查。
- `docs/guides/plugin-handlers.md` — 主机特定处理程序的插件契约。
- `skills/conventions/cron-via-minions.md` — 规范的 cron 重写模式。
