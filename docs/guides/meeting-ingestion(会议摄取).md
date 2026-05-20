# 会议摄取

## 目标

会议记录成为大脑页面，更新每个提及的实体 —— 参会者、公司和交易 —— 在一次传递中全部传播。

## 用户得到什么

没有这个：会议消失在记忆中，行动项被遗忘，并且代理不知道你上次见到某人时讨论了什么。

有了这个：每个会议都是一个永久记录，丰富了它触及的每个人和公司页面，并且用户走进每个后续会议时都已经了解了背景。

## 实现

```
on new_meeting_transcript(meeting):
    # 步骤 1：拉取完整记录 — 不是 AI 摘要
    #   AI 摘要会产生幻觉框架（"同意了..."）
    #   记录是真相来源
    transcript = fetch_full_transcript(meeting.id)  # 例如，Circleback API
    # 必须具有说话者分离：谁说了什么

    # 步骤 2：创建会议页面
    slug = f"meetings/{meeting.date}-{short_description}"
    compiled_truth = agent_analysis(transcript):
        # 在横杠上方：代理自己的分析，不是通用Recap
        #   - 透过用户的优先级重新构建
        #   - 标记意外、矛盾、影响
        #   - 命名真正的决策（不是表演性的决策）
        #   - 指出未说或未解决的内容
    timeline = format_diarized_transcript(transcript)
        # 在横杠下方：完整记录，仅追加
        #   格式：**说话者** (HH:MM:SS)：话语。
    
    gbrain put <slug> --content "<编译_真相>\n---\n<时间线>"

    # 步骤 3：传播到所有实体页面（强制性 — 大多数代理跳过此步骤）
    for person in meeting.attendees + meeting.mentioned_people:
        gbrain add_timeline_entry <person_slug> \
            --entry "在 '{会议.标题}' 中遇见 {日期}。要点：..。" \
            --source "会议记录 '{会议.标题}'，{日期}"

        # 如果出现新信息，更新他们的状态部分
        # 更新每个提及的人的公司页面（如果相关）

    for company in meeting.mentioned_companies:
        gbrain add_timeline_entry <company_slug> \
            --entry "在 '{会议.标题}' 中讨论：{说了什么}" \
            --source "会议记录 '{会议.标题}'，{日期}"

    # 步骤 4：提取行动项
    action_items = extract_action_items(transcript)
    # 添加到带有所有者归属的任务列表

    # 步骤 5：反向链接所有内容（双向图谱）
    for entity in all_entities_mentioned:
        gbrain add_link <slug> <entity_slug>   # 会议 -> 实体
        gbrain add_link <entity_slug> <slug>    # 实体 -> 会议

    # 步骤 6：同步，以便新页面立即可搜索
    gbrain sync
```

计划：cron 每天 3 次（上午 10 点、下午 4 点、晚上 9 点）以捕获新会议
来源：Circleback (https://circleback.ai) 或任何带有说话者分离 + API/webhook 访问的服务

## 棘手的地方

1. **始终拉取完整记录，永远不要 AI 摘要。** AI 摘要会产生幻觉框架 —— 它们会将"同意"或"决定"编辑化，而当没有发生此类协议时。分离的记录是真相来源。

2. **实体传播是大多数代理跳过的步骤。** 在每次参会者的页面、每个提及的人的页面和每个公司的页面都有新的时间线条目之前，会议还没有被完全摄取。只有会议页面而没有传播是无用的。

3. **提及的人物不仅仅是参会者。** 如果会议讨论了"Sarah 在 Brex 的团队"，那么 Sarah 的页面和 Brex 的页面都需要更新 —— 即使 Sarah 不在房间里。

4. **代理的分析是价值，不是摘要。** "他们讨论了 Q2 目标" 是没有价值的。"Pedro 对燃烧率进行了回推，Diana 没有承诺到时间线，并且没有人解决定价差距"是有用的。分析将新会议连接到现有大脑。

5. **反向链接必须是双向的。** 会议页面链接到参会者页面，并且参会者页面链接回会议。图谱是双向的。始终。

## 如何验证

1. **摄取会议后，运行 `gbrain get meetings/{date}-{slug}`。** 确认页面在横杠上方有代理的分析，并且在它下方有完整的分离记录。

2. **对于每个参会者，运行 `gbrain get <attendee_slug>`。** 检查他们的时间线是否有一个引用带有具体洞察力的会议的新条目（不只是"参加会议"）。

3. **选择会议中提及的一个公司。** 运行 `gbrain get <company_slug>`。确认存在引用讨论了公司内容的时间线条目。

4. **运行 `gbrain get_links meetings/{date}-{slug}`。** 验证存在到所有参会者和实体页面的反向链接。

5. **运行 `gbrain search "{会议_主题}"`。** 确认会议页面出现在搜索结果中（验证同步运行）。

---

*是 [GBrain Skillpack](../GBRAIN_SKILLPACK.md) 的一部分。另请参阅：[实体检测](entity-detection.md)、[大脑-代理循环](brain-agent-loop.md)*
