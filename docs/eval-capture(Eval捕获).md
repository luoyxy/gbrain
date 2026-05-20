# Eval capture — NDJSON schema reference

**状态：** 从 v0.21.0 开始稳定。每行上的 `schema_version` 进行模式版本控制；增量更改递增次版本；移除是 breaking-schema-v2。

**受众：** 下游消费者（主要是兄弟 [gbrain-evals](https://github.com/garrytan/gbrain-evals) 仓库），用于重放捕获的真实世界查询作为 BrainBench-Real 装置。

## 管道

```
MCP / CLI / subagent tool-bridge caller
     │
     ▼
src/core/operations.ts — query + search op handlers
     │
     │ (hybridSearch or searchKeyword)
     │
     ▼
{results, meta: HybridSearchMeta}                 ┌── captureEvalCandidate
     │                                             │    (fire-and-forget)
     ▼                                             │
return to caller                                   ▼
                                            scrubPii(query) ←── src/core/eval-capture-scrub.ts
                                                   │
                                                   ▼
                                           buildEvalCandidateInput
                                                   │
                                                   ▼
                                           engine.logEvalCandidate
                                                   │
                                    ┌──────────────┴──────────────┐
                                    │ success                     │ fail
                                    ▼                             ▼
                                INSERT into eval_candidates    engine.logEvalCaptureFailure
                                                                 (reason: db_down | rls_reject |
                                                                  check_violation |
                                                                  scrubber_exception | other)
```

## `gbrain eval export` — 消费者契约

```sh
gbrain eval export [--since DUR] [--limit N] [--tool query|search]
```

向 **stdout** 发出 NDJSON。每个 `\n` 终止的行一个 JSON 对象。
stderr 接收进度心跳。每行以 `“schema_version”: 1` 开头，因此前向兼容解析器可以在 v2 模式上响亮地失败，而不是静默地错误解析。

gbrain-evals 的典型用法：

```sh
# 快照过去一周的真实流量以进行重放
gbrain eval export --since 7d > brainbench-real.ndjson
```

```sh
# 通过 jq 流式传输以进行临时分析
gbrain eval export --tool query | jq -c 'select(.latency_ms > 500)'
```

## 行模式 (v1)

每个导出的行都有此形状。JSON 输出中的字段顺序不
保证；消费者必须按名称键入，而不是位置。

| 字段 | 类型 | 备注 |
|---|---|---|
| `schema_version` | number | 在 v1 行上始终为 `1`。前向兼容门。 |
| `id` | number | 自增主键。跨导出稳定。 |
| `tool_name` | `"query"` \| `"search"` | 捕获此行的 MCP 操作。 |
| `query` | string | 除非 `eval.scrub_pii: false`，否则已经过 **PII-清理**。电子邮件 / 电话 / SSN / Luhn 验证的信用卡 / JWT / bearer token 替换为 `[REDACTED]`。最大长度 50KB（CHECK 强制执行）。 |
| `retrieved_slugs` | string[] | 在 `SearchResult[]` 中返回的去重 slug。 |
| `retrieved_chunk_ids` | number[] | 结果顺序中的每个块 id（保留重复项——每次命中一个）。 |
| `source_ids` | string[] | 整个结果集中的不同 `sources.id` 值（v0.18 多来源）。对于缺少列的前 v0.18 行，为空。 |
| `expand_enabled` | boolean \| null | 调用者是否**请求** Haiku 扩展。`search` 为 `null`（无扩展概念）。 |
| `detail` | `"low"` \| `"medium"` \| `"high"` \| null | 调用者**请求**的详细级别。省略时为 `null`。 |
| `detail_resolved` | `"low"` \| `"medium"` \| `"high"` \| null | `hybridSearch` 在自动检测后**实际使用的**。调用者和启发式都未分类时为 `null`。 |
| `vector_enabled` | boolean | 当且仅当向量搜索实际运行时为 True。`OPENAI_API_KEY` 丢失或嵌入调用失败时为 `false`。**重放必须尊重这一点**——带有 `false` 的行仅执行了关键词路径。 |
| `expansion_applied` | boolean | 当且仅当 Haiku 扩展实际产生变体时（不仅仅是"已请求"）为 True。 |
| `latency_ms` | number | 操作处理程序的挂钟持续时间（包括捕获本身——因为他是即发即忘的，所以可忽略）。 |
| `remote` | boolean | MCP 调用者为 `true`（不受信任），本地 CLI 为 `false`。将"真实代理流量"与"操作员探测"分开。 |
| `job_id` | number \| null | 调用者为子代理工具桥时的 `OperationContext.jobId`。MCP + CLI 为 Null。 |
| `subagent_id` | number \| null | `OperationContext.subagentId` 用于子代理拥有的运行。 |
| `created_at` | string (ISO 8601) | 插入的 UTC 时间戳。 |

## 排序 + 确定性

`listEvalCandidates` 按 `created_at DESC, id DESC` 排序。同一
毫秒插入在 `created_at` 上平局；`id DESC` 是稳定的
平局决胜者。重放工具可以按顺序使用行并假设：

- 使用非重叠 `--since` 窗口的调用之间没有重复行
- 链接 `--since` 窗口的调用之间没有遗漏行（窗口结束
  是严格上界，而不是软游标）

## 模式版本控制承诺

- **v1（在 v0.21.0 中发布）** —— 本文档。上面列出的所有字段。
- **增量更改** 递增 gbrain 次版本（v0.25.0、v0.23.0
   …）并附带新的可选字段。按键已知字段
   忽略未知键并继续工作。
- **破坏性更改**（重命名、类型更改、移除）递增
   `schema_version` 到 2。消费者必须按 `schema_version` 分支以
   保持兼容。

## `eval_capture_failures` — 配套审计表

不由 `gbrain eval export` 导出。通过 `gbrain doctor` 呈现：

```sh
gbrain doctor   # 在过去 24 小时内失败时警告
```

原因枚举（稳定）：`db_down` \| `rls_reject` \| `check_violation` \|
`scrubber_exception` \| `other`。跨进程可见性是整个
  点——`gbrain doctor` 在其自己的进程中运行并直接读取表，
  因此进程内计数器不起作用。

## 配置 + CONTRIBUTOR_MODE

从 v0.25.0 开始，捕获**默认关闭**（在较早的草案中每个人
都开启）。两条路径将其打开：

**路径 A —— env var（贡献者选择加入，常见情况）：**

```bash
export GBRAIN_CONTRIBUTOR_MODE=1     # 在 ~/.zshrc 或 ~/.bashrc 中
```

**路径 B —— 显式配置（`~/.gbrain/config.json`，仅文件平面）：**

```json
{
  "engine": "postgres",
  "database_url": "...",
  "eval": {
    "capture": true,
    "scrub_pii": true
  }
}
```

解析顺序（最显式获胜）：

1. `eval.capture: true` 在配置中 → 开启
2. `eval.capture: false` 在配置中 → 关闭（覆盖 CONTRIBUTOR_MODE=1）
3. `GBRAIN_CONTRIBUTOR_MODE === '1'` → 开启
4. 否则 → 关闭

`scrub_pii` 默认为 `true`，与捕获无关。设置
`eval.scrub_pii: false` 以保留原始查询文本（仅当你
控制大脑的分发时）。

`gbrain config set eval.capture false` 并**不**起作用——该
  命令写入 DB 平面配置，而 MCP 服务器读取
  文件平面。直接编辑 JSON 或使用 env var。
