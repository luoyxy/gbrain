# 想法捕获：原创内容、深度和分发

## 目标

以确切措辞捕获用户的原创想法，带有深度上下文和交叉链接，以便原创文件夹成为大脑中价值最高的内容。

## 用户得到什么

没有这个：在对话中说的绝妙想法消失了。代理听到了"雄心壮志与寿命之比从未如此破碎"并忘记了它。

有了这个：每个原创观察都被逐字捕获，交叉链接到塑造它的任务和想法，并且针对发布潜力进行评级。你的智力档案随着每次对话而增长。

## 实现

```
capture_idea(message_text, source_context):

  # 1. 作者身份测试 — 这个想法属于哪里？
  if user_generated_the_idea(message_text):
    destination = "brain/originals/{slug}.md"
  elif user_synthesis_of_others(message_text):
    destination = "brain/originals/{slug}.md"  # 综合是原创的
  elif world_concept(message_text):
    destination = "brain/concepts/{slug}.md"
  elif product_or_business_idea(message_text):
    destination = "brain/ideas/{slug}.md"
  elif ghostwritten_by_user(message_text):
    destination = "brain/originals/{slug}.md"  # 在元数据中注意代笔者
  elif article_about_user(message_text):
    destination = "brain/media/writings/{slug}.md"

  # 2. 用确切措辞捕获 — 永远不要释义
  page = create_or_update(destination, {
    content: message_text,          # 逐字，不是摘要
    source: source_context,         # 对话、会议、时刻
    reasoning_path: influences,     # 什么导致了这个洞察力
    depth_context: emotional_nuance # 什么背后的原因
  })

  # 3. 原创性评级（针对值得注意的想法）
  if is_notable(message_text):
    rate_originality(page, populations=[
      "general_population", "tech_industry",
      "intellectual_media", "political_establishment"
    ])

  # 4. 交叉链接（强制性 — 没有链接的原创内容是死的）
  link_to_people(page, mentioned_people)
  link_to_companies(page, mentioned_companies)
  link_to_meetings(page, source_meeting)
  link_to_media(page, influences)
  link_to_other_originals(page, related_ideas)
  link_to_concepts(page, referenced_concepts)

  # 5. 同步
  gbrain sync --no-pull --no-embed
```

### 作者身份测试

| 信号 | 目的地 |
|--------|-------------|
| 用户生成的想法 | `brain/originals/{slug}.md` |
| 用户对他人想法的独特综合 | `brain/originals/`（综合是原创的） |
| 其他人创造的世界概念 | `brain/concepts/{slug}.md` |
| 产品或商业想法 | `brain/ideas/{slug}.md` |
| 用户代笔的书籍/文章 | `brain/originals/`（在元数据中注意代笔者） |
| 关于用户的文章 | `brain/media/writings/` |

### 捕获标准

**使用用户的确切措辞。** 语言就是洞察力。

"雄心壮志与寿命之比从未如此破碎" 捕获了一些东西，而
"雄心壮志与死亡之间的紧张关系" 没有。不要清理它。不要释义。
生动的版本是真实版本。

**什么算作值得捕获的：**
- 关于世界如何运作的原创观察
- 不同事物之间的新颖连接
- 框架和心理模型
- 模式识别时刻（"我不断在每个 Y 中看到 X"）
- 带有其背后推理的热门话题
- 揭示新角度的隐喻
- 关于自己或他人的情感/心理洞察力

**什么不算：**
- 常规操作消息（"好的"、"做它"）
- 没有嵌入观察的纯问题
- 回响代理所说的
- 确认和反应

### 深度测试

**一个不熟悉的用户可以阅读此页面并理解不仅是他们认为什么，还有为什么以及他们如何到达那里的吗？**

如果答案是否定的，它需要更多深度。包括：
- 推理路径（什么导致了洞察力）
- 影响（他们在阅读/观看/体验什么）
- 上下文（对话、会议、时刻）
- 情感或心理细微差别

### 原创性分发评级

对于值得注意的想法，对不同人群进行 0-100 的原创性评级：

```markdown
## 原创性分发

- **普通人群：** 72/100 — 大多数人没有遇到过这个框架
- **科技行业：** 45/100 — 在创业圈中常见，但对大多数人来说是新奇的
- **智力/媒体阶级：** 68/100 — 会引起共鸣，但尚未表达
- **政治 establishment：** 82/100 — 对政策思维完全陌生
```

**发布信号：** 强有力的文章候选。最佳受众：创始人、构建者。

这告诉用户哪些想法值得转化为文章、演讲或视频，以及哪些受众会发现它们最新奇。

### 深度交叉链接授权

**没有交叉链接的原创内容是死胡同。** 连接就是智能。

每个原创内容必须链接到：
- **塑造了这种想法的人物**
- **这个想法发挥作用的公司**
- **讨论了它的会议**
- **影响了它的书籍和媒体**
- **它连接到的其他原创内容（想法形成集群）**
- **它建立或挑战的概念**

### 重要性过滤

在创建任何实体页面之前，检查重要性：

**为以下创建一个页面：**
- 你认识或具体讨论的人物
- 你正在评估、合作或投资的公司
- 你带有个人反应的媒体
- 你明确互动过的任何人

**不要为以下创建页面：**
- 通用引用或经过示例
- 只提及你一次的低参与度帐户
- 纯隐喻（"像罗马帝国一样..."）
- 没有后续的一次性邂逅

**决策：** 如果值得注意并且不存在页面，则使用网络搜索丰富创建一个完整页面。没有存根。如果你创建一个页面，把它做好。

## 棘手的地方

1. **综合是原创的。** 当用户以新方式连接两个现有想法时，该综合属于 `brain/originals/`，而不是 `brain/concepts/`。即使组件想法不是新的，新颖的组合也是洞察力。

2. **确切措辞是不可协商的。** 永远不要释义、总结或"清理"用户的语言。"雄心壮志与寿命之比从未如此破碎" 就是洞察力。"雄心壮志与死亡之间的紧张关系" 是一具尸体。捕获第一个版本。

3. **交叉链接是强制性的，不是可选的。** 没有链接到塑造它的人物、公司、会议和概念的原创内容是死的原创内容。连接就是智能。在考虑捕获之前，检查每个原创内容是否至少有 2 个交叉链接。

## 如何验证

1. **生成一个想法并检查页面。** 在对话中说一些原创的东西（例如，"如果 Markdown 文件实际上是分布式软件会怎样？"）。验证 `brain/originals/{slug}.md` 是用你的确切措辞创建的，而不是释义。

2. **检查交叉链接是否存在。** 打开新创建的原创页面。它应该至少链接到提及的人物或概念。打开那些链接的页面并验证它们反向链接到原创内容。

3. **验证深度测试通过。** 作为一个陌生人阅读捕获的页面。你不仅能理解用户认为什么，还能理解为什么？如果推理路径和上下文丢失，捕获是不完整的。

---

*是 [GBrain Skillpack](../GBRAIN_SKILLPACK.md) 的一部分。*
