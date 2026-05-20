# 操作规范#

## 目标#

五个不可协商的规则，将生产 brain 与 demo 分开 — 每个消息上的信号检测、brain 优先查找、每次写入后同步、每日心跳和夜间梦境循环。

## 用户得到什么#

没有这个：代理回答问题但忘记一切。你在会议中提及 Pedro，下周代理不会知道 Pedro 是谁。

有了这个：每个人、公司和想法在每次对话中都会获得一个 brain 页面。下次 Pedro 出现时，代理已经有上下文。Brain 复合。

## 实现#

```
# 规范 1：每个消息上的信号检测（强制性）
on every_inbound_message(message):
    # 1. 生成异步 — 不要阻塞响应
    spawn_subagent({
        model: "sonnet-fast",     # 廉价 + 快速，不是 opus
        timeout: 120,              # 秒
        task: build_detection_prompt(message)
    })

    # 2. 正常响应用户
    # 子代理在后台运行


# 规范 2：在外部 API 之前 Brain 优先查找（强制性）
on information_needed(topic):
    # 始终首先检查 brain
    brain_result = gbrain search "{topic}"
    if brain_result:
        page = gbrain get <slug>
        # 首先使用 brain 数据。外部 API 填补空白。

    # 仅当 brain 没有时才使用外部 API
    else:
        external_result = brave_search("{topic}")


# 规范 3：每次写入后同步（强制性）
on brain_write_complete():
    gbrain sync
    # 没有这个，搜索结果是陈旧的。你刚刚写入的页面
    # 在 gbrain search 或 brain query 中不会出现，直到同步运行。


# 规范 4：每日心跳检查
on daily_schedule("09:00"):
    gbrain doctor
    # 检查：数据库连接性、嵌入健康状态、同步状态、
    # 页面计数、陈旧页面、断开的链接
    # 如果 doctor 报告问题，在做任何其他事情之前修复它们。


# 规范 5：夜间梦境循环
on nightly_schedule("02:00"):
    # 梦境循环是最重要的规范。Brain 复合过夜。

    # 5a：实体扫描
    conversations = get_todays_conversations()
    for message in conversations:
        entities = detect_entities(message)
        for entity in entities:
            page = gbrain search "{entity.name}"
            if not page:
                create_page(entity)        # 新实体，创建 + 丰富
            elif page.is_thin():
                enrich_page(entity)        # 单薄页面，填充它
            else:
                update_timeline(entity)    # 现有页面，添加今天的提及

    # 5b：修复断开的引用
    pages = gbrain list --type person --limit 100
    for page in pages:
        for entry in page.timeline:
            if not entry.has_source_attribution():
                fix_citation(entry)        # 在缺少的地方添加 [Source: ...]

    # 5c：整合记忆
    patterns = detect_patterns_across_conversations()
    for pattern in patterns:
        promote_to_memory(pattern)     # 短暂的 → 持久的知识

    # 5d：同步
    gbrain sync --no-pull --no-embed
```

### 什么算作原创想法#

| 捕获 | 不要捕获 |
|---|---|
| 关于世界如何运作的原创观察 | "好的"、"做它"、"当然" |
| 不同事物之间的新颖连接 | 没有观察的纯问题 |
| 框架和心理模型 | 回响代理所说的 |
| 模式识别（"我不断在每 Y 中看到 X"） | 确认和反应 |
| 带有推理的热门话题 | 常规操作消息 |
| 揭示新角度的隐喻 | 没有嵌入洞察力的请求 |

### 归档规则#

| 信号 | 目的地 |
|---|---|
| 用户生成的想法 | `brain/originals/{slug}.md` |
| 用户对他人想法的综合 | `brain/originals/`（综合是原创的） |
| 其他人创造的世界概念 | `brain/concepts/{slug}.md` |
| 产品或商业想法 | `brain/ideas/{slug}.md` |
| 提及的人物 | `brain/people/{slug}.md` |
| 提及的公司 | `brain/companies/{slug}.md` |
| 引用的媒体 | `brain/media/{type}/{slug}.md` |

### 反向链接的铁律#

每个实体提及必须从实体页面到此来源创建反向链接。这不是可选的。

```
# 当消息提及 "Pedro" 并创建会议页面时：

# 1. 更新会议页面（正常）
brain/meetings/2026-04-10-board-sync.md：
  - Pedro 介绍了 Q1 数字

# 2. 也更新 Pedro 的页面（反向链接）
brain/people/pedro-franceschi.md：
  ## 时间线
  - **2026-04-10** | 在董事会同步中介绍了 Q1 数字
    [来源：用户、董事会会议、2026-04-10]
```

没有反向链接，你无法遍历图谱。"显示与 Pedro 相关的一切" 仅在 Pedro 的页面链接回每个提及时才有效。

## 棘手的地方#

1. **不要阻塞对话。** 实体检测是异步运行的。用户应该立即看到响应，而不是等待子代理丰富 5 个实体页面 2 分钟。

2. **Sonnet，不是 Opus。** 实体检测是模式匹配，不是深度推理。Sonnet 便宜 5-10 倍并且足够快。对主对话使用 Opus。

3. **确切措辞很重要。** "Markdown 实际上是代码" 是一个洞察力。"Markdown 可以用作代码" 是一个摘要。捕获第一个版本。

4. **不要创建存根。** 如果你创建一个页面，把它做好。运行网络搜索，构建编译真相，添加上下文。只有名称的存根页面比没有页面更糟糕（它给出错误的信心）。

5. **在创建之前去重。** 始终在创建页面之前 `gbrain search`。变体拼写、昵称和公司缩写会导致重复。"Pedro" 和 "Pedro Franceschi" 可能是同一个人。

## 如何验证#

1. **发送提及某人的消息。** 说"我今天与 Acme Corp 的 Sarah Chen 一起喝了咖啡。" 验证：brain/people/sarah-chen.md 被创建或更新，brain/companies/acme-corp.md 被创建或更新，两者都有今天日期的时间线条目。

2. **发送带有原创想法的消息。** 说"如果我们能将软件作为 Markdown 文件分发会怎样，代理会执行这些文件？" 验证：使用你的确切措辞创建了 brain/originals/{slug}.md。

3. **检查反向链接。** 打开 Sarah Chen 的页面。它应该有一个时间线条目链接回今天的对话。打开 Acme Corp 的页面。相同。

4. **发送无聊的消息。** 说"好的，听起来不错。" 验证：没有创建任何内容。检测器应该报告"未检测到信号。"

5. **检查重复。** 提及 "Pedro" 然后稍后 "Pedro Franceschi。" 验证：一个页面，不是两个。

---

*是 [GBrain Skillpack](../GBRAIN_SKILLPACK.md) 的一部分。另请参阅：[实体检测](entity-detection.md)、[Brain 优先查找](brain-first-lookup.md)*
