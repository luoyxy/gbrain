---
name: idea-ingest
version: 1.0.0
description: |
  将链接、文章、推文和想法摄取到大脑中。获取内容，保存
  到大脑并进行分析，创建作者人员页面，并交叉链接。当用户
  分享链接或说"read this"、"save this"、"think about this"时使用。
triggers:
  - shares a link or URL
  - "read this"
  - "save this"
  - "think about this"
  - "put this in brain"
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
  - people/
  - concepts/
  - sources/
---

# 想法摄取技能#

> **归档规则：** 在创建任何新页面之前阅读 `skills/_brain-filing-rules.md`。

## 合约#

此技能保证：

- 每个摄取的项目都有带有真实分析的大脑页面（不仅仅是摘要）
- 作者获得人员页面（对于想法值得摄取的任何人都是强制性的）
- 交叉链接是双向创建的（来源 ↔ 作者，来源 ↔ 提到的实体）
- 为来源保留原始来源通过 `gbrain files upload-raw`
- 每个事实都有内联 `[来源: ...]` 引用
- 归档遵循主要主题规则（不是基于格式的）

> **约定：** 参见 `skills/conventions/quality.md` 了解铁律反向链接。
>
> 每次提到有大脑页面的人员或公司都必须从该
> 实体的页面创建反向链接到提到它们的页面。未链接的提及是
> 损坏的大脑。参见 `skills/_brain-filing-rules.md` 了解格式。

## 阶段#

1. **获取内容。** 根据内容类型使用适当的工具（用于文章的 web fetch，用于推文的 API，用于文档的 PDF 阅读器）。
2. **上传原始来源。** 保存获取的内容用于来源保留：`gbrain files upload-raw <file> --page <slug>`
3. **识别作者 —— 强制性人员页面。** 任何想法值得摄取的人都值得跟踪。
   - 在大脑中搜索现有作者页面
   - 如果没有页面 → 用编译真相 + 时间线格式创建一个
   - 如果页面存在 → 用此新发布更新时间线
   - 双向交叉链接
4. **保存到大脑。** 按主要主题归档（阅读 `skills/_brain-filing-rules.md`）：
   - 关于人员 → `people/`
   - 关于公司 → `companies/`
   - 可重用框架 → `concepts/`
   - 原始数据转储 → `sources/`
5. **为用户分析。** 回复将内容连接到大脑知识的分析。思考：
   - 活跃项目 —— 这相关吗？
   - 矛盾 —— 这挑战现有大脑知识吗？
   - 连接 —— 这涉及已知的人员/公司吗？
   - 不要只是总结。告诉用户他们不会注意到的事情。
6. **同步。** `gbrain sync` 更新索引。

## 输出格式#

```markdown
# {标题} — {作者}

**来源：** {URL}

**作者：** {作者}, {角色}

**发布：** {日期}

**摄取：** {日期}

## 上下文#

{为什么这现在重要，连接到大脑知识}

## 摘要#

{3-5 个子弹核心论点}

## 关键数据 / 声明#

{具体事实、数字、引用}

## 分析#

{这如何连接到现有大脑知识。什么是新的。什么矛盾。}
```

## 反模式#

- 只是总结而不连接到大脑知识
- 在 `sources/` 中归档所有内容（来源仅用于原始数据转储）
- 跳过作者人员页面
- 不交叉链接到提到的实体
- 在不首先检查大脑现有覆盖范围的情况下摄取

## 工具使用#

- 从 gbrain 读取页面（get_page）
- 在 gbrain 中存储/更新页面（put_page）
- 在 gbrain 中添加时间线条目（add_timeline_entry）
- 按类型在 gbrain 中列出页面（list_pages）
- 在 gbrain 中存储原始 API 数据（put_raw_data）
- 从 gbrain 检索原始数据（get_raw_data）
- 在 gbrain 中链接实体（add_link）
- 检查 gbrain 中的反向链接（get_backlinks）
