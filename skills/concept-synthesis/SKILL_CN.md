---
name: concept-synthesis
version: 0.1.0
description: 去重并将原始概念存根综合为分层智力地图（T1 经典到 T4 变奏），追踪想法随时间跨源的演变。将数千个原始概念页面转换为策划的智力指纹。
triggers:
  - "concept synthesis"
  - "synthesize my concepts"
  - "find patterns across my notes"
  - "build my intellectual map"
  - "trace idea evolution"
  - "canon vs riff"
mutating: true
writes_pages: true
writes_to:
  - concepts/
---

# concept-synthesis — 从原始存根到智力地图

> **约定：** 参见 [conventions/quality.md](../conventions/quality.md) 了解
> 反向链接强制执行和引用保真度要求。
>
> **约定：** 参见 [_brain-filing-rules.md](../_brain-filing-rules.md) —
> 根据主要主题规则在 `concepts/` 下输出文件。

## 这解决了什么

许多摄取管道（signal-detector、idea-ingest、voice-note-ingest）
为提到的每个想法创建一个概念页面。数月后会产生：

- 数千个存根页面，许多重复或近似重复
- 在多个概念页面中重复相同来源的时间线条目
- 无综合 — 只是"用户在此日期提到 X"
- 无层级分配 — 一切都是扁平的
- 无聚类 — 相关想法未链接

此技能将原始材料转换为策划的智力地图。

## 架构

```
阶段1：去重 + 合并（确定性）
  N 个存根 → ~N/4 规范概念
    ├── Jaccard 去重（标题 + 第一段上的词重叠）
    ├── 子字符串去重（"founder mode" vs "founder mode vs manager mode"）
    ├── 语义去重（LLM："这些是相同的想法吗？"）
    └── 将时间线和别名从重复项合并到规范页面

阶段2：评分 + 层级（确定性 + 启发式）
  每个规范概念 → 评分并分层
    ├── 频率：引用此概念的不同来源
    ├── 时间跨度：第一次提到 → 最后一次提到（天数）
    ├── 广度：出现的不同月份
    ├── 参与度：承载概念的来源的平均参与度（如果可用）
    └── 层级：T1 经典 | T2 发展中 | T3 推测性 | T4 变奏

阶段3：综合（LLM，仅 T1+T2）
  T1 + T2 概念 → 丰富综合
    ├── 演变叙述：想法如何随时间 sharpened
    ├── 最佳表达：最高参与度或最精确的引用
    ├── 相关概念：到其他概念的交叉链接
    ├── 上下文：此想法出现/演变时发生了什么
    └── 对立立场：此想法反对什么

阶段4：聚类 + 地图（LLM）
  所有分层概念 → 智力聚类
    ├── 将相关概念分组到域中（通过 LLM 自动命名）
    ├── 生成聚类摘要页面
    ├── 构建带有完整地图的 master concepts/README.md
    └── 识别想法谱系（概念 A → 演变为概念 B）
```

## 调用

技能是 markdown 智能体指令。智能体使用 gbrain 的
现有操作 + LLM 传递：

```bash
# 1. 列出所有概念页面
gbrain query "type:concept" --limit 10000 --json

# 2. 阶段1 去重 — 智能体在本地应用 Jaccard + 子字符串，
#    然后 LLM 传递以识别语义重复。

# 3. 阶段2 层级 — 智能体根据
#    频率/时间跨度/广度对每个规范概念评分，并将层级写入 frontmatter。

# 4. 阶段3 综合 — 对于每个 T1/T2，智能体读取时间线
#    + 关联的源页面，并通过 put_page 将综合部分
#    写入概念页面。

# 5. 阶段4 聚类 — 智能体读取分层概念列表
#    并使用完整的智力地图写入 concepts/README.md。
```

## 输出：概念页面格式（综合后）

### T1 经典 — 完整综合

```markdown
---
title: "概念名称"
type: concept
tier: 1
tier_label: "Canon"
mention_count: 18
distinct_months: 8
first_mention: "YYYY-MM-DD"
last_mention: "YYYY-MM-DD"
composite_score: 78.4
aliases: ["alternate phrasing 1", "alternate phrasing 2"]
related: ["sibling-concept-1", "sibling-concept-2"]
---

# 概念名称

**层级 1 — 经典** | 8 个月内 18 次提及

## 综合

[2-4 段叙述，追踪想法如何演变，它在
用户的世界观中意味着什么，为什么它重要。第三人称分析声音。]

## 最佳表达

> "来自源的逐字引用 — 最精确或最高参与度的
> 此想法的表达。" — [日期](源 URL)

## 演变

| 时期 | 表达 | 信号 |
|--------|-----------|--------|
| YYYY-MM | "第一次表达" | 首次使用 — 愿望框架 |
| YYYY-MM | "Sharpening" | 反模式出现 |
| YYYY-MM | "Peak form" | 最清晰的表达 |

## 相关概念
- [兄弟概念](兄弟概念.md) — 关系描述
- [兄弟概念](兄弟概念.md) — 关系描述

## 时间线
[去重条目的完整时间线，引用，源链接]
```

### T3 / T4 — 仅存根（无 LLM 综合）

```markdown
---
title: "概念名称"
type: concept
tier: 4
tier_label: "Riff"
mention_count: 1
---

# 概念名称

**层级 4 — 变奏** | 1 次提及

> "来自源的引用" — [日期](URL)
```

## 输出：聚类地图在 concepts/README.md

```markdown
# 智力宇宙

## 经典（T1）— N 个概念
永久的智力指纹。跨年份反复出现的想法。

### [聚类名称]
- [概念-slug](概念-slug.md) — 单行特征描述
- ...

### [其他聚类]
- ...

## 发展中（T2）— N 个概念
Sharpening。可能成为经典。

## 推测性（T3）— N 个概念
在公开测试中。

## 统计
- 总概念：N
- T1 经典：N
- T2 发展中：N
- T3 推测性：N
- T4 变奏：N
- 最早来源：YYYY-MM-DD
- 最新来源：YYYY-MM-DD
```

## 质量门

### 去重质量
- 不应有两个概念页面是"用不同词语表达的相同想法"。
- 别名保留在 frontmatter 中以供搜索。
- 运行 `gbrain query "type:concept"` 并抽查计数减少。

### 层级质量
- T1 应该感觉像"是的，那是我反复出现的框架之一" —
  可识别的、反复出现的、清晰的。
- T2 应该感觉像"我正在研究这个；它变得更清晰。"
- 不应有跨度 < 4 个月或 < 6 次提及的 T1 概念。
- 不应有跨度 > 3 个月的 T4 概念。

### 综合质量
- 捕获演变，不仅仅是重复。
- 使用逐字引用，不是释义。
- 链接到相关概念（markdown 链接，不是 wiki-links）。
- 不幻觉来源或日期。

## 定时任务集成

这是繁重的工作。按节奏运行，而不是在每个信号上运行：

- 在主要摄取批次完成后（signal-detector 突发、archive-crawler 运行等）。
- 每周定时任务用于新提升的 T1/T2 概念的增量综合。
- 当语料库显著变化时手动触发完整重新综合。

## 反模式

- ❌ 在 T3/T4 上运行综合 — 浪费 API 预算在可能
  永远不会 sharpen 的想法上。
- ❌ 幻觉引用或日期。时间线必须可验证
  对抗现有大脑页面。
- ❌ 通用聚类名称（"Various Topics"）。如果你不能命名
  聚类，聚类就不是真实的。
- ❌ 在没有新源材料的情况下重新综合已经综合的 T1。
  尊重幂等性。

## 相关技能

- `skills/signal-detector/SKILL.md` — 从文本通道创建原始概念存根
- `skills/voice-note-ingest/SKILL.md` — 音频通道相同
- `skills/idea-ingest/SKILL.md` — 链接/文章相同

## 合约

此技能保证：

- 路由匹配 frontmatter 中的规范触发器。
- 输出写入 `writes_to:` 下列出的目录（如适用）。
- 遵循引用的约定（`quality.md`、`brain-first.md`、`_brain-filing-rules.md`）。
- 保留隐私合约：无真实姓名、无 fork 特定的文件系统路径字面量、无上游 fork 引用。

完整行为合约记录在上面的正文部分；此部分存在用于一致性测试。

## 输出格式

技能的输出形状记录在上面的正文部分的内联中（参见"输出"、"大脑页面格式"或等效项）。此处的字面部分标题存在用于一致性测试（`test/skills-conformance.test.ts`）。
