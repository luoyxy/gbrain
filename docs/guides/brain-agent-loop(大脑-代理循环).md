# 大脑-代理循环

## 目标

每次对话都让大脑更聪明。每次大脑查找都让响应更好。这个循环每天复合。

## 用户得到什么

没有这个：代理从陈旧上下文回答。你周一讨论一笔交易，到周五代理已经忘记。每次对话都从零开始。

有了这个：六个月后，代理比你工作记忆中能容纳的更了解你的世界。它永远不会忘记。它永远不会停止索引。

## 循环

```
信号到达（消息、会议、电子邮件、推文、链接）
  │
  ▼
检测实体（人物、公司、概念、原创想法）
  │  → 生成子代理（参见 entity-detection.md）
  │
  ▼
读取：首先检查大脑（在响应之前）
  │  → gbrain search "{实体名称}"
  │  → gbrain get {slug}（如果你知道它）
  │  → gbrain query "我们对 {主题}了解什么"
  │
  ▼
响应（带有大脑上下文，每个答案都因上下文而更好）
  │
  ▼
写入：更新大脑页面（新信息 → 编译真相 + 时间线）
  │  → gbrain put {slug}（更新页面）
  │  → add_timeline_entry（追加到时间线）
  │  → add_link（交叉引用到其他实体）
  │
  ▼
同步：gbrain 索引更改
  │  → gbrain sync --no-pull --no-embed
  │
  ▼
（下一个信号到达 — 代理现在更聪明了）
```

## 实现

### 在每个入站消息上

```
on_message(text):
  // 1. 检测（异步，不要阻塞）
  spawn_entity_detector(text)

  // 2. 读取（在编写响应之前）
  entities = extract_entity_names(text)  // 快速 regex/NER
  context = []
  for name in entities:
    results = gbrain_search(name)
    if results:
      page = gbrain_get(results[0].slug)
      context.append(page.compiled_truth)

  // 3. 响应（注入了大脑上下文）
  response = compose_response(text, context)

  // 4. 写入（响应后，如果出现新信息）
  if response_contains_new_info(response):
    for entity in mentioned_entities:
      gbrain_add_timeline_entry(entity.slug, {
        date: today,
        summary: "讨论了 {主题}",
        source: "[来源：用户、对话、{日期}]"
      })

  // 5. 同步
  gbrain_sync()
```

### 两个不变量

1. **每次读取都改进响应。** 如果你在查看某人的大脑页面之前回答关于他的问题，你给出的答案比你可能的更差。大脑几乎总是有东西。外部 API 填补空白，它们不是从头开始。

2. **每次写入都改进未来的读取。** 如果会议记录提到了关于公司的新信息而你没有更新公司页面，你就创造了一个以后会困扰你的空白。

## 棘手的地方

1. **在响应之前读取，而不是之后。** 诱惑是先响应然后稍后更新大脑。但大脑上下文让响应更好。先读取。

2. **不要跳过写入步骤。** "我稍后会更新大脑"意味着永远不。在对话之后立即写入，当上下文还新鲜时。

3. **在每次写入批次之后同步。** 没有同步，大脑搜索索引是陈旧的。下一个查询不会找到你刚刚写的内容。

4. **外部 API 是回退，不是主要的。** 在 Brave Search 之前使用 `gbrain search`。在 Crustdata 之前使用 `gbrain get`。大脑有关系历史、你自己的评估、会议记录、交叉引用。没有外部 API 能提供这些。

## 如何验证它有效

1. **提及大脑认识的人。** 问"我们对 {姓名}了解什么？"代理应该搜索大脑并返回编译真相，而不是幻觉或进行网络搜索。

2. **讨论关于已知实体的新内容。** 说"我听说 Acme Corp 刚刚完成了 B 轮融资。"对话之后，检查：Acme Corp 的大脑页面是否有新的时间线条目？

3. **一天后问同一个人。** 代理应该立即拉取大脑上下文，无需你询问。如果它没有引用大脑页面，循环就没有运行。

4. **检查同步。** 对话之后，从 CLI 运行 `gbrain search "{主题}"`。新信息应该是可搜索的。

---

*是 [GBrain Skillpack](../GBRAIN_SKILLPACK.md) 的一部分。另请参阅：[实体检测](entity-detection.md)、[大脑优先查找](brain-first-lookup.md)*
