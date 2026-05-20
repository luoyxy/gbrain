---
name: briefing
description: 编译带有会议上下文、活跃交易和引用跟踪的每日简报
triggers:
  - "daily briefing"
  - "morning briefing"
  - "what's happening today"
tools:
  - search
  - query
  - get_page
  - list_pages
  - get_timeline
mutating: false
---

# 简报技能

从大脑上下文编译每日简报。

> **归档规则：** 当简报创建或更新大脑页面时，
> 遵循 `skills/_brain-filing-rules.md`。

## 合约

- 简报中的每个事实都包括内联 `[来源: slug, 更新日期]` 引用。
- 会议参与者根据大脑解析；差距被明确标记。
- 活跃交易和行动项目包括截止日期和最近上下文。
- 简报是只读的：除非用户明确要求，否则不会创建或修改大脑页面。
- 过时警报显示与今天上下文相关的页面，而不仅仅是所有过时页面。

## 阶段

0. **热记忆脉冲（v0.32）。** 在编写任何其他内容之前，运行：

   ```bash
   gbrain recall --since-last-run --suppressions --pending --rollup --json
   ```

   将结果折叠到顶部的"大脑脉冲"部分下：
   1. **夜间解决的矛盾** — `--suppressions` 输出。首先
      引导它们，因为它们是你对世界模型的新更正。
   2. **热门提及** — 来自 `--rollup` 的 `top_entities`（窗口中按
      事实计数排名的前 5 个实体 slug）。
   3. **自上次简报以来的新事实** — 将 rollup 中每个
      实体下的 `facts` 数组分组；包括 `kind`、`notability` 和 `confidence`。
   4. **待处理整合页脚** — 当 `pending_consolidation_count > 0` 时，
      注意 `N 个事实等待梦想周期整合`，以便操作员可以决定
      是否在进一步阅读之前运行 `gbrain dream`。

   `--since-last-run` 标志推进 `~/.gbrain/recall-cursors/<source>.json`
   因此下一个简报恰好从此简报停止的地方开始。如果你
   将此作为定时任务运行，传递 `--source <slug>` 或显式设置 `GBRAIN_SOURCE` —
   定时任务不会在你的 repo-root cwd 中启动，因此点文件解析
   可能会错过正确的源。瘦客户端安装（`gbrain init --mcp-only`）
   透明地路由通过远程大脑。

1. **今天的会议。** 对于日历上的每个会议：
   - 按名称搜索 gbrain 中的每个参与者
   - 从 gbrain 读取他们的页面以获取 compiled_truth 上下文
   - 总结：他们是谁，最近时间线，与你的关系
2. **活跃交易。** 在 gbrain 中列出过滤到活跃状态的交易页面：
   - 未来 7 天内即将到来的截止日期
   - 最近时间线条目（最近 7 天）
3. **时间敏感线程。** 来自时间线条目的开放项目：
   - 未来 48 小时内有截止日期的项目
   - 已过期的后续行动
4. **最近更改。** 最近 24 小时内更新的页面：
   - 什么更改了以及为什么（从 gbrain 读取时间线条目）
5. **活跃人员。** 在 gbrain 中按最近性排序的人员页面列表：
   - 最近 7 天内更新
   - 有高活动（许多最近时间线条目）
6. **过时警报。** 来自 gbrain 健康检查：
   - 标记为过时但与今天会议相关的页面

## GBrain 原生上下文加载

在生成任何简报之前，系统地从 gbrain 加载上下文。

### 在会议之前

对于每个日历邀请上的与会者：
- `gbrain search "<与会者姓名>"` — 查找他们的大脑页面
- `gbrain get <slug>` — 加载 compiled truth、最近时间线、关系上下文
- 如果页面不存在，注意差距（"Sarah Chen 无大脑页面 — 考虑丰富"）

### 在电子邮件回复之前

在起草或分类任何电子邮件之前：
- `gbrain search "<发件人姓名>"` — 加载发件人上下文
- 读取他们的 compiled truth 以了解他们是谁、他们关心什么，以及
  你们的关系历史。这将冷淡的回复转变为知情的回复。

### 每日简报查询

运行这些查询以填充简报部分：
- `gbrain query "active deals status"` — 交易管道快照
- `gbrain query "meetings this week"` — 带有见解的最近会议页面
- `gbrain query "pending commitments follow-ups"` — 开放线程和行动项目
- `gbrain search --type person --sort updated --limit 10` — 活跃人员

## 输出格式

```
每日简报 — [日期]
========================

今日会议
- [时间] [会议名称]
  参与者：[姓名]（slug: people/name, [关键上下文]）

活跃交易
- [交易名称] — [状态]，截止日期：[日期]
  最近：[最新时间线条目]

行动项目
- [项目] — 截止日期：[日期]，与 [slug] 相关

最近更改（24小时）
- [slug] — [什么更改了]

活跃人员
- [姓名] — [他们为什么活跃]
```

## 简报期间的反向链接

如果简报创建或更新任何大脑页面（例如，新会议准备
页面、更新的实体页面），反向链接铁律适用：每个提到的实体
必须在他们的页面中有反向链接。参见 `skills/_brain-filing-rules.md`。

## 简报中的引用

从大脑页面呈现事实时，包括内联引用：
- "Jane 是 Acme 的 CTO [来源: people/jane-doe, 更新于 2026-04-01]"
- 这让用户可以追溯任何声明回到大脑页面并评估新鲜度

## 反模式

- **没有大脑查询的简报。** 永远不要仅从记忆生成简报；始终查询 gbrain 以获取当前数据。
- **无引用的引用事实。** 每个声明必须包括 `[来源: slug, 更新日期]`。没有引用的事实是无法验证的。
- **作为当前呈现的过时上下文。** 如果页面在 30+ 天内没有更新，明确标记过时性，而不是将其作为新鲜内容呈现。
- **未经提示修改大脑页面。** 简报默认是只读的。除非用户明确要求，否则不要创建或更新页面。
- **忽略覆盖差距。** 当会议参与者没有大脑页面时，说出来。对差距的沉默隐藏了无知。

## 使用的工具

- 按名称搜索 gbrain（query）
- 从 gbrain 读取页面（get_page）
- 按类型列出 gbrain 中的页面（list_pages）
- 检查 gbrain 健康状况（get_health）
- 查看 gbrain 中的时间线条目（get_timeline）
