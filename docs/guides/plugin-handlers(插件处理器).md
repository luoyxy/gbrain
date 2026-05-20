# 插件处理器 — 注册主机特定的 Minion 处理器#

GBrain 的 Minion worker 附带七个内置处理器：`sync`、`embed`、`lint`、`import`、`extract`、`backlinks`、`autopilot-cycle`。这些涵盖了 `gbrain` CLI 本身执行的每个后台操作。

主机平台（OpenClaw 部署、未来的主机）通过导入 `gbrain/minions` 并在 worker 启动前注册自己的处理器来注册它们自己的处理器。没有 `~/.claude/gbrain-handlers.json` 风格的数据文件 —— 处理器是代码，由主机导入，并通过与主机仓库中任何其他代码的相同代码审查来交付。

## 为什么是代码，而不是数据 #

一个早期的设计草案附带了一个 68 行的 bash watchdog（`minion-watchdog.sh`）。它已被 `gbrain jobs supervisor` 取代，后者处理脚本所做的一切，外加原子 PID 锁定、结构化审计事件、队列范围的健康检查以及在 SIGTERM 上的优雅排空。

主机特定的处理器走的是同一条路：一个 `your-openclaw-worker.ts` 文件，它 `import { MinionWorker } from 'gbrain/minions'` 并调用 `worker.register('ea-inbox-sweep', async (ctx) => { ... })`。该文件通过主机的代码审查流程，获得审查，并与其余部分一起部署。

## 插件合同 #

主机 worker 引导程序看起来像这样（TypeScript）：

```ts
import { MinionQueue, MinionWorker } from 'gbrain/minions';
import type { BrainEngine } from 'gbrain/engine';

async function main() {
  const engine: BrainEngine = /* 你的引擎设置 */;
  await engine.connect({});

  const worker = new MinionWorker(engine, { queue: 'default' });

  // 注册每个主机特定的处理器
  // 每个处理器返回一个纯对象（序列化为作业结果）。
  // 失败抛出 —— worker 根据 max_attempts 捕获并重试。
  
  worker.register('ea-inbox-sweep', async (ctx) => {
    const slot = ctx.data.slot ?? new Date().toISOString();
    // 主机特定的代理开启：调用你的 LLM，扫描收件箱，写入
    // 大脑页面，返回摘要。ctx.signal.aborted 指示
    // worker 想要合作关闭 —— 尊重它。
    return { swept: true, slot };
  });

  worker.register('morning-briefing', async (ctx) => {
    /* 主机逻辑 */
    return { briefed: true };
  });

  // 在注册每个处理器后调用 start()。
  // worker 的停顿检测器忽略在注册集中注册的名称。
  await worker.start();
}

main().catch(err => { console.error(err); process.exit(1); });
```

## 处理器合同 #

每个处理器接收一个 `MinionJobContext`：

```ts
interface MinionJobContext {
  data: Record<string, unknown>;   // 作业参数（无论提交者传递了什么）
  job: MinionJob;                   // 完整作业行（id、队列、尝试次数等）
  signal: AbortSignal;              // 当 worker 关闭时设置为 aborted
  inbox: MinionInbox;               // 在运行时读取发送给此作业的消息
}
```

成功时返回一个可序列化对象。失败时抛出（worker 根据 `max_attempts` 捕获并记录）。

**中止合作。** 当 `ctx.signal.aborted` 变为 true 时，请优雅地完成。worker 将在 30 秒的排空宽限期后等待你，然后是 SIGKILL。对于长时间运行的 LLM 调用，请将该信号通过管道传递到它们使用的任何网络库。

**幂等性。** 队列在数据库层强制执行唯一的 `idempotency_key`；因此你无需担心提交者在先前调用仍在运行时触发的重复提交。

## GBrain 的迁移流程 #

v0.11.0 迁移编排器（由 `gbrain apply-migrations` 运行）检测 cron 条目，其处理器名称不在 GBrain 的内置集中，并向 `~/.gbrain/migrations/pending-host-work.jsonl` 发出一个结构化 TODO。

每个 TODO 的形状为：

```json
{
  "type": "cron-handler-needs-host-registration",
  "handler": "ea-inbox-sweep",
  "cron_schedule": "0 */30 * * *",
  "manifest_path": "/path/to/cron/jobs.json",
  "current_cmd": "agentTurn ea-inbox-sweep",
  "recommendation": "按照 docs/guides/plugin-handlers.md 中的模式在你的主机 worker 引导程序中注册一个处理器。一旦注册，重新运行 `gbrain apply-migrations --yes`。新注册的可调度 cron 条目会被重写，JSONL 行标记为 `status: "complete"`。",
  "status": "pending"
}
```

主机代理使用 `skills/migrations/v0.11.0.md` 遍历这些条目：

1. 读取 `~/.gbrain/migrations/pending-host-work.jsonl`。
2. 对于每个 `cron-handler-needs-host-registration` 行，请按照上面的模式在你的主机 worker 引导程序中交付处理器注册。
3. 部署更新的 worker。
4. 重新运行 `gbrain apply-migrations --yes`。现在识别到新注册的处理器（worker 在启动时将注册的名称写入发现文件），并重写 cron 条目。`pending-host-work.jsonl` 中的 JSONL 行标记为 `status: "complete"`。

## 信任边界 #

处理器代码在具有与主机二进制文件其余部分相同权限的 worker 进程中运行。没有提升。但也没有运行时沙箱 —— 处理器可以读取 + 写入 worker 用户可以访问的任何文件。请像审查触及生产数据的任何其他代码一样审查处理器 PR。

## 相关 #

- `skills/migrations/v0.11.0.md` — 主机代理的完整迁移技能
- `skills/skillpack-check/SKILL.md` — 何时及如何运行健康检查
- `docs/architecture/brains-and-sources.md` — 大脑内部组织（大脑与来源轴）
- `docs/guides/plugin-authors.md` — 如何编写子代理定义文件
