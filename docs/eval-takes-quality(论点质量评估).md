# `gbrain eval takes-quality` —— 可重复的跨模态质量评估

v0.32+ 为论点层发布了一个 CI 可集成的质量门。三个前沿模型
对论点样本按照 5 维度评分标准进行评分，运行器聚合到
PASS / FAIL / INCONCLUSIVE，并且收据持久化到 `eval_takes_quality_runs`
以便后续的 `trend` 或 `regress` 可以与历史进行比较。

本文档是消费者契约。兄弟 [gbrain-evals](https://github.com/garrytan/gbrain-evals)
仓库和任何未来的 CI 门都读取下面完全一样的 JSON 形状。
字段在 `schema_version: 1` 上是增量稳定的。破坏性形状更改
会提升版本。

## 子命令

| 命令 | 需要大脑？ | 退出代码 |
|---|---|---|
| `gbrain eval takes-quality run [flags]` | 是（论点样本） | 0 PASS, 1 FAIL, 2 INCONCLUSIVE |
| `gbrain eval takes-quality replay <receipt>` | **否**（仅磁盘） | 0 PASS, 1 FAIL, 2 INCONCLUSIVE |
| `gbrain eval takes-quality trend [flags]` | 是（读取运行表） | 0 |
| `gbrain eval takes-quality regress --against <receipt>` | 是 | 0 OK, 1 regression |

`replay` 是唯一在没有 `DATABASE_URL` 的情况下运行的模式——
它从磁盘读取收据文件并重新渲染它。其他模式需要大脑。

## `run` 标志

| 标志 | 默认 | 备注 |
|---|---|---|
| `--limit N` | 100 | 从大脑中随机采样 N 个论点。 |
| `--cycles N` | 3 (TTY) / 1 (非 TTY) | 在放弃之前最多运行 N 个面板调用；在 PASS 或 INCONCLUSIVE 时提前停止。 |
| `--budget-usd N` | 未设置 | 在下一个调用的预计成本会超过上限之前中止。没有 `pricing.ts` 条目的模型在第一次调用之前会响亮地失败（codex #4）。 |
| `--source db|fs` | `db` | `fs` 保留用于 v0.33+。 |
| `--slug-prefix P` | 未设置 | 将论点过滤到 slug 以 P 开头的页面。 |
| `--models a,b,c` | `openai:gpt-4o,anthropic:claude-opus-4-7,google:gemini-1.5-pro` | 逗号分隔的面板。 |
| `--json` | 关闭 | 将完整收据发出到 stdout。 |

## 收据 JSON 形状（`schema_version: 1`）

```json
{
  "schema_version": 1,
  "ts": "2026-05-09T22:00:00.000Z",
  "rubric_version": "v1.0",
  "rubric_sha8": "abcd1234",
  "corpus": {
    "source": "db",
    "n_takes": 100,
    "slug_prefix": null,
    "corpus_sha8": "abcd1234"
  },
  "prompt_sha8": "abcd1234",
  "models_sha8": "abcd1234",
  "models": ["openai:gpt-4o", "anthropic:claude-opus-4-7", "google:gemini-1.5-pro"],
  "cycles_run": 3,
  "successes_per_cycle": [3, 3, 2],
  "verdict": "pass",
  "scores": {
    "accuracy":            { "mean": 7.8, "min": 7, "max": 9, "scores": [9, 7, 7], "per_model": {...} },
    "attribution":         { "mean": 7.0, "min": 7, "max": 7, "scores": [7, 7, 7], "per_model": {...} },
    "weight_calibration":  { "mean": 7.5, "min": 7, "max": 8, "scores": [8, 7, 7], "per_model": {...} },
    "kind_classification": { "mean": 7.2, "min": 7, "max": 8, "scores": [7, 8, 7], "per_model": {...} },
    "signal_density":      { "mean": 7.0, "min": 6, "max": 8, "scores": [8, 7, 6], "per_model": {...} }
  },
  "overall_score": 7.3,
  "cost_usd": 1.85,
  "improvements": ["..."],
  "errors": [],
  "verdictMessage": "PASS: every dim mean >=7 and min >=5 ..."
}
```

### 字段参考

- `schema_version` —— 锁定契约。添加可选字段是增量的
  并且兼容。重命名、移除或更改语义会提升版本。
- `rubric_version` + `rubric_sha8` —— 按评分标准时期隔离趋势
  行（codex review #3）。当评分标准定义更改时，两个字段都会更新，
  并且趋势模式相应地分组运行，因此更严格的评分标准不会
  静默地看起来像质量下降。
- `corpus.corpus_sha8` —— 判断器看到的连接论点文本的指纹。确定两个运行是否针对"相同"样本。
- `models_sha8` —— 排序后的模型 ID 列表的指纹。重新排序
  `--models` 中的模型不会改变 sha（排序是稳定的）。
- `successes_per_cycle` —— 每个周期的贡献模型计数。当一个模型
  贡献时（a）其 JSON 解析 AND（b）每个声明的评分标准维度
  都有一个有限分数（codex review #5 —— 缺少维度会丢弃贡献）。
- `verdict` —— 如果所有维度均值 >= 7 AND 所有维度最小值跨
  贡献模型 >= 5，则为 `pass`；否则为 `fail`；如果少于
  2/3 的模型贡献了完整分数，则为 `inconclusive`。
- `cost_usd` —— 通过 `pricing.ts` 的每个调用成本的总和。未知模型当
  `--budget-usd` 设置时会在任何调用之前产生 `PricingNotFoundError`。

## 收据持久化

收据持久化到 **`eval_takes_quality_runs`**（DB 权威的，每
codex review #6）和到磁盘在 `~/.gbrain/eval-receipts/takes-quality-<corpus>-<prompt>-<models>-<rubric>.json`
作为尽力而为的制品。DB 行在 `receipt_json` JSONB 列中携带完整的收据 JSON，因此当磁盘制品消失时，`replay`
仍然可以通过 `loadReceiptFromDb` 重建（v0.33+ 标志连接）。

4-sha 主键是唯一的（`UNIQUE` 约束），因此重新运行
相同的评估是 `INSERT ... ON CONFLICT DO NOTHING` —— 幂等。

## 趋势输出

纯文本（默认）：

```
ts                   rubric  verdict       overall  cost     corpus
─────────────────────────────────────────────────────────────
2026-05-09T22:00:00  v1.0    pass             7.3   $1.85   abcd1234
2026-05-08T18:30:00  v1.0    fail             6.8   $1.92   ef567890
```

JSON 形状（`--json`）：

```json
{
  "schema_version": 1,
  "rows": [
    { "id": 42, "ts": "...", "rubric_version": "v1.0", "verdict": "pass",
      "overall_score": 7.3, "cost_usd": 1.85, "corpus_sha8": "abcd1234" }
  ]
}
```

## 回归：在质量上设置 CI 门

```bash
# 捕获基线。
gbrain eval takes-quality run --limit 100 --json \
  > .ci/takes-quality-baseline.json

# 稍后，在更改提取提示后：
gbrain eval takes-quality regress --against .ci/takes-quality-baseline.json \
  --threshold 0.5
# 退出 0 → 没有超过阈值的回归
# 退出 1 → 某些维度下降了 > 0.5；CI 失败
```

阈值是计为回归的每个维度平均下降。默认 0.5。
Regress 重新使用先前收据的 **相同** 模型面板 + slug 前缀 + 来源
以进行同类比较。在 `corpus_sha8` /
`prompt_sha8` / `rubric_sha8` 中的 Diffs 作为信息性警告出现（运行器
不会拒绝 —— 那是调用者的决定）。

## 契约稳定性

上面的形状是下游消费者的读取契约。任何
未列出的内容（例如，内部聚合器状态、网关 providerMetadata）都
**不** 在收据中，并且可能会在没有通知的情况下更改。

当你需要演化模式时：
1. **增量可选字段** → 无版本提升；旧消费者忽略
   新键，新消费者读取它。
2. **重命名或移除的字段，或更改的语义** → 将
  `schema_version` 提升到 `2`；运行器发出两个形状一个版本作为
  弃用跑道。

## 另见

- `docs/eval-bench.md` —— 检索评估管道（不同的管道，共享持久化模式）
- `src/core/eval/takes-quality.ts` —— 运行器实现
- `src/core/eval/takes-quality-rubric.ts` —— 5 维度评分标准定义
