# 内容和媒体摄取

## 目标

YouTube 视频、社交媒体、PDF 和文档变成可搜索的大脑页面，带有代理自己的分析和对每个提及的实体的完整交叉引用。

## 用户得到什么

没有这个：媒体链接是衰减的书签 -- 你记得观看了一个视频，但无法找到说了什么，谁说的，或为什么它很重要。

有了这个：每个媒体都是一个永久的大脑页面，代理的分析层叠在上面，每个提及的实体都获得一个反向链接，完整内容永远可搜索。

## 实现

```
on user_shares_media(url_or_file):

    # 模式 1：YouTube 视频摄取
    if media.type == "youtube":
        # 步骤 1：获取带有说话者分离的完整记录
        #   谁说了什么 -- 不只是一面墙的文本
        #   使用 Diarize.io 或等效服务
        transcript = diarize(video_url)  # 说话者归属记录
        # 永远不要使用 YouTube 的自动生成摘要或 AI 摘要

        # 步骤 2：代理编写自己的分析（这是价值）
        #   不是摘要。不是 regurgitate。代理的 TAKE：
        #   - 什么重要以及为什么（考虑到用户的世界观）
        #   - 归属于特定说话者的关键引用
        #   - 连接到现有大脑页面
        #   - 影响和后续角度
        analysis = agent_analyze(transcript, user_context)

        # 步骤 3：创建大脑页面
        slug = f"media/youtube/{video_slug}"
        gbrain put <slug> --content """
            # {标题}
            **频道：** {频道} | **日期：** {日期} | **链接：** {url}

            ## 分析
            {代理分析}

## 关键引用
            - **{说话者}** ({时间戳}): "{引用}" -- {为什么重要}

            ---
            ## 完整记录
            {diarized_transcript}
        """

        # 步骤 4：提取和交叉引用实体
        for person in transcript.mentioned_people:
            gbrain add_link <slug> <person_slug>
            gbrain add_link <person_slug> <slug>
            gbrain add_timeline_entry <person_slug> \
                --entry "在 {视频标题} 中讨论：{说了什么}" \
                --source "YouTube: {url}"

    # 模式 2：社交媒体捆绑
    elif media.type == "tweet" or media.type == "social":
        # 不要只保存一条推文 -- 重建完整上下文
        bundle = {
            "original": fetch_tweet(url),
            "thread": reconstruct_thread(url),        # 引用的推文、回复
            "linked_articles": fetch_linked_urls(),    # 获取并总结
            "engagement": get_engagement_data(),       # 什么引起了共鸣
        }

        slug = f"media/social/{platform}-{author}-{date}"
        gbrain put <slug> --content """
            # {作者}：{主题}
            {代理对完整捆绑包的分析}

            ## 主题
            {reconstructed_thread}

            ## 链接的文章
            {article_summaries}

            ---
            ## 原始
            {original_tweet_text}
        """

        # 提取实体和交叉引用
        for entity in bundle.mentioned_entities:
            gbrain add_link <slug> <entity_slug>
            gbrain add_link <entity_slug> <slug>

    # 模式 3：PDF 和文档
    elif media.type == "pdf" or media.type == "document":
        # 如果需要，OCR（扫描的 PDF）
        content = ocr_if_needed(file) or extract_text(file)

        # 对于书籍和长格式：
        slug = f"sources/{document_slug}"
        gbrain put <slug> --content """
            # {标题}
            **作者：** {作者} | **日期：** {日期}

            ## 章节摘要
            {每章摘要}

            ## 关键引用
            - p.{页码}："{引用}" -- {为什么重要}

            ## 交叉引用
            {指向人物和概念的大脑页面的链接}

            ---
            ## 来源
            {全文或关键部分}
        """

        for entity in document.mentioned_entities:
            gbrain add_link <slug> <entity_slug>
            gbrain add_link <entity_slug> <slug>

    # 摄取后始终同步
    gbrain sync
```

## 棘手的地方

1. **始终完整记录，永远不要 AI 摘要。** YouTube 的自动摘要和 AI 生成的摘要会丢失纹理：谁说了什么，确切的措辞，语气，什么没说。完整的 diarized 记录是证据基础。代理的分析在它上面。

2. **代理自己的分析就是价值，不是 regurgitate。** "视频讨论了 AI 安全"是没有价值的。"Dario 对计算扩展做出了与 Ilya 在 NeurIPS 演讲中所说矛盾的特定声明 -- 参见 media/youtube/ilya-neurips-2025"是有用的。分析将新媒体连接到现有大脑。

3. **社交媒体是一个捆绑包，不是一条推文。** 没有其主题、引用推文、链接文章和参与上下文的推文是一个片段。在创建大脑页面之前重建完整上下文。

4. **交叉引用让媒体页面活跃。** 没有反向链接到提及的人物和公司的 YouTube 页面是一个死存档。每个提及的实体都获得一个链接和一个时间线条目。

5. **随着时间的推移，`media/` 变成可搜索的存档。** 用户消费过的每个视频、播客、讲座、访谈、文章和推文，都带有代理的评论层叠在上面。这是全功率的 memex。

## 如何验证

1. 摄取一个 YouTube 视频。运行 `gbrain get media/youtube/{slug}`。确认页面有：代理的分析（不只是摘要），带有说话者归属的关键引用，以及完整的 diarized 记录。
2. 运行 `gbrain get_links media/youtube/{slug}`。确认对视频中提及的每个公司和人物的反向链接存在。
3. 选择视频中提及的一个人。运行 `gbrain get <person_slug>`。确认他们的时间线有一个引用带有特定上下文的视频的新条目。
4. 摄取一条推文。确认大脑页面包括主题上下文、链接文章摘要和实体交叉引用 -- 不只是推文文本。
5. 运行 `gbrain search "{来自视频的主题}"`。确认媒体页面出现在搜索结果中（验证内容被索引和可搜索）。

---

*是 [GBrain Skillpack](../GBRAIN_SKILLPACK.md) 的一部分。*
