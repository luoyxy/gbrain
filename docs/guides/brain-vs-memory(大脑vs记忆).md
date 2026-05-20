# 大脑 vs 记忆 vs 会话

## 目标

知道什么进入 GBrain，什么进入代理记忆，什么保留在会话上下文中 —— 这样每条信息都落在正确的层。

## 用户得到什么

没有这个：人事档案存储在代理记忆中（代理重置时丢失），用户偏好存储在 GBrain 中（混乱知识页面），代理重新询问它已经知道答案的问题。

有了这个：世界知识持久保存在大脑中，操作状态持久保存在代理记忆中，代理永远不会将信息放在错误的层。

## 实现

```
on new_information(info):
    # 三层，三个目的 -- 路由到正确的那个

    if info.is_about_the_world:
        # GBRAIN：人物、公司、交易、会议、概念、想法
        # 这是关于世界的外部实体的知识
        gbrain put <slug> --content "..."
        # 示例：
        #   "Pedro 是 Brex 的 CEO"           -> gbrain（人物页面）
        #   "Brex 以 $12B 完成了 D 轮融资"   -> gbrain（公司页面）
        #   "周二的会议涵盖了 Q2"   -> gbrain（会议页面）
        #   "肉类套装维护税"   -> gbrain（originals 页面）

    elif info.is_about_operations:
        # 代理记忆：偏好、决策、工具配置、会话连续性
        # 这是代理如何操作的 -- 不是关于世界的事实
        memory_write(info)
        # 示例：
        #   "用户更喜欢简洁的格式"      -> 代理记忆
        #   "在 prod 之前部署到 staging"        -> 代理记忆
        #   "在代码块中使用深色模式"         -> 代理记忆
        #   "Crustdata 的 API 密钥放在 .env 中"   -> 代理记忆

    elif info.is_current_conversation:
        # 会话上下文：刚才说了什么，当前任务，即时状态
        # 这是自动的 -- 已经在对话窗口中
        # 不需要存储操作
        # 示例：
        #   "我们刚才在讨论董事会幻灯片"  -> 会话
        #   "你让我审查这个 PR"          -> 会话
        #   "我刚刚分享的文件"                  -> 会话

# 查找路由：
on user_asks(question):
    if question.about_person or question.about_company or question.about_meeting:
        gbrain search "{实体}"    # -> 世界知识
        gbrain get <slug>

    elif question.about_preference or question.about_how_to_operate:
        memory_search("{主题}")    # -> 操作状态

    elif question.about_current_context:
        # 已经在会话中 -- 只引用对话历史
        pass
```

## 棘手的地方

1. **不要将人物存储在代理记忆中。** "Pedro 更喜欢电子邮件而不是 Slack"感觉像是一种偏好，但它是关于 Pedro 的事实 -- 它放在 GBrain 的 Pedro 页面中。代理记忆用于代理自身的操作状态，而不是关于世界上人物的信息。

2. **不要将用户偏好存储在 GBrain 中。** "用户喜欢要点而不是段落"是关于代理应该如何行为，而不是关于世界。它放在代理记忆中。GBrain 页面用于实体，不用于代理配置。

3. **外部想法的综合放在 GBrain 中。** "用户对 Peter Thiel 的从零到一框架的看法"是用户的原创想法 -- 它放在 GBrain 的 originals/ 下，而不是代理记忆中。

4. **代理记忆在某些平台上不会在代理重置后生存。** 关键的世界知识必须放在 GBrain 中，它是持久的。如果代理失去记忆，大脑仍然拥有所有东西。

5. **当有疑问时，问：这是关于世界的还是关于如何操作的？** 世界 -> GBrain。操作 -> 代理记忆。当前对话 -> 会话。

## 如何验证

1. 问代理"Pedro 是谁？" -- 确认它运行 `gbrain search` 或 `gbrain get`，而不是 `memory_search`。人物查找应该命中 GBrain。
2. 问代理"我应该如何格式化响应？" -- 确认它检查代理记忆，而不是 GBrain。偏好是操作状态。
3. 检查代理记忆存储中不存在人物或公司页面。运行 `memory_search "person"` -- 它应该返回偏好，而不是档案。
4. 检查 GBrain 不包含关于代理行为的页面。运行 `gbrain search "user prefers"` -- 它应该不返回任何东西（偏好属于代理记忆）。
5. 代理重置后，确认 GBrain 知识仍然可访问。运行 `gbrain get <any_slug>` -- 世界知识应该在重置后生存。

---

*是 [GBrain Skillpack](../GBRAIN_SKILLPACK.md) 的一部分。*
