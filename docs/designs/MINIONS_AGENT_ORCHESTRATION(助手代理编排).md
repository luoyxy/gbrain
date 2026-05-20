---
status: ACTIVE
---
# CEO 计划：Minions 作为通用代理编排协议
由 /plan-ceo-review 生成于 2026-04-15
分支：garrytan/minions-jobs | 模式：范围扩展
仓库：garrytan/gbrain

## 愿景

### 10x 检查
不再只是"GBrain 有一个队列，OpenClaw 使用它"，而是让 Minions 成为通用代理编排协议。任何平台（OpenClaw、Hermes、Claude Code、Codex、自定义脚本）都通过相同的 Postgres 原生协议提交、监控、引导和组合代理。GBrain 就是代理控制平面。

### 柏拉理想（ aspirational 北极星，不在 v1 范围内）
打开终端，输入 `gbrain jobs dashboard`。看到每个平台上每个代理。它们的进度、工具调用、token 支出。点击任何代理查看完整执行轨迹。输入消息以在运行中引导正在运行的代理。查看调控器的决策可视化。运行代理配置之间的 A/B 测试。感觉：对你的 AI 劳动力的完全态势感知。

**注意：** 仪表板、A/B 测试和可视化调控器是未来的阶段。本计划构建它们将位于顶部的原语：实时事件、结构化进度、token 核算、带有 ack 的收件箱以及会话记录。

## 范围决策

| # | 提案 | 工作量 | 决策 | 理由 |
|---|----------|--------|----------|-----------|
| 1 | pg LISTEN/NOTIFY 实时事件 | S | 接受 | 亚秒事件传递 vs 5s 轮询。每个平台都受益。 |
| 2 | 结构化进度协议 | S | 接受 | 标准化进度使统一仪表板成为可能。 |
| 3 | 作业成本跟踪（token 核算） | M | 接受 | Token 成本是用户想要了解代理工作的第一件事。 |
| 4 | 作业重放 | S | 接受 | 小表面积，对调试失败具有高实用性。 |
| 5 | 作业组 / 波次 | M | 推迟 | 父子已经提供分组。重叠关注。 |
| 6 | 收件箱确认（已读回执） | S | 接受 | 没有它，收件箱就是即发即忘 — 和我们正在修复的相同问题。 |
| 7 | 通用代理协议 | S | 接受 | 设计框架，不是额外的代码。平台无关命名/文档。 |
| 8 | 会话记录捕获 | M | 接受 | 每个代理运行的完整审计线索。 |

## 接受的范围 — 实现细节

### 0a. 暂停/恢复（来自基础计划）

**模式：** 将 `'paused'` 添加到 `MinionJobStatus`（已经在迁移 v6 约束中）。

**新方法：**
- `MinionQueue.pauseJob(id): MinionJob | null`
  转换 `waiting` 或 `active` → `paused`。对于 `active` 作业，清除 `lock_token` 和 `lock_until`（工作线程将检测到锁丢失并优雅停止）。如果作业不在可暂停状态，返回 null。
- `MinionQueue.resumeJob(id): MinionJob | null`
  转换 `paused` → `waiting`。重置以进行声明。如果未暂停，返回 null。

**工作线程集成：** 工作线程的锁续期循环检查 `isActive()`。当作业被暂停时，锁被清除，因此 `renewLock()` 返回 false，工作线程优雅地停止执行（与失速检测相同的路径）。作业的进度和状态保存在 DB 中，以便在恢复时使用。

**MCP 操作：** `pause-job`、`resume-job`（在实现计划的步骤 3 中添加）。

**PGLite 兼容性：** 完全。

### 0b. 资源调控器（来自基础计划）

**新文件：** `src/core/minions/governor.ts`

```typescript
interface GovernorConfig {
  maxConcurrency: number;       // 上限
  minConcurrency: number;       // 下限（默认 1）
  checkIntervalMs: number;      // 默认 10000
  cpuThreshold: number;         // 默认 0.80 (80%)
  memoryThreshold: number;      // 默认 0.85 (85%)
  circuitBreakerMemory: number; // 默认 0.90 (90%)
}

class ResourceGovernor {
  getEffectiveConcurrency(): number;  // 当前允许的并发
  start(): void;                       // 开始轮询系统指标
  stop(): void;                        // 停止轮询
  onCircuitBreak(cb: (jobId) => void): void; // 杀死回调
}
```

**系统指标：** 重用 `src/core/backoff.ts` 中的 `getSystemLoad()`（已经实现了 CPU 和内存检查）。通过 `perf_hooks.monitorEventLoopDelay()` 添加事件循环延迟测量。

**工作线程集成：** `MinionWorker.start()` 在声明新作业之前咨询 `governor.getEffectiveConcurrency()`。如果当前飞行中计数 >= 有效并发，跳过声明。

**断路器：** 如果内存 > 90%，调控器使用最低优先级的活跃作业 ID 调用 `onCircuitBreak`。工作线程通过 `failJob()` 取消该作业，并使用 `UnrecoverableError("circuit breaker: memory pressure")`。

**先决条件：** 必须先实现并发作业处理（参见下面的并发说明）。

**PGLite 兼容性：** 完全（调控器是应用级别的，不是 DB 级别的）。

### 1. pg LISTEN/NOTIFY（实时事件）

**模式：** 无新列。在状态转换上添加 NOTIFY 触发器。

**SQL 触发器：**
```sql
CREATE OR REPLACE FUNCTION notify_minion_job_change() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('minion_jobs', json_build_object(
    'id', NEW.id, 'status', NEW.status, 'name', NEW.name,
    'queue', NEW.queue, 'prev_status', COALESCE(OLD.status, 'new')
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER minion_job_notify AFTER INSERT OR UPDATE OF status ON minion_jobs
  FOR EACH ROW EXECUTE FUNCTION notify_minion_job_change();
```

**新方法：** `MinionQueue.subscribe(callback: (event) => void): () => void`
返回取消订阅函数。需要直接 Postgres 连接（不是池化的）。

**PGLite 兼容性：** PGLite 不支持 LISTEN/NOTIFY。回退：通过 `getJob()` 以可配置间隔（默认 2s）进行轮询。`subscribe()` 方法检测引擎类型并自动使用轮询回退。

**Supabase 约束：** 需要直接连接（端口 5432），不是 pgBouncer 池化器（端口 6543）。在技能文件和设置指南中记录。

### 2. 结构化进度协议

**TypeScript 接口（约定，不在 DB 级别强制执行）：**
```typescript
interface AgentProgress {
  step: number;           // 当前步骤（从 1 开始）
  total: number;          // 预期总步骤（0 = 未知）
  message: string;        // 人类可读的状态
  tokens_in: number;      // 累积输入 token
  tokens_out: number;     // 累积输出 token
  last_tool: string;      // 最后调用的工具名称
  started_at: string;     // ISO 8601，此步骤开始时
}
```

**存储：** 现有的 `progress JSONB` 列。不需要模式更改。
处理程序使用 `ctx.updateProgress(agentProgress)`。非代理作业可以使用任何 JSONB 形状（向后兼容）。

**验证：** `updateProgress()` 接受任何 JSONB。`AgentProgress` 接口是代理处理程序强制执行的约定，不是队列强制执行的。

### 3. 作业成本跟踪（token 核算）

**模式更改（迁移 v6）：**
```sql
ALTER TABLE minion_jobs ADD COLUMN tokens_input INTEGER DEFAULT 0;
ALTER TABLE minion_jobs ADD COLUMN tokens_output INTEGER DEFAULT 0;
ALTER TABLE minion_jobs ADD COLUMN tokens_cache_read INTEGER DEFAULT 0;
ALTER TABLE minion_jobs ADD COLUMN cost_usd NUMERIC(10,6) DEFAULT 0;
```

**新方法：** `MinionQueue.updateTokens(id, lockToken, { input, output, cache_read, cost_usd })`
累积（添加到现有值，不替换）。

**父级汇总：** 当调用 `completeJob()` 时，如果设置了 `parent_job_id`，则将此作业的 token 计数添加到父级：
```sql
UPDATE minion_jobs SET
  tokens_input = tokens_input + $child_input,
  tokens_output = tokens_output + $child_output,
  tokens_cache_read = tokens_cache_read + $child_cache,
  cost_usd = cost_usd + $child_cost
WHERE id = $parent_id;
```

**PGLite 兼容性：** 完全支持（标准列）。

### 4. 作业重放

**新方法：** `MinionQueue.replayJob(id, dataOverrides?: Record<string, unknown>): MinionJob`

实现：读取已完成/失败/死亡的作业。使用以下命令创建新作业：
- 相同的 `name`、`queue`、`priority`、`max_attempts`、`backoff_type`、`backoff_delay`
- `data` = 原始数据 + 覆盖的深度合并
- 新的 `attempts_made: 0`、`status: 'waiting'`
- `parent_job_id` = null（重放是一个新的顶级作业，不是子级）
- 不克隆子级（重放是单个作业，不是 DAG）

**约束：** 仅适用于终端状态（completed/failed/dead）。
返回新的作业记录。

**幂等性：** 每个重放创建一个不同的新作业。无去重。
如果原始作业有副作用，重放可能会重复它们。在技能文件中将此记录为用户责任。

### 5. 收件箱（边信道消息传递）

**模式更改（迁移 v6）：**
```sql
ALTER TABLE minion_jobs ADD COLUMN inbox JSONB DEFAULT '[]';
```

**收件箱消息格式：**
```typescript
interface InboxMessage {
  id: string;          // UUIDv4
  sent_at: string;     // ISO 8601
  read_at: string | null;  // null 直到工作线程读取它
  sender: string;      // 'parent' | 'user' | job ID
  payload: unknown;    // 任意指令
}
```

**新方法：**
- `MinionQueue.sendMessage(jobId, payload, sender?): InboxMessage`
  通过原子 JSONB 追加将消息附加到收件箱数组
  (`inbox = inbox || $1::jsonb`)，不是读取-修改-写入。返回带有 id + sent_at 的消息。
- `MinionQueue.readInbox(jobId, lockToken): InboxMessage[]`
  返回未读消息（read_at = null）。将它们标记为已读（设置 read_at）。
  令牌围栏：只有持有锁的工作线程可以读取。

**工作线程集成：** 代理处理程序在每次迭代中调用 `readInbox()`。
如果存在消息，将它们作为系统消息注入代理的上下文中。

**PGLite 兼容性：** 完全支持（标准 JSONB 列）。

### 6. 收件箱确认（已读回执）

内置在上述收件箱设计中。每个 `InboxMessage` 上的 `read_at` 字段提供回执。`sendMessage()` 返回消息 ID；发送者可以稍后检查 `getJob(id)` 并检查 `inbox` 以查看哪些消息已被读取。

除了 #5 中的内容外，不需要额外的模式或方法。

### 7. 通用代理协议（平台无关框架）

**这是一个设计决策，不是代码。** 它的意思是：

1. 技能文件（`skills/minion-orchestrator/SKILL.md`）是为任何代理平台编写的，而不仅仅是 OpenClaw。示例显示 MCP 工具调用，不是 OpenClaw 特定的命令。

2. 代理处理程序（`agent-handler.ts`）接受通用接口：
   ```typescript
   interface AgentJobData {
     prompt: string;
     tools?: string[];        // MCP 工具名称
     model?: string;          // 例如，'claude-opus-4-6', 'gpt-4o'
     context?: string;        // 额外上下文
     platform?: string;       // 'openclaw' | 'hermes' | 'claude-code' | 'custom'
     max_iterations?: number; // 代理循环预算
   }
   ```

3. OpenClaw 插件是一个消费者。Hermes、Claude Code 扩展或自定义脚本可以通过相同的 MCP 操作提交 `agent` 作业。

4. **不在 v1 范围内：** 多租户身份验证、跨网络连接、协议版本控制、API 密钥隔离。当实际的多平台使用实现时，这些是 Phase 2 关注点。v1 是单用户、单大脑。

### 代理处理程序架构（关键设计决策）

代理处理程序不在 GBrain 中。GBrain 提供队列基础设施和干净的处理程序契约。实际代理执行位于平台插件中：

```
GBrain（此仓库）：
  MinionQueue  — 队列/声明/完成/收件箱/token/NOTIFY
  MinionWorker — 轮询/锁/失速/调控器框架
  Handler 契约 — AgentJobData 接口 + MinionJobContext

OpenClaw 插件（单独仓库）：
  向 MinionWorker 注册 "agent" 处理程序
  处理程序调用 OpenClaw 的 PI 代理核心（实际 LLM 循环）
  每次迭代：readInbox → 作为系统消息注入，updateProgress，updateTokens
  完成：将结果 + 会话记录存储在 job.result + job.stacktrace 中

GBrain 仅附带用于单元测试的测试/回显处理程序。
```

**处理程序契约（GBrain 侧）：**
```typescript
// 处理程序接收此上下文（已存在于 worker.ts 中）
interface MinionJobContext {
  id: number;
  name: string;
  data: Record<string, unknown>;  // 当 name="agent" 时为 AgentJobData
  attempts_made: number;
  updateProgress(progress: unknown): Promise<void>;
  updateTokens(tokens: TokenUpdate): Promise<void>;  // 新
  log(message: string | TranscriptEntry): Promise<void>;
  isActive(): Promise<boolean>;
  readInbox(): Promise<InboxMessage[]>;  // 新
}
```

**为什么这是正确的：** GBrain 是编排，不是执行。OpenClaw 有 PI 代理核心。Hermes 有 AIAgent。Claude Code 有自己的循环。每个平台带来自己的引擎并注册处理程序。GBrain 管理生命周期、进度、引导、成本跟踪和持久性。

### 8. 会话记录捕获

**扩展现有的 stacktrace 机制。** `stacktrace` 字段（字符串的 JSONB 数组）已经捕获日志消息。会话记录使用相同的字段和结构化条目：

```typescript
type TranscriptEntry =
  | { type: 'log'; message: string; ts: string }
  | { type: 'tool_call'; tool: string; args_size: number; result_size: number; ts: string }
  | { type: 'llm_turn'; model: string; tokens_in: number; tokens_out: number; ts: string }
  | { type: 'error'; message: string; stack?: string; ts: string };
```

**存储：** 现有的 `stacktrace JSONB` 列。不需要模式更改。
代理处理程序附加 `TranscriptEntry` 对象而不是纯字符串。
向后兼容：非代理作业继续附加字符串。

**大小关注：** 长代理运行可能会生成大型记录。添加
`max_transcript_entries` 选项（默认 1000），在超过时轮换最旧的条目
（FIFO）。取证分析的完整记录可以通过 `gbrain files upload-raw` 存储为大脑文件。

## 模式迁移 v6

所有模式更改都是附加的（ALTER TABLE ADD COLUMN）。不需要回填。
现有作业继续使用默认值工作。

```sql
-- 迁移 v6：代理编排原语
ALTER TABLE minion_jobs ADD COLUMN IF NOT EXISTS tokens_input INTEGER DEFAULT 0;
ALTER TABLE minion_jobs ADD COLUMN IF NOT EXISTS tokens_output INTEGER DEFAULT 0;
ALTER TABLE minion_jobs ADD COLUMN IF NOT EXISTS tokens_cache_read INTEGER DEFAULT 0;

-- 单独的收件箱表（不是作业行上的 JSONB）
CREATE TABLE IF NOT EXISTS minion_inbox (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES minion_jobs(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  payload JSONB NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_minion_inbox_unread
  ON minion_inbox (job_id) WHERE read_at IS NULL;

-- 状态约束更新：添加 'paused'
ALTER TABLE minion_jobs DROP CONSTRAINT IF EXISTS minion_jobs_status_check;
ALTER TABLE minion_jobs ADD CONSTRAINT minion_jobs_status_check
  CHECK (status IN ('waiting','active','completed','failed','delayed','dead','cancelled','waiting-children','paused'));

-- NOTIFY 触发器用于实时事件（仅 Postgres，不是 PGLite）
CREATE OR REPLACE FUNCTION notify_minion_job_change() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('minion_jobs', json_build_object(
    'id', NEW.id, 'status', NEW.status, 'name', NEW.name,
    'queue', NEW.queue, 'prev_status', COALESCE(OLD.status, 'new')
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER minion_job_notify AFTER INSERT OR UPDATE OF status ON minion_jobs
  FOR EACH ROW EXECUTE FUNCTION notify_minion_job_change();
```

## PGLite 兼容性矩阵

| 功能 | Postgres | PGLite | 回退 |
|---|---|---|---|
| 暂停/恢复 | 完全 | 完全 | — |
| 收件箱 + 确认 | 完全 | 完全 | — |
| Token 核算 | 完全 | 完全 | — |
| 作业重放 | 完全 | 完全 | — |
| LISTEN/NOTIFY | 完全 | 否 | 轮询（2 秒间隔） |
| NOTIFY 触发器 | 完全 | 否 | 在 PGLite 模式中跳过 |
| 结构化进度 | 完全 | 完全 | — |
| 会话记录 | 完全 | 完全 | — |
| 资源调控器 | 完全 | 完全 | — |
| 工作线程守护进程 | 完全 | 否（现有限制） | — |

## 并发说明

当前的 `MinionWorker.start()` 顺序处理作业（一次一个），尽管 `MinionWorkerOpts` 中声明了 `concurrency`。实现实际的并发作业处理（Promise 池）是资源调控器有意义的先决条件。调控器调整有效并发，这需要实际并发处理存在。

**操作：** 在工作线程中实现并发作业处理。使用信号量模式：保持最多 N 个飞行中的 promise，在槽位释放时声明新作业。

## 外部声音决策（来自对抗性审查）

1. **用于暂停/恢复的 AbortController** — 处理程序契约获取 `signal: AbortSignal`。
   暂停清除锁 AND 发出中止信号。处理程序必须在每次迭代时检查 `signal.aborted`。没有这个，暂停活跃作业会创建重复执行。

2. **删除 cost_usd 列** — Token 计数（input/output/cache_read）是稳定的事实。
   USD 定价是易变的。在显示/读取时从定价表计算成本，不是在写入时。从迁移 v6 中删除 `cost_usd NUMERIC(10,6)`。

3. **单独的 minion_inbox 表** — 而不是作业行上的 JSONB 数组，使用专用的表用于收件箱消息。避免在每次发送时重写整个收件箱。
   正确使用标准 INSERT 进行并发安全（无 JSONB 追加关注）。
   ```sql
   CREATE TABLE minion_inbox (
     id SERIAL PRIMARY KEY,
     job_id INTEGER NOT NULL REFERENCES minion_jobs(id) ON DELETE CASCADE,
     sender TEXT NOT NULL,
     payload JSONB NOT NULL,
     sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     read_at TIMESTAMPTZ
   );
   CREATE INDEX idx_minion_inbox_unread ON minion_inbox (job_id) WHERE read_at IS NULL;
   ```

4. **一次发布，不是两次** — 在一次迁移中交付所有功能（v6）。与增量交付相比，用户更喜欢内聚发布。

5. **选择性列投影** — 修复 getJobs()、claim()、handleStalled() 中的 SELECT * 查询以排除 stacktrace 列。仅在 getJob() 详细视图中包含 stacktrace。防止记录膨胀影响查询性能。

## 未来阶段（接受的发展轨迹）

- **Phase 2：仪表板 CLI** — `gbrain jobs dashboard` 实时 TUI 显示所有代理。
  启用者：LISTEN/NOTIFY、结构化进度、token 核算。
- **Phase 3：多租户身份验证** — 运行时 MCP 访问控制、每平台 API 密钥。
  启用者：平台无关框架、收件箱上的发送者验证。
- **Phase 4：代理组合模式** — Map-reduce、pipeline、审批关卡作为一等原语。
  启用者：父子 DAG、收件箱边信道。

## 推迟到 TODOS.md

- 作业组 / 波次（父子覆盖这个；如果出现真实分组需求则重新访问）
- cost_usd 列（当定价 API 存在时，在读取时从定价表计算）

## 关键前提确认

1. GBrain 有意从知识大脑演变为代理基础设施（用户确认）
2. OpenClaw 和 GBrain 的 Postgres 之间的耦合是可接受的（OpenClaw 已经依赖于 GBrain）
3. 选择了完整基础设施方法（所有 8+ 步骤），而不是最小可行或边车跟踪
4. 先前的学习 [agent-dx-instruction-layer] 验证了教学层（技能 + 评估）是强制性的