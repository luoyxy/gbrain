# 执行助理模式

## 目标

由大脑上下文提供支持的电子邮件分类、会议准备和调度 —— 因此每次互动都受到关系完整历史的信息。

## 用户得到什么

没有这个：代理机械地分类电子邮件（"你有 12 个未读"），用通用 LinkedIn 简历准备会议，并且在没有关系上下文的情况下调度。

有了这个：代理在读取电子邮件正文之前就知道每个发件人是谁，在每次会议之前呈现共享历史，并根据关系温度和开放主题提示调度。

## 实现

```
# 工作流 1：电子邮件分类
on email_batch(emails):
    for email in emails:
        # 步骤 1：在读取电子邮件正文之前搜索发件人
        #   大脑上下文使分类变得 10 倍更好
        sender_page = gbrain search "{email.sender_name}"
        if sender_page:
            context = gbrain get <sender_slug>
            #   现在你知道：他们是谁，关系历史，
            #   他们关心什么，开放主题

        # 步骤 2：加载大脑上下文后读取电子邮件
        #   分类现在是有依据的，不是机械的

        # 步骤 3：带上下文分类
        if context.relationship == "inner_circle" or context.has_open_threads:
            priority = "urgent"
        elif context.is_known_entity:
            priority = "normal"
        else:
            priority = "noise"  # 未知发件人，没有大脑页面

        # 步骤 4：带关系上下文起草回复
        if needs_reply(email):
            draft = compose_reply(
                email,
                context=context,           # 他们的大脑页面
                open_threads=context.open_threads,  # 你们一起做什么
                relationship=context.relationship   # 语气校准
            )

# 工作流 2：会议准备
on upcoming_meeting(meeting):
    briefing = {}
    for attendee in meeting.attendees:
        # 搜索每个参会者的大脑
        results = gbrain search "{attendee.name}"
        if results:
            page = gbrain get <attendee_slug>
            briefing[attendee] = {
                "compiled_truth": page.compiled_truth,
                "last_interaction": page.timeline[0],     # 最近
                "open_threads": page.open_threads,
                "relationship_temperature": page.relationship,
                "relevant_deals": gbrain get_links <attendee_slug>,
            }
        else:
            briefing[attendee] = "没有大脑页面 -- 考虑丰富"

    # 呈现：共享历史、要跟进的内容、要观察的内容
    # "上次你讨论了 B 轮时间线。Pedro 担心燃烧率。
    #  这是他公司页面中的最新信息。"

# 工作流 3：收件箱后大脑更新
on inbox_cleared():
    for email in processed_emails:
        if email.contained_new_information:
            # 用新信号更新发件人的大脑页面
            gbrain add_timeline_entry <sender_slug> \
                --entry "电子邮件重新：{主题}。关键信息：{提取的_信号}" \
                --source "来自 {发件人} 的电子邮件重新 {主题}，{日期}"

            # 也更新任何提及的实体页面
            for entity in email.mentioned_entities:
                gbrain add_timeline_entry <entity_slug> \
                    --entry "{关于_他们_说了什么}" \
                    --source "来自 {发件人} 的电子邮件，{日期}"

# 工作流 4：调度提示
on schedule_request(meeting):
    for attendee in meeting.attendees:
        page = gbrain get <attendee_slug>
        if page.last_interaction > 6_weeks_ago:
            nudge("你已经 {几周} 周没有与 {参会者} 会面了")
        if page.has_open_threads:
            nudge("{参会者} 有关于 {主题} 的开放主题")
        if page.relationship_temperature == "cooling":
            nudge("与 {参会者} 的关系可能需要关注")
```

## 棘手的地方

1. **在读取电子邮件之前搜索发件人。** 这是反直觉的但关键的。首先加载大脑上下文意味着你知道他们是谁，你们一起做什么，以及他们关心什么 —— 甚至在你看到主题行之前。分类是有依据的，不是机械的。

2. **没有大脑页面的未知发件人几乎总是噪声。** 如果对发件人 `gbrain search` 没有返回任何内容，他们可能不重要。分类为低优先级，除非电子邮件内容另有指示。

3. **会议准备是最高杠杆的 EA 工作流。** 用户走进每个会议时都已经了解了每个参会者：上次互动、开放主题、关系历史。这是在"你下午 3 点有会议"和"你下午 3 点有会议与 Pedro — 上次你讨论了 B 轮，他担心燃烧率"之间的区别。

4. **收件箱后大脑更新是大脑复合的地方。** 每封电子邮件都是信号。如果你在更新大脑页面之前清除收件箱，信息就会丢失。这是大多数代理跳过的一步。

5. **调度提示需要时间线数据。** "你已经 6 周没有与 Diana 会面了"仅在会议页面被摄取并带有适当的实体传播时才有效（请参阅会议摄取指南）。

## 如何验证

1. **为明天的日历运行会议准备。** 对于每个参会者，确认代理运行了 `gbrain search` 并在生成简报之前加载了他们的大脑页面。
2. **分类 5 封电子邮件。** 确认代理在对电子邮件进行分类之前搜索了大脑中每个发件人。
3. **清除收件箱后，用 `gbrain get <slug>` 检查 2 个发件人的大脑页面。** 确认添加了来自电子邮件的新时间线条目和信息。
4. **检查调度建议。** 确认代理在提示中引用了参会者的大脑页面（上次互动日期、开放主题）。
5. **从拥有大脑页面的人发送测试电子邮件。** 确认分类响应引用了他们的关系上下文，而不仅仅是电子邮件内容。

---

*是 [GBrain Skillpack](../GBRAIN_SKILLPACK.md) 的一部分。*
