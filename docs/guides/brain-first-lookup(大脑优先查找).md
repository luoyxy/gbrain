# 大脑优先查找协议

## 目标

在调用任何外部 API 之前检查大脑。大脑几乎总是有东西。外部 API 填补空白，它们不是从头开始。

## 用户得到什么

没有这个：代理为你与之有过 12 次会议的人调用 Brave Search。你得到 LinkedIn 摘要而不是你的关系历史。

有了这个：代理在执行任何其他操作之前拉取你的编译真相、最近时间线条目和共享上下文。外部 API 只填补空白。

## 实现

```
lookup(name_or_topic):
  // 步骤 1：关键词搜索（快速，第一天就有效，不需要嵌入）
  results = gbrain search "{name_or_topic}"
  if results.length > 0:
    page = gbrain get {results[0].slug}
    return page  // 完成，大脑有它

  // 步骤 2：混合搜索（需要嵌入，找到语义匹配）
  results = gbrain query "我们对 {name_or_topic}了解什么"
  if results.length > 0:
    page = gbrain get {results[0].slug}
    return page

  // 步骤 3：直接 slug（如果你知道或可以猜测 slug）
  page = gbrain get "people/{slugify(name_or_topic)}"
  if page: return page

  // 步骤 4：外部 API（仅回退）
  // 只有在这里才到达，因为大脑没有东西
  return external_search(name_or_topic)
```

**这是强制性的。** 在检查大脑之前调用 Brave Search 的代理是在浪费金钱并给出更差的答案。

## 为什么大脑优先

大脑有外部 API 无法提供的上下文：
- 关系历史（你如何认识他们，你们讨论了什么）
- 你自己的评估（你对他们的看法，而不是他们的 LinkedIn 简历）
- 会议记录（说了什么，决定了什么）
- 交叉引用（他们认识谁，他们连接到什么公司）
- 时间线（最近发生了什么变化，什么在趋势中）

LinkedIn 抓取给你他们的工作标题。大脑给你："共同创立 Brex，你和他一起喝过 3 次咖啡，上次讨论了支付基础设施论文，他对你对 AI 代理的看法感兴趣。"

## 棘手的地方

1. **先尝试关键词，然后混合。** 关键词搜索在没有嵌入的情况下工作（第一天）。混合搜索需要嵌入但找到语义匹配。按顺序尝试两者。

2. **模糊 slug 匹配。** `gbrain get` 支持模糊匹配。如果确切的 slug 不存在，它会建议替代方案。将其用于名称变体（"Pedro" → "pedro-franceschi"）。

3. **不要因为"简单"问题而跳过。** 即使"Acme Corp 的地址是什么？"也应该首先检查大脑。大脑可能有它，查找不会增加延迟（关键词搜索 < 100ms）。

4. **加载编译真相 + 最近时间线。** 编译真相让你在 30 秒内了解游戏状态。时间线让你了解最近发生了什么变化。两者一起 = 完整上下文。

## 如何验证

1. 询问大脑中的某人。验证代理首先搜索了大脑（检查响应中的工具调用顺序）。
2. 询问不在大脑中的某人。验证代理搜索了大脑，没找到任何东西，然后回退到外部搜索。
3. 问同样的问题两次。第二次应该立即（大脑有它）。

---

*是 [GBrain Skillpack](../GBRAIN_SKILLPACK.md) 的一部分。另请参阅：[大脑-代理循环](brain-agent-loop.md)、[搜索模式](search-modes.md)*
