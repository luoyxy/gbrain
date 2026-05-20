---
name: minion-orchestrator
version: 1.0.0
description: |
  用于确定性 shell 作业和 LLM 子智能体
  编排的统一 Minions 技能。替换较旧的 `gbrain-jobs` 路由意图。
  用于：
  提交 gbrain 作业、shell/后台任务、生成子智能体、
  检查进度、引导运行中的工作、暂停/恢复、
  并行扇出。一种持久、可观察的队列接口。
triggers:
  - "gbrain jobs submit"
  - "submit a gbrain job"
  - "submit a shell job"
  - "shell job"
  - "run shell command in background"
  - "deterministic background task"
  - "spawn agent"
  - "background task"
  - "run in background"
  - "check on agent"
  - "agent progress"
  - "what's running"
  - "steer agent"
  - "change direction"
  - "tell the agent"
  - "pause agent"
  - "stop agent"
  - "resume agent"
  - "parallel tasks"
  - "fan out"
  - "do these in parallel"
tools:
  - submit_job
  - get_job
  - list_jobs
  - cancel_job
  - pause_job
  - resume_job
  - replay_job
  - send_job_message
  - get_job_progress
mutating: true
---

# Minion 编排器#

## 合约#

Minions 是 Postgres 原生的作业队列，用于持久、可观察的后台工作。#
此单一技能处理两个通道：#
- 确定性 shell 作业（`gbrain jobs submit shell ...`）#
- LLM 子智能体作业（`gbrain agent run ...`）#

路由策略定义在 `skills/conventions/subagent-routing.md` 中 —— 项目默认是#
`pain_triggered`（原生子智能体优先。在特定的疼痛信号之后 Minions）#
；模式 A（全部通过 Minions）是选择性加入的。

保证：#
- 作业在网关重启后存活（Postgres 支持的）#
- 每个作业都有结构化进度、令牌计费和会话记录#
- 运行中的智能体可以通过收件箱消息在飞行中引导#
- 作业可以暂停、恢复或随时取消#
- 带有可配置失败策略的父级-子级 DAG#

## 路由请求：Shell 作业 vs 子智能体#

| 条件 | 操作 |
|--------|--------|
| 用户要求确定性命令/脚本运行 | Shell 作业（CLI：`gbrain jobs submit shell ...`） |
| 用户要求"在 minions 中运行"+ 显式命令/argv | Shell 作业（CLI，`--params` 带有 `cmd` 或 `argv`）|
| 用户要求研究/推理/迭代智能体 | 子智能体作业（CLI：`gbrain agent run`）|
| 用户要求引导/暂停/恢复智能体 | 子智能体作业生命周期工具（MCP 可调用）|
| 单个简单操作低于 ~30 秒 | 首先考虑内联执行 |
| 需要重启持久性/可观察性 | 作为 Minion 作业提交 |
| 并行工作（2+ 个流） | `gbrain agent run --fanout-manifest` 或父级 + 子级子智能体 |

如果意图模糊，请询问一个澄清：#
"你想要确定性 shell 命令作业，还是 LLM 智能体作业？"#

## Shell 作业（确定性脚本）#

用于可重现的命令执行、ETL 步骤、定时工作以及不需要#
LLM 推理循环的脚本化任务。

### 前提条件（在提交你的第一个 shell 作业之前阅读）#

- **`GBRAIN_ALLOW_SHELL_JOBS=1` 必须在工作器环境中设置。**#
  没有它，shell 处理程序拒绝注册并且提交静默地坐在#
  `waiting` 中。门控位于 `src/core/minions/handlers/shell.ts`。#
- **安全性：** 翻转 `GBRAIN_ALLOW_SHELL_JOBS=1` 授权在工作器上执行任意#
  命令。在共享队列上，这是远程代码#
  执行表面。将其视为特权基础设施授权。#
- **执行模式 — 选择一个：**#
  - **Postgres + 守护程序：** `gbrain jobs work` 运行从队列中#
    领取并执行作业的持久工作器。#
  - **PGLite + `--follow`：** `gbrain jobs submit ... --follow` 在内联中运行。#
    守护程序模式在 PGLite 上不可用（独占文件锁）。参见#
    `docs/guides/minions-shell-jobs.md`。#

- **MCP 边界：** shell 作业提交是仅 CLI 的。带有 `submit_job name="shell"` 的#
  MCP 抛出带有代码 `permission_denied` 的 `OperationError`（"'shell'"#
  作业不能通过 MCP 提交"）。因为 `shell` 在 `PROTECTED_JOB_NAMES` 中；#
  智能体可以观察 shell 作业（通过 `get_job` / `list_jobs` / `get_job_progress`）#
  （不是受保护的），但不能提交它们。操作员或 autopilot 提交；#
  智能体观察。#

- **验证设置：** 配置后，运行 `gbrain jobs stats`（CLI）以#
  确认工作器已注册并消耗队列。#

### 提交（CLI，操作员或 autopilot）#

Shell 作业通过 `--params` 作为 JSON 对象接受命令，带有 `cmd`#
（字符串）或 `argv`（数组），加上 `cwd` 和可选的 `env`。#

命令字符串形式：#
```
gbrain jobs submit shell --params '{"cmd":"echo hello","cwd":"/abs/path"}'
```

Argv 形式（无 shell 扩展）：#
```
gbrain jobs submit shell --params '{"argv":["bash","-lc","echo hello"],"cwd":"/abs/path"}'
```

内联执行在 PGLite 或任何单次部署上：#
```
gbrain jobs submit shell --params '{"cmd":"echo hello","cwd":"/tmp"}' --follow
```

队列/生命周期标志通过 `gbrain jobs submit --help` 公开：`--queue`、#
`--priority`、`--delay`、`--max-attempts`、`--max-stalled`、#
`--backoff-type`、`--backoff-delay`、`--backoff-jitter`、`--timeout-ms`、#
`--idempotency-key`、`--dry-run`。#

### 监视（智能体或操作员）#

这些操作是 MCP 可调用的并且对智能体使用是安全的：#

```
list_jobs --name shell --status active
get_job ID
get_job_progress ID
```

检查结构化结果字段（退出代码、stdout/stderr 尾部、尝试、#
计时）从 `get_job`。使用 `gbrain jobs stats`（CLI）以获取工作器/队列#
健康仪表板。

### 控制（MCP 可调用）#

```
cancel_job id=ID
replay_job id=ID
```

`replay_job` 不是受保护的 —— 仅 shell *提交* 是。智能体可以#
取消或重放 shell 作业而无需 CLI 访问。

对重复 shell 工作负载使用幂等性密钥以避免重复运行。#

## 子智能体作业（LLM 编排）#

用于开放式推理、工具使用的研究以及扇出综合。

**用户面对的入口点：** `gbrain agent run <prompt>` 是提交子智能体工作的规范方式。它处理提升信任管道 —— `subagent`#
和 `subagent_aggregator` 都在 `PROTECTED_JOB_NAMES` 中，所以直接的 MCP#
提交需要 `{allowProtectedSubmit: true}`，它由 `gbrain agent run`#
提供。

## 阶段1：提交#

```
gbrain agent run "Research Acme Corp revenue" --tools "search,query"
```

`--tools` 接受 `BRAIN_TOOL_ALLOWLIST` 的逗号分隔子集（参见#
`src/core/minions/tools/brain-allowlist.ts`）：`query`、`search`、`get_page`、#
`list_pages`、`file_list`、`file_url`、`get_backlinks`、`traverse_graph`、#
`resolve_slugs`、`get_ingest_log`、`put_page`。任何在允许列表之外的内容#
在提交时被拒绝，带有 `allowed_tools references unknown tool`。#

对于带有扇出清单的并行工作：#
```
gbrain agent run --fanout-manifest companies.json
```

清单描述了 N 个子级 + 1 个聚合器。每个子级在#
罩子下运行 `name="subagent"`；聚合器运行 `name="subagent_aggregator"`#
并且在每个子级终止后声明 AFTER。参见#
`src/core/minions/handlers/subagent.ts` 和#
`src/core/minions/handlers/subagent-aggregator.ts`。#

标志（来自 `src/commands/agent.ts`）：#
- `--subagent-def <name>` — 命名的子智能体定义#
- `--model <id>` — 覆盖模型#
- `--max-turns <N>` — 上限 LLM 循环#
- `--tools <csv>` — 允许列表化的智能体工具（参见上面）#
- `--timeout-ms <N>` — 每个作业的硬性超时#
- `--fanout-manifest <file>` — N 个子级 + 1 个聚合器#
- `--follow` / `--no-follow` — 流式日志 + 等待（TTY 上默认为 on）#
- `--detach` — 提交并立即返回#

队列/优先级/重试调优不通过 `gbrain agent run` 公开；如果你#
需要那些旋钮，请通过带有 `--idempotency-key` 的 `gbrain jobs submit` 提交#
原始 `subagent` 处理程序。

## 阶段2：监视#

```
list_jobs --status active          # MCP — 什么在运行？
get_job ID                         # MCP — 完整详细信息和日志 + 令牌 #
get_job_progress ID                # MCP — 结构化进度快照 #
gbrain agent logs ID --follow      # CLI — 流式记录和心跳 #
```

进度包括：步骤计数、总步骤、消息、令牌使用、最后调用的工具。#

## 阶段3：引导#

发送消息以重定向运行中的智能体：#

```
send_job_message id=ID payload={"directive":"focus on revenue, skip headcount"}
```

智能体处理程序在每次迭代时读取收件箱消息并注入它们作为#
上下文。消息被确认（读取回执被跟踪）。#

仅父级作业或管理员可以发送消息（发送者验证）。#

## 阶段4：生命周期#

```
pause_job id=ID                    # 冻结而不丢失状态 #
resume_job id=ID                   # 从它离开的地方拾取 #
cancel_job id=ID                   # 硬性停止 #
replay_job id=ID                   # 用相同或修改的参数重新运行 #
replay_job id=ID data_overrides={"depth":"deep"}  # 用更改重放 #
```

所有生命周期操作都是 MCP 可调用的。

## 阶段5：审查结果#

```
get_job ID                         # result、令牌计数、记录 #
```

令牌计费：每个作业跟踪 `tokens_input`、`tokens_output`、`tokens_cache_read`。#
子级令牌在成功时自动滚动到父级。#

## 输出格式#

向用户报告作业状态时：#

```
作业 #ID（名称）— 状态
进度：步骤/总计 — 最后操作
令牌：输入计数 / 输出计数（+ 缓存读取）
运行时：X 秒
子级：N 待处理，M 已完成
```

报告完成时：#

```
作业 #ID 在 X 秒内完成
使用的令牌：输入 / 输出 / 缓存读取
结果：<摘要>
```

报告批量状态（带有子级的父级）时：#

```
父级 #ID — 等待-子级
  #A 子智能体（Acme）— 活跃，3/5 步骤，2.5k 令牌
  #B 子智能体（Beta）— 已完成，1.8k 令牌
  #C 子智能体（Gamma）— 已暂停
总计到目前为止：4.3k
```

## 反模式#

- 在不首先检查 `gbrain jobs stats` 的情况下生成 Minion 以获取队列深度#
- 在没有样本测试的情况下扇出 >5 个并发智能体#
- 用 `runtime: "subagent"` 在 PGLite 上运行（不支持；回退到内联）#
- 在没有 `--idempotency-key` 的情况下重新提交相同的扇出（重复工作）#
- 轮询 `get_job` 在紧凑循环中（使用 `get_job_progress` 以获取轻量级检查）#
- 使用天真的"返回技能 slug"提示#
   （没有关于 `(dispatcher for: ...)` 的指令），每个压缩变体#
  在 Opus 上坍缩到 ~30-60%。调度器感知的提示在#
  `evals/functional-area-resolver/harness-runner.ts:PROMPT_TEMPLATE` 中。将其#
  用作你的智能体 harness 的模板；没有它，压缩就会破坏。#

## 工具使用#

- 提交后台作业 — `submit_job`（MCP，仅非受保护名称；shell 作业是 CLI 专用的，子智能体作业通过 `gbrain agent run`）#
- 获取作业详细信息和日志 + 令牌 — `get_job`（MID）#
- 按过滤器列出作业 — `list_jobs`（MCP）#
- 取消作业 — `cancel_job`（MID）#
- 暂停作业 — `pause_job`（MCP）#
- 恢复已暂停的作业 — `resume_job`（MCP）#
- 重放已完成/失败作业 — `replay_job`（MCP）#
- 发送边信道消息 — `send_job_message`（MCP）#
- 获取结构化进度 — `get_job_progress`（MCP）#
- 队列统计数据 — `gbrain jobs stats`（CLI；无 MCP 等效项）#
