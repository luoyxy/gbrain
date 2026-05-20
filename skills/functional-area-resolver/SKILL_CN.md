---
name: functional-area-resolver
version: 1.0.0
prompt_version: 1
description: |
  通过将细粒度技能每行表格转换为功能区域调度器来压缩
  智能体的路由文件（RESOLVER.md 或 AGENTS.md）。每个区域
  在 `(dispatcher for: ...)` 子句中列出子技能。LLM 读取一个
  区域条目并路由到正确的子技能。通过留出
  A/B 评估证明：调度器模式优于天真的管道表压缩。
triggers:
  - "compress agents.md"
  - "compress my resolver"
  - "resolver too big"
  - "resolver.md too big"
  - "shrink routing table"
  - "slim down agents.md"
  - "functional area resolver"
  - "functional area dispatcher"
  - "context-health agents"
  - "context-health resolver"
  - "reduce context budget"
tools:
  - exec
  - read
  - write
  - edit
mutating: true
---

# 功能区域解析器 — 用于压缩路由表的模式

## 问题

路由文件（RESOLVER.md、AGENTS.md）随着技能的添加而增长。每个技能
获得自己的行（触发器 -> 技能路径）。在 ~200+ 个技能时，这达到 25-30KB，
消耗应该用于实际工作的上下文预算。

## 解决方案：功能区域调度器

用**每个功能区域一个条目**替换每个区域的 N 行。**每个条目**
在 `(dispatcher for: ...)` 子句中列出它可以调度到的所有子技能。

### 之前（270 行，25KB）

```
- 创建/丰富人员或公司页面 -> `enrich`
- 修复大脑页面中损坏的引用 -> `citation-fixer`
- 发布/共享大脑页面作为链接 -> `brain-publish`
- 从大脑页面生成 PDF -> `brain-pdf`
- 通过问题的镜头阅读书籍 -> `strategic-reading`
- 个性化书籍分析 -> `book-mirror`
- 大脑完整性 -> `brain-librarian`
...
```

### 之后（13 行，13KB）

```
- **大脑与知识**：创建/丰富/搜索/导出大脑页面、归档、
  引用、发布、书籍分析、战略阅读、概念综合、
  档案挖掘 -> `brain-ops`（调度器用于：enrich、query、brain-pdf、
  brain-publish、brain-export、brain-librarian、citation-fixer、book-mirror、
  strategic-reading、concept-synthesis、archive-crawler、...）
```

## 为什么它有效

LLM 不需要每个子技能一行。它需要：

1. **区域识别** — "这是关于大脑页面的" -> 大脑与知识
2. **子技能可见性** — `(dispatcher for: ...)` 列表显示什么是可用的
3. **技能文件本身** — 一旦 LLM 读取 `brain-ops/SKILL.md`，它就具有完整的路由详细信息

这是**两层调度**：路由文件路由到区域，区域
技能路由到特定的子技能。每一层都做好一件事。

## A/B 评估结果

三个解析器架构在三个 Anthropic 前沿模型
（Opus 4.7、Sonnet 4.6、Haiku 4.5）上测试，用于实际的 pos-ph-md 内容，
20 个手动创作的训练夹具 + 5 个留出盲夹具，n=3 种子
每个（夹具、变体）重复。两个评分规则：**严格**（预测的
slug 完全等于预期）和 **宽松**（预测的在
与预期相同的调度器区域中吗？）。两者都重要：

- 严格测量："LLM 返回确切的 slug 吗？"
- 宽松测量："LLM 落在正确的区域中吗，即使它从 `(dispatcher for: ...)` 中挑选了
  更具体的子技能？" 这更接近
  生产行为——落在 `gmail` 中用于电子邮件意图的
  智能体成功，即使解析器条目说 `executive-assistant`。

### 训练语料库（n=20、3 个种子 × 3 个变体、宽松）

| 变体 | Opus 4.7 | Sonnet 4.6 | Haiku 4.5 | 大小 |
|---|---|---|---|---|
| 基线（270 个子弹行） | 81.7% ± 7.2% | 86.7% ± 7.2% | 73.3% ± 7.2% | 25KB |
| **功能区域**（此模式） | **98.3% ± 7.2%** | **100% ± 0%** | **88.3% ± 7.2%** | **13KB** |
| resolver-of-resolvers（无调度器子句） | 63.3% ± 14.3% | 41.7% ± 7.2% | 65.0% ± 12.4% | 10KB |

### 留出盲语料库（n=5、3 个种子、宽松）

| 变体 | Opus 4.7 | Sonnet 4.6 | Haiku 4.5 |
|---|---|---|---|
| 基线 | 100% ± 0% | 100% ± 0% | 100% ± 0% |
| **功能区域** | **100% ± 0%** | **100% ± 0%** | **100% ± 0%** |
| resolver-of-resolvers | 100% ± 0% | **73.3% ± 28.7%** | 100% ± 0% |

### 数据显示的内容

1. **功能区域在所有三个模型上都优于基线**（训练、宽松）+13 到 +17pp，大小为 48%。留出部分在两个部分都饱和在 100%——在误差范围内。

2. **`(dispatcher for: ...)` 子句是承重信号。** resolver-of-resolvers 剥离该子句并坍缩到 Sonnet 上的 41.7%——原始 PR 预测的灾难性失败案例，现在观察到了。

3. **该模式有效，因为 LLM 可以钻入调度器列表。** 大多数"严格失败"是 LLM 挑选更具体的子技能（`gmail` 而不是 `executive-assistant`）。那是按设计工作的模式。严格评分低估了；宽松评分反映了生产智能体行为。

4. **该模式的价值随模型层级缩放。** 压缩增益（功能区域 vs 基线，训练，宽松）在 Opus 上是 +17pp，在 Sonnet 上是 +13pp，在 Haiku 上是 +15pp。Sonnet 显示了功能区域和 resolver-of-resolvers 之间最清晰的分离（100% vs 41.7%）——模型容量影响调度器信号的重要程度。

### 重现

```bash
cd evals/functional-area-resolver
node harness.js --model opus    # ~225 个 LLM 调用，在 Opus 定价时约 $1.70
node harness.js --model sonnet  # ~$1.00
node harness.js --model haiku   # ~$0.30
node rescore.js baseline-runs/2026-05-11-opus-4-7.jsonl  # 零成本重新评分
```

收据（模型、prompt_template_hash、fixtures_hash、harness_sha、ts）：
`evals/functional-area-resolver/baseline-runs/2026-05-11-{opus-4-7,sonnet-4-6,haiku-4-5}.jsonl`。

### 方法论注意事项

- **生产提示很重要。** 使用天真的"return the skill slug"提示
  （没有关于 `(dispatcher for: ...)` 的指令），每个压缩变体
  在 Opus 上坍缩到 ~30-60%。调度器感知的提示在
  `evals/functional-area-resolver/harness-runner.ts:PROMPT_TEMPLATE` 中。将其
  用作智能体 harness 的模板；没有它，压缩就会破坏。
- **训练语料库和变体由同一版本创作。** 留出
  语料库在变体之前编写，从未调整；这减轻了
  但没有消除过度拟合。
- **通过 n=3 种子重复的 t 分布置信区间。** 保留
  n=3 下限：高 CI 意味着底层样本嘈杂。
- **单一供应商结果。** 所有三个模型都是 Anthropic。跨供应商
  验证（Gemini、GPT）是 v0.33.x 后续。
- **留出盲集很小（n=5）。** 在大多数单元格中饱和在 100%——
  harness 无法区分"100%"和"95% 带有一个非确定性
  未命中。" 扩展到 ≥20 是 v0.33.x 后续。

### 先前工作和引用

该模式是分层智能体路由的**静态提示类似物**，一个
2024-2025 研究方向：

- **AnyTool**（[arXiv:2402.04253](https://arxiv.org/abs/2402.04253)）显示
  元智能体 → 类别智能体 → 工具智能体层次结构在 16K API 上以 +35.4pp 击败平面
  检索。 `(dispatcher for: ...)` 子句是
  元智能体的视图坍缩到单个 LLM 传递中。
- **RAG-MCP**（[arXiv:2505.03275](https://arxiv.org/html/2505.03275v1)）
  报告通过基于嵌入的预检索实现 49.2% 提示-令牌减少，增益为 3.2× 准确度。
  令牌减少故事与我们的匹配
  （小 48%），通过不同的机制（RAG vs 静态调度器）。
- **Anthropic 智能体技能**
  （[工程博客](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)）
  促进渐进式披露：前言（~80 个令牌）始终加载，
  SKILL.md 正文在匹配时加载。此技能在
  路由表级别应用相同的原则，而不是每个技能正文级别。

2025-2026 文献没有发布用于**静态提示
分层路由**的基准（每个发布的分层方案通过第二个 LLM 调用在运行时解析
层次结构）。我们的发现——层次结构可以
内联到单个-LLM-传递调度器列表中并保留
路由准确度——是开放的贡献。参见
`evals/functional-area-resolver/README.md` 了解方法论详细信息。

## 如何压缩

### 步骤1：前提条件

如果任一门控失败，拒绝压缩：
- 源路由文件低于 12KB（压缩开销超过收益）。
- `git status` 显示路由文件有未提交的更改（压缩器的编辑将与
  用户正在做的任何事情纠缠）。

如果用户想要覆盖任一门控，他们会使用 `--force` 显式询问。

### 步骤2：何时压缩哪个文件

Gbrain 工作空间通常有两个路由文件在运行时合并（根据
`src/core/check-resolvable.ts` v0.31.7）：`skills/RESOLVER.md` 和兄弟
`../AGENTS.md`。选择要压缩的文件：

- 只有一个是胖的（>12KB）：压缩那个；让小的单独。
- 两个都是胖的：分别压缩它们，按顺序：首先 AGENTS.md
  （通常是 OpenClaw 风格部署中的较大者），然后 RESOLVER.md。
- 只有小的那个是胖的（罕见）：相同规则——压缩它。

如果部署仅使用一个路由文件，此部分是 no-op——
压缩那个。

### 步骤3：识别功能区域

按域对技能分组。典型区域（根据部署调整）：

- **大脑与知识** — brain-ops 作为调度器
- **内容摄取** — ingest 作为调度器
- **日历与调度** — google-calendar 作为调度器
- **电子邮件与通信** — executive-assistant 作为调度器
- **研究与调查** — perplexity-research 作为调度器
- **X/Twitter 与社交** — x-ingest 作为调度器
- **地点与旅行** — checkin 作为调度器
- **产品与构建** — acp-coding 作为调度器
- **基础设施** — healthcheck 作为调度器
- **任务与物流** — daily-task-manager 作为调度器
- **人员与联系人** — google-contacts 作为调度器

### 步骤4：构建区域条目格式

每个区域条目遵循此模板：

```
- **{区域名称}**：{逗号分隔的触发短语} -> `{调度器技能}`
  （调度器用于：{逗号分隔的子技能名称}）
```

规则：
- 触发短语应该足够广泛以捕获意图（"大脑页面、丰富、
  搜索、归档、引用、书籍分析"）
- 子技能列表应该全面——这是 LLM 知道什么可用的方式
- 调度器技能文件应该有自己的内部路由表

### 步骤5：保持始终开启条目分离

门控和始终开启条目（acknowledge、multi-user、entity-detector 等）
保持为单独的行——它们在每条消息上都被检查，而不是被调度。

### 步骤6（强制性）：验证路由准确度

在提交压缩文件之前运行两个门控。如果任一
失败，不要提交。

**门控 1：结构验证。** 确认你的 `routing-eval.jsonl`
夹具在压缩路由文件下仍然解析到正确的技能。
从你刚刚编辑的路由文件的工作空间运行：

```bash
gbrain routing-eval --json
```

如果你的夹具上的准确度下降到低于 95%，还原并调整区域
条目，然后重新运行。

**门控 2：对你的已编辑文件的 LLM A/B 验证。** 确认前沿
LLM 仍然可以钻入调度器列表并到达子技能
在你的特定压缩下。需要一个 gbrain 仓库检出，因为
harness 在那里。将你的已编辑路由文件复制到 harness 的
variants 目录，然后使用指向它的 `--variants` 调用 harness：

```bash
# 在你的智能体工作空间中，识别你刚刚压缩的路由文件。
EDITED=/path/to/your/AGENTS.md       # 或 skills/RESOLVER.md，无论你编辑了什么

# 在你的 gbrain 仓库检出中：
cd /path/to/gbrain/evals/functional-area-resolver
TMP=$(mktemp -d)/variants && mkdir -p "$TMP"
cp "$EDITED" "$TMP/my-edit.md"

# 针对你的文件运行 harness（顺序，每个约 75 次调用 × $0.0076 ≈ Opus 上的 $0.57）。
ANTHROPIC_API_KEY=... node harness.js --variants-dir "$TMP" --variants my-edit \
                                       --model opus --parallel 3 --yes
```

Harness 使用 gbrain 捆绑的夹具集，所以这可以验证"LLM
是否落在 gbrain 捆绑的夹具覆盖的路由意图的正确子技能上"——
共享技能的回归检查，而不是你的
夹具集的完整重新评估。对于完整评估覆盖，将此技能的
`fixtures.jsonl` + `fixtures-held-out.jsonl` 设置镜像为特定
于你的技能的意图。

如果你的变体上的宽松（同一区域）得分下降到低于 95%，还原
压缩并调整。常见原因：
- 子技能从 `(dispatcher for: ...)` 列表中省略。
- 区域的触发短语太窄（LLM 无法识别意图）。
- 区域坍缩得太激进（区域太少——参见反模式）。
- ASCII `->` vs Unicode `→` 不匹配——harness 现在接受两者，但
  早期版本仅匹配 Unicode。将 gbrain 固定到 v0.32.3.0+。

Harness 评估上的常见假阴性（不是你压缩中的 bug）：
- Gbrain 捆绑的夹具针对技能名称，如 `enrich`、`query`、
  `gmail`、`executive-assistant`。如果你的路由文件根本没有
  暴露那些技能， expect 那些夹具上的严格评分失败。
  宽松评分对于你的 `(dispatcher for: ...)` 列表中存在的任何子技能保持准确。

### 步骤7：在提交之前审查差异

向用户呈现提议的编辑（或实际的 git 差异）并等待
显式批准，然后再暂存。与 `skills/book-mirror/SKILL.md` 相同的约定。

## 合约

此技能保证：

- 路由匹配前言中的规范触发器。
- 仅当步骤1中的前提条件通过（文件 ≥12KB 且干净的工作树，或 `--force`）时才执行压缩。
- 步骤6中的强制性验证门控在用户已编辑的文件上触发，而不是在样本变体上。用户在提交压缩文件之前运行 `gbrain routing-eval --json` AND gbrain-repo harness（`node harness.js --variants-dir <tmp> --variants my-edit`）。
- 保留隐私合约：无 fork 特定的文件系统路径字面量（服务器端大脑主页、OpenClaw fork 主页）泄漏到压缩输出中。

完整行为合约记录在上面的正文部分；此部分存在用于一致性测试。

## 输出格式

压缩路由文件遵循步骤4中记录的区域的条目模板（"构建区域条目格式"）。每个条目：`- **{区域名称}**：{触发短语} -> \`{调度器技能}\`（调度器用于：{子技能列表}）`。调度器箭头可以是 ASCII `->`（此模板中的默认）或 Unicode `→`（在一些生产部署中使用）；gbrain harness 接受两者。

## 反模式

- **带有管道表的 Resolver-of-resolvers。** 已测试并失败（参见评估
  表格）。LLM 从表中挑选区域名称，而不是钻入
  子技能。
- **移除子技能名称。** 没有 `(dispatcher for: ...)` 列表，
  LLM 无法路由到特定的子技能。列表是路由信号。
- **区域太少。** 坍缩到 <5 个区域使每个区域太宽。
  12-15 个区域是甜蜜点。
- **区域太多。** 击败目的。如果你有 50 个区域，就保持
  单独的行。

## 维护

添加新技能时：
1. 识别其功能区域。
2. 将该技能名称添加到该区域的 `(dispatcher for: ...)` 列表中。
3. 用路由详细信息更新区域技能文件。
4. 运行路由评估（步骤6）以验证。

添加新功能区域时：
1. 创建带有内部路由的调度器技能。
2. 将区域条目添加到路由文件。
3. 运行路由评估（步骤6）以验证。

## 变更日志

### v1.0.0 — 2026-05-11
- 初始版本。模式在 gbrain v0.32.3.0 中发布，带有留出 A/B
  评估（参见 `evals/functional-area-resolver/`）。
- 技能在发布前从 `compress-agents-md` 重命名为 `functional-area-resolver`；
  贡献是模式，而不是文件名。
