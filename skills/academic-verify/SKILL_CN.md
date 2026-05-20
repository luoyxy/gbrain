---
name: academic-verify
version: 0.1.0
description: 通过追踪 publication → methodology → raw data → independent replication 来验证研究声明或学术引用。通过 perplexity-research 进行实际的网络查找，然后将结果格式化为引用检查的大脑页面。当书籍/文章/对话引用研究时，你想确认声明是真实的、可复制的、并且准确描述时使用。
triggers:
  - "verify this academic claim"
  - "check this study"
  - "academic verify"
  - "validate citation"
  - "is this study real"
  - "Retraction Watch"
mutating: true
writes_pages: true
writes_to:
  - concepts/
---

# academic-verify — 追踪声明到源数据

> **约定：** 参见 [conventions/quality.md](../conventions/quality.md) 了解
> 引用规则；每个结论都引用源数据，而不仅仅是
> 作者对源数据的声明。
>
> **约定：** 参见 [conventions/brain-first.md](../conventions/brain-first.md)
> 了解查找链。此技能通过在发出新的网络搜索之前
> 检查现有大脑页面来强制执行大脑优先。

## 这是什么

用于学术/研究声明的声明验证流程。当
书籍、文章或演讲者引用研究或引用数字时，此技能
追踪声明通过：

```
声明 → 出版物 → 方法部分 → 原始数据源 → 独立验证
```

在每个步骤中，它回答：

- **这个数字来自哪里？**（自生成？调查？政府数据？）
- **基线是什么？**（从什么减少？在什么时间段内？）
- **原始数据是否可用？**（公开？专有？"应要求提供"？）
- **有人独立验证过吗？**（复制研究？政府审计？）
- **是否有混淆因素？**（其他干预、政策变化、COVID、抽样偏差？）
- **比较公平吗？**（精心挑选的比较组？幸存者偏差？）

输出是 `concepts/<claim-slug>.md` 下的一个大脑页面，记录
声明、追踪和结论——以便将来引用
相同的声明可以重用已验证的分析。

## 何时使用

- 书籍引用研究，你想确认它是真实的而不是
  错误引用
- 文章提出量化声明（"X 将 Y 减少了 40%"），你
  想追踪到源数据
- 你正在撰写依赖于某项研究的内容，你
  想验证基础论文是否成立
- 你正在更新引用研究声明的大脑页面，你
  想同时记录验证状态

## 此技能不是什么

- 不是对抗性/反对工作。重点是严谨，而不是推翻。
- 不是通用网络研究——使用 `perplexity-research` 直接进行
  开放式主题探索。
- 不是仅大脑查找——那是 `gbrain query`。

## 工作原理（D7/α：通过 perplexity-research 的纯路由）

academic-verify 是一个轻量级编排器。实际的网络搜索由 [perplexity-research](../perplexity-research/SKILL.md) 完成。academic-verify
的工作是*工作流*：精确确定声明范围，通过
带引用模式的 perplexity-research 发送，然后将响应
格式化为结论形状的大脑页面。

```
步骤1：确定声明范围
  精确定位到底在声明什么：
    • 引用：谁说了什么？
    • 来源：哪篇论文/数据集/调查？
    • 数字：声明了什么具体数量？
    • 周期：在什么时间范围内？

步骤2：大脑优先查找
  gbrain query "<论文标题> OR <作者名> OR <声明关键词>"
  如果大脑对此声明有先前的验证，请重用它。

步骤3：使用引用模式提示调用 perplexity-research
  将声明 + 大脑上下文发送给 perplexity-research，提示
  明确要求：
    • 原始出版物（标题、作者、期刊、年份、DOI）
    • 方法部分摘要
    • 原始数据可用性（公共仓库？专有？）
    • 独立复制状态（撤稿观察/PubPeer 命中）
    • 批评或上下文化该论文的引用

步骤4：格式化结论
  将结果写入 concepts/<claim-slug>.md。结论为以下之一：
    • 已验证 — 声明准确；原始数据可用；存在复制
    • 部分验证 — 声明在基础论文上是正确的，但
      方法已知有限；明确记录限制
    • 无法验证 — 无公共数据，无复制；不足以行动
    • 错误归因 — 声明引用论文，但论文没有这样说
    • 已撤稿/有争议 — 论文已知撤稿或
      有充分记录的批评

步骤5：交叉链接到原始来源
  如果论文作者有大脑页面，将其添加到 people/，如果不是知名人士则创建一个。
  根据 conventions/quality.md 的 Iron Law。
```

## 输出：大脑页面格式

```markdown
---
title: "[声明摘要] — 已验证"
type: research
date: YYYY-MM-DD
verdict: "verified|partial|unverifiable|misattributed|retracted"
brain_context_slugs: ["作为上下文引用的页面"]
---

# [声明摘要] — 已验证

> 一句话：结论 + 根本原因。

## 声明

> 精确引用，完全按所述，带有来源归属。

## 追踪

| 步骤 | 发现 | 来源 |
|------|---------|--------|
| 原始出版物 | [标题、作者、年份、DOI] | [URL] |
| 方法 | [1行摘要；标记明显限制] | [URL] |
| 原始数据 | [公共仓库/专有/应要求提供] | [URL] |
| 独立复制 | [复制研究及其结果] | [URL] |
| 关键引用 | [批评这项工作的论文] | [URL] |

## 结论

[已验证/部分验证/无法验证/错误归因/已撤稿]

[1-2 段解释为什么得出此结论，附带具体证据。]

## 注意事项

[诚实的限制：我们无法验证什么，什么会改变结论。]

## 另见

- 原始论文：[标题](DOI URL)
- 作者的大脑页面：[作者1](people/author-1.md), ...
- 相关声明（已验证或其他）：[...]
```

## 有用数据库（智能体通过 perplexity-research 使用这些）

| 数据库 | 内容 | URL 模式 |
|----------|-------------|-------------|
| Retraction Watch | 撤稿、更正、关注表达 | retractionwatch.com/?s=NAME |
| PubPeer | 匿名出版后同行评审 | pubpeer.com/search?q=NAME |
| OSF | 预注册、开放数据、开放材料 | osf.io/search/?q=QUERY |
| Semantic Scholar | 引用分析、论文元数据 | api.semanticscholar.org |
| OpenAlex | 开放引用数据、机构归属 | api.openalex.org |
| Many Labs | 社会心理学的复制结果 | osf.io/wx7ck/ |

## 标准（严谨门槛）

- **已验证** — 仅当基础论文存在、原始数据是
  公开的，或者独立实验室已确认结果，并且引用
  来源准确描述声明时。
- **部分** — 论文是真实的，发现成立，但
  引用上下文夸大其词（例如，"X 导致 Y"，而论文显示
  相关性，或"所有研究都发现 X"，而这是一项效力不足的研究）。
- **无法验证** — 基础数字无法追踪到源
  数据，未进行复制，不存在独立确认。
  与"错误"不同——说"我们无法验证"。
- **错误归因** — 引用指向论文，但论文
  实际上没有说引用所声称的内容。在政策简报中很常见。
- **已撤稿/有争议** — 论文已被撤稿，有重大问题
  关注表达，或有充分记录的批评
  与标题发现相矛盾。

绝不能在没有证据的情况下声称有问题。验证文档
本身就是工件——如果声明成立，就直说。如果不成立，
追踪过程会自己说明。

## 反模式

- ❌ 跳过大脑优先查找。重做我们已经
  完成的验证是浪费 Perplexity 支出。
- ❌ 绕过 perplexity-research 并发明查找。来自
  Perplexity 的引用是证据——没有它们，
  结论只是观点。
- ❌ 在未确认原始数据可用性的情况下声明"已验证"。
  复制胜过任何单一论文。
- ❌ 在你只是没有足够努力查找时声明"无法验证"。
  结论是针对来源的，而不是针对你的搜索工作的。

## 相关技能

- `skills/perplexity-research/SKILL.md` — 此技能路由通过的
  实际网络搜索引擎（D7/α：纯路由，无新基础设施）
- `skills/citation-fixer/SKILL.md` — 修复引用格式；此
  技能检查引用的声明是否真实
- `skills/conventions/quality.md` — 引用 + 反向链接规则

## 合约

此技能保证：

- 路由匹配 frontmatter 中的规范触发器。
- 输出写入 `writes_to:` 下列出的目录（如适用）。
- 遵循引用的约定（`quality.md`、`brain-first.md`、`_brain-filing-rules.md`）。
- 保留隐私合约：无真实姓名、无 fork 特定的文件系统路径字面量、无上游 fork 引用。

完整行为合约记录在上面的正文部分；此部分存在用于一致性测试。

## 输出格式

技能的输出形状记录在上面的正文部分的内联中（参见"输出"、"大脑页面格式"或等效项）。此处的字面部分标题存在用于一致性测试（`test/skills-conformance.test.ts`）。
