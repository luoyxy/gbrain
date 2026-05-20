---
name: article-enrichment
version: 0.1.0
description: 将大脑中的原始文章文本转储转换为具有执行摘要、逐字引用、关键见解、为什么重要和交叉引用的结构化页面。用可引用、可操作的大脑页面替换文字墙。
triggers:
  - "enrich this article"
  - "enrich the article"
  - "enriching the article"
  - "enrich brain pages"
  - "batch enrich"
  - "enrich pass"
  - "make brain pages useful"
mutating: true
writes_pages: true
writes_to:
  - media/articles/
---

# article-enrichment — 从原始转储到有用的大脑页面

> **约定：** 参见 [conventions/quality.md](../conventions/quality.md) 了解
> 引用规则、逐字引用要求和反向链接强制执行。
>
> **约定：** 参见 [_brain-filing-rules.md](../_brain-filing-rules.md) 了解
> 归档规则。文章页面位于 `media/articles/` 用于原始摄取；
> 个性化的一对一综合输出使用授权的
> `media/articles/<slug>-personalized.md` 例外。

## 这是什么

将一个原始提取文本墙的文章大脑页面重写
为具有以下内容的结构化页面：

- **执行摘要** — 2-3 句话，值得记住的一件事
- **为什么重要** — 连接到用户的具体项目和兴趣
  （从大脑上下文读取，不是假设的）
- **可引用行** — 3-5 个值得在文章中引用的逐字引用
- **关键见解** — 实际见解，不是主题标签
- **令人惊讶或反直觉** — 使此内容独特的内容
- **另见** — 到相关大脑页面的标准 markdown 链接

原始源内容保存在折叠的 `<details>` 部分，所以
原始内容永远不会丢失。

## 何时调用

- 新文章页面通过 media-ingest 进入大脑，带有 `needs_enrichment: true`
- 现有文章页面是 `## Content` 标题下的文字墙，
  没有综合
- 用户说大脑页面无用、无聊或转储
- LLM 判断大脑质量评估未能通过文章页面的
  可引用性或可操作性

## 管道

```
1. 读取      → 打开文章大脑页面；解析 frontmatter + 正文。
2. 扫描      → 查找 ## Content（原始转储）和 ## Executive Summary 的缺失。
3. 上下文   → gbrain 查询文章的关键实体以确定"为什么重要"。
4. 丰富    → Sonnet（默认）或 Opus（用于高价值内容）重构。
5. 写入     → 用结构化部分替换 ## Content；保留原始
               源在 <details> 中；清除 frontmatter 中的 needs_enrichment。
6. 交叉链接→ 从引用的人/公司页面添加反向链接
               （根据 conventions/quality.md 的 Iron Law）。
```

## 调用

技能本身是给智能体的 markdown 指令。它在 v0.25.1 中不提供
确定性 CLI 命令。智能体使用 gbrain 的现有
操作：

```bash
# 1. 查找候选页面
gbrain query "needs_enrichment: true type:article" --limit 50

# 2. 对于每个候选，读取页面
gbrain get media/articles/<slug>

# 3. 通过智能体的 LLM 丰富（默认 Sonnet；高价值用 Opus）
#    智能体读取原始内容 + 大脑上下文 + 写入结构化页面。

# 4. 写入丰富的页面
#    使用带有新结构化 markdown 正文的 put_page 操作。

# 5. 交叉链接实体
#    对于每个提到的人/公司，添加时间线反向链接。
```

## 质量标准

丰富的页面如果具有以下特征则通过：

- ✅ `## Executive Summary`（2-3 句话）
- ✅ `## Quotable Lines`，带有 ≥3 个逐字引用（字面引用，不是释义）
- ✅ `## Key Insights`，带有 ≥3 个项目符号（见解，不是主题标签）
- ✅ `## Why It Matters` 连接到具体的大脑上下文（不是通用）
- ✅ `## See Also`，带有标准 markdown 链接（不是 `[[wiki-links]]`）
- ✅ `<details>` 块保留原始源内容

## 模型选择

| 模型 | 使用时 | 引用准确性 |
|-------|----------|----------------|
| **Sonnet**（默认） | 批量丰富，大多数文章 | 好 — 偶尔释义 |
| **Opus** | 高价值内容、原创思想作品、长篇文章 | 优秀 — 尊重"逐字"指令 |

规则：对于批量丰富，进行 Sonnet 草稿传递并用
LLM 判断大脑质量评估抽查 5 个。如果引用被释义，则
对该批次切换到 Opus。

## 链接约定

所有交叉引用使用标准 markdown 链接：`[标题](relative/path.md)`。
永远不要使用 `[[wiki-links]]` — 它们在 GitHub 上不渲染。

## 反模式

- ❌ 释义引用（"作者认为..."）。引用是逐字的
  或者它们不是引用。
- ❌ 通用"为什么重要"（"这很重要，因为创新"）。
  绑定到具体的大脑上下文或删除该部分。
- ❌ 发明主题标签并称之为见解。见解是
  文章说的你不知道的事情。
- ❌ 丢弃原始源。始终将其包装在 `<details>` 中。
- ❌ 非幂就地重新丰富 — 检查
  frontmatter 中的 `needs_enrichment` 标志；如果已经为 false 则跳过。

## 相关技能

- `skills/media-ingest/SKILL.md` — 创建此技能丰富的原始文章页面
- `skills/idea-ingest/SKILL.md` — 带有作者人员页面强制执行的链接/文章摄取
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
