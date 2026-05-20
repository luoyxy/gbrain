# 针对你的 gbrain 更改运行真实世界评估基准

受众：gbrain 维护者和贡献者。如果你正在触及检索
（搜索、排名、嵌入、意图分类、查询扩展、来源
提升、混合融合），这是文档。

对于 **NDJSON 有线格式**（由 gbrain-evals 使用），请参见
[`eval-capture.md`](./eval-capture.md)。本文档是位于该格式之上的
人类开发循环。

## 先决条件：打开贡献者模式

捕获**默认关闭**（为了隐私——不会令人惊讶地
积累数据）。贡献者用一行打开它：

```bash
# 在 ~/.zshrc 或 ~/.bashrc 中：
export GBRAIN_CONTRIBUTOR_MODE=1
```

验证：

```bash
gbrain query "anything" >/dev/null
psql $DATABASE_URL -c 'SELECT count(*) FROM eval_candidates'   # 应该 > 0
```

要覆盖（无论 env var 如何，强制打开/关闭）：

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
1. `eval.capture: true` 在配置中 → 打开
2. `eval.capture: false` 在配置中 → 关闭（覆盖 CONTRIBUTOR_MODE=1）
3. `GBRAIN_CONTRIBUTOR_MODE === '1'` → 打开
4. 否则 → 关闭

`scrub_pii` 默认为 `true`，与捕获无关。设置
`eval.scrub_pii: false` 以保留原始查询文本（仅当你
控制大脑的分发时）。

## 4 命令循环

```bash
# ① 捕获：每当设置 CONTRIBUTOR_MODE 时写入 eval_candidates。
#    检查已收集的内容：
gbrain doctor                                     # 在过去 24 小时内警告时
psql $DATABASE_URL -c 'SELECT count(*) FROM eval_candidates'

# ② 快照：在代码更改之前冻结基线。
gbrain eval export --since 7d > baseline.ndjson

# ③ 代码更改：做任何你想做的 —— 调整 RRF_K、交换嵌入模型、编辑
#    hybrid.ts、添加新的提升来源、更改意图分类器。
#    （确保 GBRAIN_CONTRIBUTOR_MODE=1 已设置。）

# ④ 重放：针对当前构建重新运行每个捕获的查询。
gbrain eval replay --against baseline.ndjson
```

输出：

```
Replaying 247 captured queries…
  ...25/247
  ...50/247
  ...
Replayed 247 of 247 captured queries (0 skipped, 0 errored)

Mean Jaccard@k:    0.927
Top-1 stability:   91.5%
Mean latency Δ:    +14ms (current vs captured)
```

三个数字告诉你更改是否安全着陆：

| 指标 | 含义 | 健康范围 |
|---|---|---|
| **Mean Jaccard@k** | 捕获的 slug 集与当前运行的 slug 之间的平均重叠。1.0 = 相同集。 | ≥0.85 用于"中性"更改。<0.7 意味着重大的检索移动。 |
| **Top-1 stability** | #1 结果未更改的查询分数。 | ≥85% 用于调优通过。<70% 意味着漏斗顶部被破坏。 |
| **Mean latency Δ** | 当前减去捕获。正数 = 现在较慢。 | 在 ±50ms 的捕获内。任何地方 >2× = 回归警报。 |

## 它的实际作用

`gbrain eval replay` 读取你的 NDJSON 快照，并为每一行：

1. 重新执行相同的操作（`searchKeyword` 用于 `tool_name='search'`，
   `hybridSearch` 用于 `tool_name='query'`），并线程化返回的 `detail` 和
   `expand_enabled` 值。
2. 捕获当前的 `retrieved_slugs`（去重，按结果顺序）。
3. 计算捕获集和当前 slug 集之间的集合 Jaccard。
4. 记录 top-1 匹配（#1 结果是否是相同的 slug？）。
5. 记录与捕获的 `latency_ms` 相比的延迟增量。

它**不**计算 MRR 或 nDCG —— 那些需要真实情况
相关性标签，而不是基线比较。对于针对真实情况的评估，请使用
`gbrain eval --qrels <path>`（旧的 IR-eval 路径，仍然支持）。重放工具
回答一个不同的问题："我的代码更改是否移动了
检索，以及它移动最多的查询是什么？"

对于第三个评估轴 —— 公共基准、真实情况标签、完整
问答管道（不仅仅是检索）—— `gbrain eval longmemeval
<dataset.jsonl>`（v0.28.8）针对 gbrain 的
混合检索运行 LongMemEval 基准。每个问题获得一个干净的在内存中 PGLite，其 haystack
被导入，问题被问，假设作为 JSONL 发出 —— 完全
LongMemEval 的 `evaluate_qa.py` 使用的形状
你的 `~/.gbrain` 大脑是
永远不会打开。参见下面的"公共基准：LongMemEval"。

## 设计上尽力而为

重放不是纯粹的。在捕获和重放之间，三件事可能会漂移：

1. **大脑状态** —— 你的大脑可能现在比
   快照拍摄时拥有更多页面。除非你显式播种固定的语料库，否则平均
   Jaccard 将仅因新页面符合而下降
   候选。
2. **嵌入来源** —— 如果你在捕获之间更改了 `OPENAI_API_KEY`
   和重放（或嵌入模型轮换），即使代码相同，向量路径结果也会漂移。
3. **捕获上限** —— 捕获的 `retrieved_slugs` 是一个去重的集合；它不
   保留内部排名元数据。两个工具可以返回相同的 slug
   集，但排名不同 —— Jaccard 将说 1.0，但
   按分数排序的下游消费者可能表现不同。

指标是**真实查询上的回归警报**，而不是哈希检查。
用手动检查最差 Jaccard 来配对它们。

## 成本

快照中的每一行 `query` 都通过 OpenAI 运行查询字符串以
运行 `hybridSearch` 的向量一半。成本与普通的 `gbrain
query` 调用相同 —— text-embedding-3-large 在 OpenAI 列表价格，在
单个重放行内批处理。

如果你想在本地迭代并且不想为每次更改付费，请使用
`--limit 50` 来限制重放的行的上限。最近 50 行通常
足以捕捉方向；在为最终预合并运行扩展。

```bash
# 迭代模式 —— 最近 50 个查询
gbrain eval replay --against baseline.ndjson --limit 50

# 预合并 —— 完整快照
gbrain eval replay --against baseline.ndjson --top-regressions 20
```

## CI 集成

```bash
gbrain eval replay --against baseline.ndjson --json > replay.json
jq -e '.summary.mean_jaccard >= 0.85' replay.json || exit 1
jq -e '.summary.top1_stability_rate >= 0.85' replay.json || exit 1
```

稳定 JSON 形状（schema_version: 1）：

```json
{
  "schema_version": 1,
  "summary": {
    "rows_total": 247,
    "rows_replayed": 247,
    "rows_skipped": 0,
    "rows_errored": 0,
    "mean_jaccard": 0.927,
    "top1_stability_rate": 0.915,
    "mean_latency_delta_ms": 14,
    "rows_over_2x_latency": 0
  }
}
```

`--verbose` 添加一个 `results: [...]` 数组，每个重放行有一个条目
（对于通过 jq 或 notebook 进行更深入的分析很有用）。

## 何时运行此

在合并任何触及以下内容之前：

- `src/core/search/hybrid.ts`（RRF、融合、去重、两遍检索）
- `src/core/search/source-boost.ts` / `sql-ranking.ts`（每来源排名）
- `src/core/search/intent.ts`（自动详情分类）
- `src/core/search/expansion.ts`（Haiku 查询扩展）
- `src/core/search/dedup.ts`（跨页面结果折叠）
- `src/core/embedding.ts` 或任何嵌入模型交换
- `src/core/operations.ts` `query` 或 `search` 操作处理程序（捕获表面）
- `src/core/postgres-engine.ts` / `pglite-engine.ts` `searchKeyword` /
  `searchVector` SQL

跳过：仅模式迁移、文档更改、仅测试 PR、CLI 人体工程学
不触及检索。

## 构建你自己的语料库

如果你还没有捕获流量（全新安装，无法在
合并之前进行狗粮），你可以手动编写 NDJSON 文件：

```jsonl
{"schema_version":1,"id":1,"tool_name":"query","query":"who is alice","retrieved_slugs":["people/alice","people/alice-bio"],"expand_enabled":false,"detail":null,"latency_ms":0,"remote":false}
{"schema_version":1,"id":2,"tool_name":"search","query":"acme deal","retrieved_slugs":["deals/acme-seed","companies/acme"],"latency_ms":0,"remote":false}
```

然后运行 `gbrain eval replay --against handcrafted.ndjson` 以确认
权威 slug 返回。这是 BrainBench-Real 之间的接缝
管道（针对实时捕获的重放）和 BrainBench 固定装置
管道（`gbrain eval --qrels` 与兄弟
[gbrain-evals](https://github.com/garrytan/gbrain-evals) 语料库）。

## 关闭开关

两种方法来禁用捕获：

```bash
unset GBRAIN_CONTRIBUTOR_MODE             # 简单：只需取消设置 env var
```

或通过 `~/.gbrain/config.json` 强制关闭（无论 env var 如何）：

```json
{"eval": {"capture": false}}
```

现有 `eval_candidates` 行保留，直到你 `gbrain eval prune
--older-than 0d`（或只是丢弃表）。

## 失败模式

| 你看到的内容 | 含义 |
|---|---|
| `Mean Jaccard@k: 0.4`，单一来源目录中的所有回归 | 该前缀的来源提升或硬排除回归。 |
| `Top-1 stability: 30%`，平均 Jaccard 仍然很高 | RRF 调优移动了排名顺序而没有更改集 —— 重新调优 `rrfK` |
| `Mean latency Δ: +500ms`，jaccard 高 | 向量路径变慢；检查嵌入 API 或 HNSW 探测。 |
| `rows_errored > 0` | 一个或多个查询抛出。检查人类输出中的前 3 个，或 `--json` 以查看所有 `error_message` 字段。 |
| 许多 `skipped: empty query` | 捕获在某人传递空 `query` 的行上运行 —— 检查为什么那些被捕获。 |

## 公共基准：LongMemEval（v0.28.8）

`gbrain eval longmemeval` 直接针对 gbrain 的混合检索运行公共 [LongMemEval](https://huggingface.co/datasets/xiaowu0162/longmemeval)
基准。与 `eval replay` 不同的评估
轴：带有真实情况标签的公共数据集、端到端
问答管道、每个问题大脑的密封性。

```bash
# 下载数据集（在浏览器中访问 HF 页面；受控/手动下载）。
# 将 longmemeval_oracle.json（或 _s.json）放在本地某处。

# 仅检索（无 LLM 答案生成，最快路径，不需要 Anthropic 密钥）：
gbrain eval longmemeval ./longmemeval_oracle.json --limit 50 --retrieval-only \
  > /tmp/hypothesis.jsonl

# 完整管道（需要 Anthropic 密钥用于答案生成）：
gbrain eval longmemeval ./longmemeval_oracle.json --limit 50 \
  > /tmp/hypothesis.jsonl

# 使用 LongMemEval 发布的 evaluate_qa.py 评分（不捆绑 —— 需要
# OpenAI gpt-4o 根据他们的规范）：
python evaluate_qa.py /tmp/hypothesis.jsonl
```

### 架构（如果你正在触及工具，请阅读此内容）

- 每次基准运行一个在内存中 PGLite，通过 `createBenchmarkBrain` +
  `withBenchmarkBrain`。你的 `~/.gbrain` 是
  永远不会打开。
- 在问题之间：`TRUNCATE` 超过运行时枚举的 `pg_tables`，NOT A
  hardcoded 列表 —— 模式迁移不会静默地在
  问题之间泄漏数据。基础设施表（`sources`、`config`、
  `gbrain_cycle_locks`、`subagent_rate_leases`）在重置之间保留。
- 清理奇偶校验：重新使用 `INJECTION_PATTERNS` 来自
  `src/core/think/sanitize.ts`，因此添加新的注入模式
  自动覆盖论点和基准。一个真相来源。
- 检索到的聊天内容包装在 `<chat_session id="..." date="...">`
  框架中；答案生成系统提示声明内容 UNTRUSTED。
  与 `<take>` 框架相同的姿势。
- LLM 注入接缝：`runEvalLongMemEval(args, {client?: ThinkLLMClient})`。
  测试存根客户端，因此完整管道在没有
  任何 API 密钥的情况下密封运行。

### 标志

| 标志 | 默认 | 目的 |
|---|---|---|
| `--limit N` | 运行所有 | 上限问题计数（快速迭代） |
| `--retrieval-only` | 关闭 | 发出检索块；无 LLM 答案生成 |
| `--keyword-only` | 关闭 | 禁用向量路径（调试检索问题） |
| `--expansion` | **关闭** | 多查询扩展。默认关闭以实现确定性（无每查询 Haiku 调用）。传递以选择加入。 |
| `--top-k K` | 10 | 检索深度 |
| `--model M` | resolved | 默认通过 `resolveModel()` 6 层链解析（`models.eval.longmemeval` 配置密钥） |
| `--output FILE` | stdout | 将假设 JSONL 写入文件而不是 stdout |

### 数字

 p50 25.9ms / p99 30.3ms 温暖重置+导入+搜索在 Apple Silicon 上（根据
`test/eval-longmemeval.test.ts` 性能门）。每问题成本远低于
500ms 速度门。500 个问题 = ~13s 开销加上你的检索和
LLM 延迟。

## 测量大脑一致性随时间的变化（v0.32.6）

`gbrain eval suspected-contradictions` 是一个互补的测量
工具：它对检索结果进行采样以查找未标记语义
矛盾（例如，编译真理 vs 聊天内容、页面内块
vs 活跃论点）。LongMemEval 在固定的标记数据集上测量检索正确性，矛盾探测器测量真实
大脑显示冲突答案的频率。

### 推荐的夜间节奏

```bash
# 每天一次，针对你的前 50 个最频繁查询：
gbrain eval suspected-contradictions \
  --queries-file ~/.gbrain/queries.jsonl \
  --top-k 5 \
  --budget-usd 5 \
  --output ~/.gbrain/probe-runs/$(date +%Y-%m-%d).json
```

持久缓存（`eval_contradictions_cache`）使得重新运行接近零
成本，直到你撞到 `PROMPT_VERSION`。通过以下方式跟踪趋势：

```bash
gbrain eval suspected-contradictions trend --days 30
```

ASCII 条形图显示每天标记的总数。标题 % 表面在
`gbrain doctor`'s `contradictions` 检查，并带有每个高严重性发现的粘贴就绪解决
命令。

### 另见

- `docs/contradictions.md` —— 架构、严重性评分标准、行动标准。
- CHANGELOG `## [0.32.6]` —— 完整发布说明，包括更大的摆动
  决策标准受 Wilson CI 下界限制。
