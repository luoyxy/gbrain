---
name: media-ingest
version: 1.0.0
description: |
  将视频、音频、PDF、书籍、截图和 GitHub 仓库内容摄取到大脑中。
  带有实体提取和反向链接传播的多格式处理。涵盖
  video-ingest、youtube-ingest 和 book-ingest 子类型。
triggers:
  - "watch this video"
  - "process this YouTube link"
  - "ingest this PDF"
  - "save this podcast"
  - "process this book"
  - "PDF book"
  - "summarize this book"
  - "ingest it into my brain"
  - "what's in this screenshot"
  - "check out this repo"
tools:
  - search
  - query
  - get_page
  - put_page
  - add_link
  - add_timeline_entry
  - file_upload
mutating: true
writes_pages: true
writes_to:
  - concepts/
  - people/
  - companies/
  - sources/
---

# 媒体摄取技能#

将视频、音频、PDF、书籍、截图和 GitHub 仓库内容摄取到大脑中。

> **归档规则：** 在创建任何新页面之前阅读 `skills/_brain-filing-rules.md`。

## 合约#

此技能保证：

- 每个摄取的媒体项目都有大脑页面并带有分析（不仅仅是记录转储）
- 记录（视频/音频）以原始和人工可读格式保存
- 实体提取：每个提到的人员和公司都获得反向链接
- 原始来源文件通过 `gbrain files upload-raw` 保留
- 按主要主题归档，而不是按媒体格式

> **约定：** 参见 `skills/conventions/quality.md` 了解铁律反向链接。
>
> 每次提到有大脑页面的人员或公司都必须从该
> 实体的页面创建反向链接到提到它们的页面。未链接的提及是
> 损坏的大脑。参见 `skills/_brain-filing-rules.md` 了解格式。

## 阶段#

### 阶段1：识别格式并获取#

| 格式 | 操作 |
|--------|--------|
| YouTube/视频 URL | 获取记录（Whisper、转录服务或字幕） |
| 音频文件 | 使用可用 STT 服务转录 |
| PDF | 提取文本（如果需要，使用 OCR） |
| 书籍 PDF | 提取文本，识别章节/部分 |
| 截图/图像 | 通过视觉模型使用 OCR，提取文本和实体 |
| GitHub 仓库 | 克隆，读取 README + 关键文件，总结架构 |

### 阶段2：上传原始来源#

保存原始文件用于来源保留：`gbrain files upload-raw <file> --page <slug>`

### 阶段3：创建大脑页面#

按主要主题归档（不是格式）。使用此模板：

```markdown
# {标题}

**来源：** {URL 或文件路径}

**格式：** {视频/音频/PDF/书籍/截图/仓库}

**创建：** {日期}

## 摘要#

{关键点，不是记录转储}

## 关键部分 / 亮点#

{对于视频/音频：带有时间戳的亮点。对于书籍：章节摘要。}

## 提到的人#

{带有到大脑页面的链接的列表}

## 提到的公司#

{带有到大脑页面的链接的列表}
```

### 阶段4：实体提取和传播#

对于每个提到的人员和公司：

1. 检查大脑以查找现有页面
2. 如果需要，创建/丰富（委托给 enrich 技能）
3. 从实体页面添加反向链接到此媒体页面
4. 在实体页面上附加时间线条目

媒体项目在直到实体传播完成后才被视为完全摄取。

### 阶段5：同步#

`gbrain sync` 更新索引。

## 输出格式#

创建了带有摘要、亮点和实体交叉链接的大脑页面。向用户报告：
"摄取了 {标题}：{N} 个实体检测到，{N} 个页面已更新。"

## 反模式#

- 在没有分析的情况下转储原始记录
- 跳过实体提取（"我会单独做那个"）
- 按格式归档 **原始摄取**（所有视频都在 `media/videos/` 中）而不是按主题。注意：在 `media/<format>/<slug>` 下的特定于格式的
路径对于**综合的一对一输出**是允许的，如 book-mirror 的 `media/books/<slug>-personalized.md`。反模式适用于原始摄取，不适用于 sui generis 综合。参见 `skills/_brain-filing-rules.md`"例外：综合输出是 sui generis。"
- 不保留原始来源文件
- 创建没有有意义内容的存根页面
