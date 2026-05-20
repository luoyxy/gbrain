# 确定性收集器：数据的代码，判断的 LLM

## 目标

将机械工作（100% 可靠代码）与分析工作（LLM 判断）分开，以便确定性任务永远不会概率性地失败。

## 用户得到什么

没有这个：LLM 生成 Gmail 链接、格式化表格和跟踪状态。它遵循前 10 个项目的规则，然后在第 11 个项目上丢失链接。你在提示中写"没有例外"。它仍然失败。20 个项目的 90% 可靠性意味着每天两次可见失败。信任被破坏。

有了这个：代码处理 URL、格式化和状态（100% 可靠）。LLM 读取预格式化的数据并添加判断、分类和丰富。链接永远不会错，因为 LLM 永远不会生成它们。

## 实现

```
// 模式：收集器收集，LLM 分析
// 步骤 1：确定性收集器（脚本，无 LLM 调用）
collector_run():
  messages = gmail_api.fetch_unread()
  for msg in messages:
    structured = {
      id: msg.id,
      from: msg.sender,
      subject: msg.subject,
      snippet: msg.snippet,
      gmail_link: f"https://mail.google.com/mail/u/?authuser={account}#inbox/{msg.id}",
      gmail_markdown: f"[在 Gmail 中打开]({gmail_link})",
      is_signature: regex_match(msg, DOCUSIGN_PATTERNS),
      is_noise: regex_match(msg, NOISE_PATTERNS),
      is_new: msg.id not in state.seen_ids
    }
    store(structured)
    state.seen_ids.add(msg.id)
  generate_markdown_digest(structured_messages)

// 步骤 2：LLM 读取预格式化的摘要
llm_analyze():
  digest = read("data/digests/today.md")  // 链接已经嵌入
  classify_urgency(digest)                 // 判断调用
  add_commentary(digest)                   // 上下文分析
  run_brain_enrichment(notable_entities)   // gbrain 搜索 + 更新
  draft_replies(urgent_items)              // 创意工作
  surface_to_user(final_output)            // 传递

// 步骤 3：连接到 cron
cron_job():
  collector_run()     // 快速、廉价、确定性
  llm_analyze()       // 较慢、昂贵、创意
```

### 架构

```
+-----------------------------+     +------------------------------+
|  确定性收集器    |---->|       LLM 代理              |
|  (Node.js / Python 脚本)  |     |                              |
|                             |     |  - 读取预格式化的    |
|  - 从 API 拉取数据       |     |    摘要                    |
|  - 存储结构化 JSON    |     |  - 分类项目            |
|  - 生成链接/URL    |     |  - 添加评论            |
|  - 检测模式 (regex)  |     |  - 运行大脑丰富      |
|  - 跟踪状态 (已见/新)   |     |  - 起草回复             |
|  - 输出 markdown 摘要   |     |  - 呈现给用户           |
|                             |     |                              |
|  代码 — 确定性、      |     |  AI — 判断、上下文、     |
|  永远不会忘记              |     |  创意                  |
+-----------------------------+     +------------------------------+
```

### 文件结构

```
scripts/email-collector/
├── email-collector.mjs     # 无 LLM 调用，无外部依赖
├── data/
│   ├── state.json          # 上次拉取时间戳、已知 ID、待处理签名
│   ├── messages/           # 每天结构化 JSON
│   │   └── 2026-04-09.json
│   └── digests/            # 预格式化的 markdown
│       └── 2026-04-09.md
```

### 模式适用的地方

| 信号来源 | 收集器生成 | LLM 添加 |
|--------------|-------------------|----------|
| **电子邮件** | Gmail 链接、发件人元数据、签名检测 | 紧急程度分类、丰富、回复草稿 |
| **X/Twitter** | 推文链接、参与指标、删除检测 | 情感分析、叙事检测、内容想法 |
| **日历** | 事件链接、参会者列表、冲突检测 | 准备简报、来自大脑会议上下文 |
| **Slack** | 频道链接、主题链接、提及检测 | 优先级分类、行动项提取 |
| **GitHub** | PR/问题链接、差异统计、CI 状态 | 代码审查上下文、优先级评估 |

### 原则

如果一条输出必须存在并且每次都必须正确格式化，请在代码中生成它。如果一条输出需要判断、上下文或创意，请使用 LLM 生成它。不要要求 LLM 在同一次传递中同时做这两件事。

## 棘手的地方

1. **LLM 会忘记链接 -- 在代码中嵌入它们。** LLM 会遵循"包含 Gmail 链接"规则处理前 10 个项目，然后在第 11 个项目上静默丢弃它。无论多少提示工程都无法修复长输出上的概率格式化。修复：在收集器脚本中生成每个链接。LLM 读取预格式化的 markdown，其中链接已经嵌入。它不能忘记它没有生成的东西。

2. **噪声过滤必须是确定性的。** 基于正则的噪声检测（新闻通讯、自动收据、营销）属于收集器，而不是 LLM。LLM 可能在一次运行中将新闻通讯分类为"可能重要"，而在下一次运行中分类为"噪声"。代码每次都以相同的方式分类相同的输入。

3. **原子写入防止损坏。** 收集器写入跟踪哪些消息已被查看的状态文件（`state.json`）。如果脚本在写入中途崩溃，状态文件可能损坏。先写入临时文件，然后原子重命名。这也防止了 cron 在收集运行期间触发时 LLM 读取部分摘要。

## 如何验证

1. **运行收集器并检查每个链接。** 手动执行收集器脚本。打开生成的摘要。单击每个 `[在 Gmail 中打开]` 链接（或等效项）。每个链接都必须解析到正确的项目。如果有任何链接断裂或丢失，收集器就有 bug。

2. **验证噪声过滤是一致的。** 在相同输入数据上运行收集器两次。噪声分类（is_noise 字段）两次必须相同。如果它变化，概率元素泄漏到确定性层中。

3. **验证 LLM 读取结构化输出。** 运行完整管道（收集器然后 LLM）。检查 LLM 的分析是否引用来自结构化摘要的数据，而不是来自它自己的生成。最终输出中的链接应该与摘要文件中的链接相同。

---

*是 [GBrain Skillpack](../GBRAIN_SKILLPACK.md) 的一部分。*
