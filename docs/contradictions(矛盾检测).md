# gbrain eval suspected-contradictions (v0.32.6)

矛盾探测器对检索结果进行采样，询问 LLM 判断器是否任何一对在与所述用户查询相关的事实声明上相矛盾，并聚合到校准报告中。输出是数据——操作员决定要对什么采取行动。本文档涵盖架构、严重性评分标准、如何解释标题数字以及何时采取行动。

## 为什么存在这个文档

gbrain 通过编译真理加时间线和来源提升来处理*策划*页面中的矛盾：当 `companies/acme.md` 说 MRR 是 $2M，而来自 2024 年的聊天记录说 MRR 是 $50K 时，策划页面排名高于聊天。`takes.active` 过滤隐藏显式被取代的论点。新近性衰减使排名偏向每个来源层级的更新内容。

这些机制都没有衡量：未标记语义矛盾实际上在检索中出现的频率如何？没有探测器，每个"我们应该构建更大的摆动（块级 `revises` 字段 + 排名变更）"决策都是氛围。探测器产生证据。

## 架构

```
        ┌──────────────────────────────┐
        │ gbrain eval suspected-contradictions │
        └──────────────────┬───────────────────┘
                           │
        ┌──────────────────▼───────────────────┐
        │ 对于每个查询：hybridSearch top-K   │
        │ → cross_slug_chunks + intra_page     │
        │   chunk-vs-take pairs                │
        └──────────────────┬───────────────────┘
                           │
        ┌──────────────────▼───────────────────┐
        │ 日期预过滤：跳过日期         │
        │ 相差 >30 天的配对（Codex 修复：     │
        │ 同段落双重日期覆盖）  │
        └──────────────────┬───────────────────┘
                           │
        ┌──────────────────▼───────────────────┐
        │ 持久缓存查找              │
        │ (chunk_a_hash, chunk_b_hash, model,  │
        │  prompt_version, truncation_policy)  │
        └────────┬─────────┬────────────────────┘
              hit│         │miss
                 │         ▼
                 │   ┌─────────────────────────┐
                 │   │ LLM 判断调用          │
                 │   │ → JudgeVerdict          │
                 │   │ 置信度下限 ≥ 0.7  │
                 │   └─────────┬───────────────┘
                 │             │
                 ▼             ▼
        ┌──────────────────────────────────────┐
        │ 聚合每查询 + 全局统计   │
        │ Wilson 95% CI 在标题 %          │
        │ 来源层级细分                │
        │ 热门页面 + 解决提案     │
        └──────────────────┬───────────────────┘
                           │
                           ▼
                  ProbeReport JSON
                           │
        ┌──────────────────┼──────────────────────┬───────────────┐
        ▼                  ▼                      ▼               ▼
   doctor (M1)         MCP (M3)             synthesize (M2)   trend (M5)
   surfaces           find_contradictions    informational     persistent
   findings           op for agents          block in prompt   tracking
```

## 严重性评分标准

判断器为每个发现分配严重性：

| 级别 | 评分标准 | 示例 |
|---|---|---|
| `low` | 命名/格式差异 | "Alice Smith" vs "A. Smith" |
| `medium` | 可能过时的事实值 | 收入数字、员工数、估值 |
| `high` | 身份 / 结构性声明 | 创始人/CEO/CFO 角色、公司状态 |

Doctor 按严重性 DESC 对发现进行排序。MCP 操作接受严重性过滤器，因此代理可以仅获取高优先级项目。

## 如何解释标题数字

探测器输出带有 Wilson 95% 置信区间的 `queries_with_contradiction / queries_evaluated`：

```
Queries with >=1 contradiction: 12 / 50 (24%)  Wilson CI 95%: 14–37%
```

这说明： with 95% confidence, the true rate is between 14% and 37%.
24% 点估计是最可能的值，但受采样噪声限制。**`small_sample_note` 在 n < 30 时触发**——在该规模下，CI 太宽而无法采取行动。

更大摆动（块级 `revises` 字段）的决策标准：

| Wilson CI 下限 | 说明 | 操作 |
|---|---|---|
| < 5% | 来源提升 + 新近性衰减 + 策划页面处理负载 | 停在这里；这是正确的范围 |
| 5–15% | 真实但有界 | 操作员决定成本是否证明摆动合理 |
| > 15% | 真实且实质性 | 在 v0.34+ 中计划更大的摆动 |

## 何时对发现采取行动

每个发现都附带一个 `resolution_command` 字段——准备粘贴：

- `gbrain takes supersede <slug> --row N` —— 较新的论点应该替换同一页面上的较旧块文本（intra_page 种类）。
- `gbrain dream --phase synthesize --slug <slug>` —— 策划实体的 compiled_truth 需要更新（cross_slug 策划对批量）。
- `gbrain takes mark-debate <slug> --row N` ——  intentional disagreement（例如，你想要保留两者的两个意见）。
- `# manual review: <a> vs <b>` —— 判断器不确定；操作员决定。

运行 `gbrain eval suspected-contradictions review --severity high` 以在不重新运行探测器的情况下检查发现。

## 成本模型

默认判断器是 `claude-haiku-4-5`，输入约 $1/Mtok，输出约 $5/Mtok。在 v0.32.6 中，每对截断为 1500 个字符，每次判断调用约 500 输入 + 80 输出 token。预算上限在 TTY 默认为 $5 / 非 TTY 为 $1。

- 约 $0.0006 每次判断调用
- 约 $0.005 每次查询（在日期预过滤 + 缓存命中后）
- 约 $0.50 每 100 次查询

持久缓存意味着针对同一查询集的夜间运行在重新运行时支付接近零的费用（直到你提升 PROMPT_VERSION）。

## 信任姿态

- 探测器从不变异大脑。仅运行读取页面/论点/块。
  写入仅转到 `eval_contradictions_runs` 和 `eval_contradictions_cache`。
- MCP `find_contradictions` 是读取范围。不在子代理允许列表中——
  用户启动的仅，不是自主行动面。
- 构建夹具脚本仅是本地的。`isCleanForCommit` 门使意外私有数据提交变得困难，但操作员必须
  在提交前检查每个编辑。

## 另见

- 计划：`~/.claude/plans/system-instruction-you-are-working-hashed-dewdrop.md`
- CHANGELOG：`## [0.32.6]` 条目涵盖整个发布。
- 成本纪律：`docs/eval-bench.md` 用于推荐的夜间节奏
  + 趋势跟踪工作流。
- **时间轴跟随（v0.35.3.1 + v0.35.7）：** v0.35.3.1 添加了一个
  六成员裁决枚举（`no_contradiction | contradiction |
  temporal_supersession | temporal_regression | temporal_evolution |
  negation_artifact`）并将 `pages.effective_date` 线程化到判断器
  提示中，因此探测器停止对合法随时间变化的狼来了。
  v0.35.7 落地探测器指向的轨迹基底：
  `gbrain eval trajectory <entity>` 显示时间顺序类型化声明
  历史，内联标记回归；`gbrain founder scorecard
  <entity>` 将四个信号（准确性、一致性、增长
  方向、危险信号）滚动到稳定的 JSON 契约。MCP 操作
  `find_trajectory`（读取范围，对远程调用者可见性过滤）
  将相同数据暴露给代理。探测器的 `temporal_supersession`
  裁决和 consolidate 阶段的 `valid_until` 回写都
  保留 `auto-supersession.ts:4` "NEVER auto-applies" 不变量——
  探测器仍然发出准备粘贴的命令，只有 `consolidate`
  写入 `valid_until`（R1+R8 grep 守卫固定此）。
