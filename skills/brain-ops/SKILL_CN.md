---
name: brain-ops
version: 1.0.0
description: |
  大脑知识库操作。核心读/写循环：大脑优先查找、
  读-丰富-写循环、来源归属、环境丰富、反向链接。
  在任何大脑交互之前阅读此内容。
triggers:
  - any brain read/write/lookup/citation
tools:
  - search
  - query
  - get_page
  - put_page
  - add_link
  - add_timeline_entry
  - get_backlinks
  - sync_brain
mutating: true
writes_pages: true
writes_to:
  - people/
  - companies/
  - deals/
  - concepts/
  - meetings/
---

# 大脑操作 — 环境上下文层

大脑不是档案。它是一个活生生的上下文膜，每个交互
都双向流动。

> **约定：** 参见 `skills/conventions/brain-first.md` 了解 5 步查找协议。
> **约定：** 参见 `skills/conventions/quality.md` 了解引用和反向链接规则。

## 合约

此技能保证：

- 在任何外部 API 调用之前检查大脑（大脑优先查找）
- 每个入站信号触发 读取 → 丰富 → 写入 循环
- 每个出站响应检查大脑以获取相关上下文
- 写入的每个事实都有来源归属（内联 `[来源: ...]` 引用）
- 用户的直接陈述是最高权威数据源
- 每次大脑写入时维护反向链接（铁律）

## 铁律：反向链接（强制性）

每次提到有大脑页面的人员或公司必须创建从
该实体页面到提到它们的页面的反向链接。未链接的提及是
损坏的大脑。参见 `skills/conventions/quality.md` 了解格式。

## 阶段

### 阶段1：大脑优先查找（强制性）

在使用任何外部 API 研究人员、公司或主题之前：

1. `gbrain search "name"` — 对现有页面的关键词搜索
2. `gbrain query "关于 name 的自然问题"` — 用于上下文的混合搜索
3. `gbrain get <slug>` — 如果你知道 slug，读取完整页面
4. 检查反向链接：谁引用此实体？
5. 检查时间线：涉及此实体的最近事件

大脑几乎总是有内容。外部 API 填补空白，而不是从头开始。

### 阶段2：在每个入站信号上（读取 → 丰富 → 写入）

每个提及人员或公司的消息、会议、电子邮件或对话：

1. **检测实体** — 提到的人、公司、交易
2. **加载大脑页面** — 在响应之前读取现有页面以获取上下文
3. **识别新信息** — 此信号告诉我们页面不知道什么？
4. **写回** — 用新信息 + 时间线条目 + 来源引用更新大脑页面
5. **如果缺失则创建** — 如果显著且不存在页面，通过丰富技能创建

**用户的直接陈述是最高价值的数据源。** 立即将它们写入大脑
页面并归属 `[来源: 用户, YYYY-MM-DD]`。

### 阶段2.5：结构化图谱更新（自动）

每个 `put_page` 调用自动提取实体引用并将它们
写入图谱（`links` 表），带有推断的关系类型。过时链接
（不再在页面文本中的引用）在同一调用中删除。这是
"自动链接"对账。

- 普通页面写入不需要手动 `add_link` 调用。
- 推断的链接类型：`attended`（会议 -> 人员）、`works_at`、`invested_in`、
  `founded`、`advises`、`source`（frontmatter）、`mentions`（默认）。
- `put_page` MCP 响应包括 `auto_links: { created, removed, errors }`
  以便智能体可以验证结果。
- 要禁用：`gbrain config set auto_link false`。默认开启。
- 带有具体日期的时间线条目仍需要显式的 `gbrain timeline-add`
  （或通过 `gbrain extract timeline --source db` 批量）。

### 阶段3：在每个出站响应上（读取 → 拉取 → 响应）

在回答关于人员、公司或主题的任何问题之前：

1. **检查大脑** — 读取相关页面
2. **拉取上下文** — 使用编译的真相 + 最近时间线
3. **用上下文响应** — 大脑使每个答案更好

当存在大脑页面时，不要从一般知识回答。

### 阶段4：环境丰富

这不是特殊模式。这是默认设置。用户说的一切都是
摄取事件。

- 提到人员 → 检查大脑，根据需要创建/丰富（生成后台）
- 提到公司 → 相同
- 共享链接 → 摄取它（委托给 idea-ingest）
- 共享数据 → 委托给适当的技能

**规则：**
- 永远不要打断对话进行丰富
- 为任何会减慢响应的内容生成子智能体
- 永远不要宣布"我正在丰富大脑" — 只是静默地做

## 输出格式

无单独输出。大脑操作是始终开启的行为层，而不是报告生成器。
输出是更新的大脑页面和丰富的响应。

## 跨源引用格式（v0.18.0+）

当大脑有多个来源（wiki、gstack、yc-media 等）时，每个
引用必须包括源 ID：`[source-id:slug]`。示例：

> 你告诉我关于重试预算方法 — 参见
> [wiki:topics/resilience] 和 [gstack:plans/retry-policy] 了解
> 这来自哪里。

规则：
- 键是 `sources.id`（不可变），永远不是 `sources.name`（可变的显示）。
- 单源大脑仍写入 `[default:slug]` 或可以省略前缀
  以向后兼容。
- `search`、`query`、`get_page`、`list_pages` 返回的每个页面负载
  都携带 `source_id` — 引用时始终使用它，永远不要猜测。

如果搜索结果有 `source_id: "gstack"` 和 `slug: "plans/foo"`，
则引用是 `[gstack:plans/foo]`。这就是整个规则。

## 反模式

- 在不首先检查大脑的情况下回答关于人员/公司的问题
- 在检查大脑之前使用外部 API
- 写入没有内联 `[来源: ...]` 引用的事实
- 阻断响应进行丰富
- 用较低权威来源覆盖用户的直接陈述
- 为非显著实体创建大脑页面

## 使用的工具

- `search` — 关键词搜索
- `query` — 混合向量+关键词搜索
- `get_page` — 读取大脑页面
- `put_page` — 创建/更新大脑页面
- `add_link` — 交叉引用实体
- `add_timeline_entry` — 记录事件
- `get_backlinks` — 检查谁引用实体
- `sync_brain` — 将更改同步到索引
