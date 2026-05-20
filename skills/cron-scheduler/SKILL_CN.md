---
name: cron-scheduler
version: 1.0.0
description: |
  具有交错、安静时间和唤醒覆盖的调度管理。
  验证调度，防止冲突，并在安静时间期间门控交付。
triggers:
  - "schedule a job"
  - "cron"
  - "quiet hours"
  - "what jobs are running"
tools:
  - search
  - get_page
  - put_page
mutating: true
---

# 定时任务调度器

> **约定：** 参见 `skills/conventions/test-before-bulk.md` — 首先在 3-5 个项目上测试每个定时任务。

## 合约

此技能保证：

- 调度交错：每 5 分钟时段最多 1 个作业，无冲突
- 安静时间门控：时区感知，带用户唤醒覆盖
- 精简作业提示：作业说"读取 skills/X/SKILL.md 并运行它"（无内联 3000 字提示）
- 幂等性：作业可以运行两次而不会产生重复的副作用
- 结果保存为报告：`reports/{job-name}/{YYYY-MM-DD-HHMM}.md`

## 阶段

1. **定义作业。** 名称、调度（cron 表达式）、要运行的技能、超时。
2. **验证调度。** 检查与现有作业无冲突（5 分钟偏移规则）。
   - 时段：:05、:10、:15、:20、:25、:30、:35、:40、:45、:50
   - 如果检测到冲突，建议下一个可用时段
3. **检查安静时间。** 默认：当地时间晚上 11 点 - 上午 8 点。
   - 覆盖：用户唤醒标志（如果用户活跃，安静时间暂停）
   - 在安静时间期间：将输出保存到保持队列
   - 早晨联系释放积压
4. **使用主机调度器注册。** OpenClaw cron、Railway cron、crontab 或进程管理器。**每个注册条目应通过 Minions 执行，而不是 `agentTurn`。** 参见 `skills/conventions/cron-via-minions.md` 了解重写模式（PGLite 使用 `--follow`，Postgres 在周期时段上使用 fire-and-forget + `--idempotency-key`）。GBrain 的 v0.11.0 迁移会自动重写内置处理程序的条目；主机特定的处理程序需要每个 `docs/guides/plugin-handlers.md` 的代码级注册。
5. **写入精简提示。** 作业提示是一行："读取 skills/{name}/SKILL.md 并运行它。"

## 幂等性要求

每个定时任务必须是幂等的：

- 运行相同作业两次产生相同结果（无重复页面、无重复时间线条目）
- 使用检查点状态文件跟踪进度并恢复中断的运行
- 在创建新输出之前检查现有输出

## 输出格式

作业配置已保存。报告："作业 '{name}' 已安排在 {cron expression}。下次运行：{time}。"

## 反模式

- ❌ 在同一分钟安排作业（所有作业都在 :00）
- ❌ 定时任务中的内联 3000 字提示（使用技能文件引用）
- ❌ 首先在 3-5 个项目上测试就运行批量作业
- ❌ 重新运行时产生不同输出的作业（不是幂等的）
- ❌ 在安静时间期间发送通知（改为保存到保持队列）
