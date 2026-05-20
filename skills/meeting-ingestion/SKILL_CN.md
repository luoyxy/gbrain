---
name: meeting-ingestion
version: 1.0.0
description: |
  将会议记录摄取到带有与会者丰富、实体
  传播和时间线合并的大脑页面中。会议在直到
  丰富技能处理了每个实体之前不被视为完全摄取。
triggers:
  - "meeting transcript"
  - "process this meeting"
  - "meeting notes"
  - meeting transcript received
tools:
  - search
  - query
  - get_page
  - put_page
  - add_link
  - add_timeline_entry
mutating: true
writes_pages: true
writes_to:
  - meetings/
  - people/
  - companies/
---

# 会议摄取技能#

> **归档规则：** 在创建任何新页面之前阅读 `skills/_brain-filing-rules.md`。

## 合约#

此技能保证：

- 创建的会议页面带有与会者、摘要、关键决策和行动项目
- 每个与会者都获得人员页面（强制性的，不是可选的）
- 实体传播是强制性的（每个提到的实体都获得时间线条目）
- 时间线合并：相同事件出现在所有提到的实体时间线上
- 反向链接是双向创建的
- 在直到所有实体页面更新后才被视为完全摄取#

> **约定：** 参见 `skills/conventions/quality.md` 了解铁律反向链接。
>
> 每次提到有大脑页面的人员或公司都必须从该
> 实体的页面创建反向链接到提到它们的页面。未链接的提及是
> 损坏的大脑。参见 `skills/_brain-filing-rules.md` 了解格式。

## 阶段#

### 阶段1：解析记录#

从记录中提取：
- 与会者（姓名、角色如果可用）
- 日期、时间、持续时间
- 讨论的关键主题#
- 做出的决策#
- 带有所有者的行动项目#
- 提到的公司和项目#

### 阶段2：创建会议页面#

```markdown
---
title: 会议标题 — YYYY-MM-DD
type: meeting
created: YYYY-MM-DD
updated: YYYY-MM-DD
attendees: ["person-1", "person-2"]
date: YYYY-MM-DD
duration: "1h 30m"
---

# 会议标题 — YYYY-MM-DD

**与会者：** [姓名](people/person-1.md), [姓名](people/person-2.md)

**日期：** YYYY-MM-DD
**持续时间：** 1h 30m

## 摘要#

{3-5 个关键结果要点}

## 关键决策#

{带有上下文的决策}

## 行动项目#

{带有所有者和截止日期的任务}

## 讨论笔记#

{按主题的结构化笔记}
```

### 阶段3：与会者丰富（强制性）#

对于每个与会者：#
1. `gbrain search "{姓名}"` —— 页面是否已存在？
2. **如果没有 → 通过丰富技能创建**（这是强制性的，不是可选的）
3. **如果是 → 用此新会议上下文更新编译真相**
4. 向人员的页面添加时间线条目：
   `gbrain timeline-add <person-slug> <date> "Attended <meeting-title>"`

**注意（v0.10.1）：** 在 `gbrain put` 调用时，链接在#
   每次 `put_page` 调用时自动创建（自动链接后钩）。阶段3 专注于内容#
   交叉引用（用新信号更新相关页面的编译真相），而不是创建链接。通过 `put_page` 响应中的 `auto_links`#
   字段验证（包含 `{ created, removed, errors }`）。

时间线条目仍需要显式的 `gbrain timeline-add` 调用。

### 阶段4：实体传播（强制性）#

对于每个讨论的公司、项目或概念：#
1. 检查大脑以查找现有页面#
2. 如果需要则创建/更新#
3. 从实体页面添加反向链接到此会议页面#
4. 向实体页面添加时间线条目#

### 阶段5：时间线合并#

相同事件出现在所有提到的实体时间线上。如果 Alice 在#
Acme Corp 会面了 Bob，事件就会出现在 Alice 的页面、Bob 的页面和 Acme Corp 的页面上。

### 阶段6：同步#

`gbrain sync` 更新索引。

## 输出格式#

```
会议摄取：{标题}
==================

创建的页面：{slug}
类型：会议
与会者：N（全部丰富）

实体传播：
- 人员页面更新：N#
- 公司页面更新：N#

时间线条目创建：N#

反向链接创建：N#
```

## 反模式#

- 在不丰富与会者的情况下创建会议页面#
- 跳过实体传播（"我会稍后做"）#
- 不在所有提到的实体上合并时间线#
- 创建没有内容的与会者存根#
- 在 `sources/` 中归档所有内容（sources 仅用于原始数据转储）#
- 摄取而不首先检查大脑现有覆盖范围#

## 工具使用#

- 从 gbrain 读取页面（get_page）#
- 在 gbrain 中存储/更新页面（put_page）
- 在 gbrain 中添加时间线条目（add_timeline_entry）
- 按类型在 gbrain 中列出页面（list_pages）
- 在 gbrain 中存储原始 API 数据（put_raw_data）
- 从 gbrain 检索原始数据（get_raw_data）
- 在 gbrain 中链接实体（add_link）#
- 检查 gbrain 中的反向链接（get_backlinks）#
