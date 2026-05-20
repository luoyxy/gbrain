---
name: query
version: 1.0.0
description: |
  使用脑的知识通过3层搜索、综合和引用传播来回答问题。
  当用户提问、想要查找或需要脑中的信息时使用。
triggers:
  - "我们知道关于"
  - "告诉我关于"
  - "谁是"
  - "发生了什么"
  - "搜索"
  - "查找"
  - "关于...的背景"
  - "关于...的笔记"
  - "谁认识谁"
  - "之间的关系"
  - "连接"
  - "图查询"
tools:
  - search
  - query
  - get_page
  - list_pages
  - get_backlinks
  - traverse_graph
  - get_timeline
mutating: false
---

# 查询技能

使用脑的知识通过3层搜索和综合来回答问题。

## 契约

本技能保证：
- 每个答案都基于脑内容（无幻觉）
- 每个声明都有追溯到特定页面slug的引用
- 明确标记缺口（"脑没有关于X的信息"）
- 尊重来源优先级（用户陈述 > 编译真理 > 时间线 > 外部）
- 注意冲突的来源及两者的引用

## 阶段

1. **分解问题**为搜索策略：
   - 关键字搜索特定名称、日期、术语
   - 概念性问题的语义查询
   - 关系问题的结构化查询（按类型列出、反向链接）
2. **执行搜索：**
   - 关键字搜索gbrain进行FTS匹配（search）
   - 混合搜索gbrain进行语义+关键字扩展（query）
   - 按类型列出gbrain中的页面或检查反向链接以进行结构化查询
3. **阅读顶部结果。** 从gbrain读取前3-5个页面以获取完整上下文。
4. **综合答案**并附上引用。每个声明都追溯到特定的页面slug。
5. **标记缺口。** 如果脑没有信息，说"脑没有关于X的信息"，而不是产生幻觉。

## 反模式

- 在脑有相关内容时从一般知识回答
- 幻觉脑中不存在的事实
- 来源冲突时静默选择一个来源
- 搜索块足够时加载完整页面
- 忽略来源优先级（用户陈述是最高权威）

## 输出格式

答案应包括：
- 对问题的直接回应
- 引用："根据[Source: people/jane-doe, compiled truth]..."
- 缺口标记："脑没有关于X的信息"
- 来源不一致时的冲突说明

## 质量规则

- 永远不要幻觉。仅从脑内容回答。
- 引用来源："根据concepts/do-things-that-dont-scale..."
- 标记陈旧结果：如果搜索结果显示[STALE]，注意信息可能过时
- 对于"谁"的问题，使用反向链接和类型化链接查找连接
- 对于"发生了什么"的问题，使用时间线条目
- 对于"我们知道什么"的问题，直接读取compiled_truth

## Token预算意识

搜索返回**块**，而不是完整页面。在决定是否加载完整页面之前先读取摘录。

- `gbrain search` / `gbrain query` 返回带有上下文片段的排名块。
  这些通常足以直接回答问题。
- 仅当块确认页面相关且你需要更多上下文（例如，compiled truth、时间线）时才使用`gbrain get <slug>`加载完整页面。
- **"告诉我关于X"** -- 获取完整页面（用户想要完整的图片）。
- **"有人提到Y吗？"** -- 搜索结果足够（用户想要是/否及证据）。

### 来源优先级

当多个来源提供冲突信息时，遵循此优先级：

1. **用户的直接陈述**（最高权威 -- 用户直接告诉你的）
2. **编译真理**（脑的综合、引用理解）
3. **时间线条目**（原始证据，反向时间顺序）
4. **外部来源**（网络搜索、API丰富 -- 最低权威）

当来源冲突时，注意矛盾及两个引用。不要静默选择一个。

## 答案中的引用

在答案中引用脑页面时，传播内联引用：
- 引用页面："根据[Source: people/jane-doe, compiled truth]..."
- 当脑页面有内联`[Source: ...]`引用时，传播它们，以便用户可以追溯到事实的起源
- 当跨多个页面综合时，引用所有来源

## 图遍历（v0.10.1+）

对于关系问题（"谁在X认识谁？"、"A和B之间的连接"、"谁在Acme工作？"、"谁参加了standup？"），使用图层而不是全文搜索：

- `gbrain graph-query <slug> --type <link_type> --depth N --direction in|out|both`
- 可用的链接类型：`attended`, `works_at`, `invested_in`, `founded`, `advises`, `mentions`, `source`
- `--direction in` 回答"谁指向X？"（例如，谁在X公司工作）
- `--direction out` 回答"X指向什么？"（默认）
- `--depth N` 控制多跳遍历（默认5）

示例：
- "谁在Acme工作？" → `gbrain graph-query companies/acme --type works_at --direction in`
- "谁参加了Demo Day W26？" → `gbrain graph-query meetings/demo-day-w26 --type attended --direction out`
- "Emily顾问了哪些公司？" → `gbrain graph-query people/emily --type advises --direction out`
- "Alice会见了谁（通过会议）？" → `gbrain graph-query people/alice --type attended --depth 2`

结合`gbrain query`用于需要**语义相似性**和图结构的查询。搜索结果通过小的反向链接提升进行排名，因此连接良好的实体会更高地浮出水面。

## 搜索质量意识

如果搜索结果看起来不对（错误的结果、缺少已知页面、不相关的命中）：
- 运行`gbrain doctor --json`检查索引健康状况
- 检查嵌入覆盖率 -- 部分嵌入会降低混合搜索
- 比较关键字搜索（`gbrain search`）与混合搜索（`gbrain query`）
  对于相同的查询，以隔离问题是否与嵌入相关
- 在maintain工作流中报告搜索质量问题（参见maintain技能）

## 使用的工具

- 关键字搜索gbrain（search）
- 混合搜索gbrain（query）
- 从gbrain读取页面（get_page）
- 使用过滤器列出gbrain中的页面（list_pages）
- 检查gbrain中的反向链接（get_backlinks）
- 遍历gbrain中的链接图（traverse_graph）
- 查看gbrain中的时间线条目（get_timeline）
