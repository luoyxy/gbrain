---
name: archive-crawler
version: 0.1.0
description: 个人文件档案的通用档案管理员（Dropbox/B2/Gmail-takeout/本地挂载/硬盘转储）。过滤高价值内容（用户自己的写作、想法、关系）并以交互方式展示。在没有明确的 gbrain.yml `archive-crawler.scan_paths:` 允许列表的情况下拒绝运行。
triggers:
  - "crawl my archive"
  - "find gold in my archive"
  - "archive crawler"
  - "scan my dropbox for"
  - "mine my old files for"
mutating: true
writes_pages: true
writes_to:
  - originals/
  - personal/
  - ideas/
---

# archive-crawler — 通用档案管理员

> **约定：** 参见 [conventions/quality.md](../conventions/quality.md) 了解
> 引用规则、捕获用户反应时的
> 精确措辞要求，以及反向链接强制执行。
>
> **约定：** 参见 [_brain-filing-rules.md](../_brain-filing-rules.md) —
> 此技能是**模式通用的**：它从
> 规则 JSON 读取用户的归档规则，而不是硬编码任何特定的时代/档案布局。

## 安全门（必需，无例外）

除非 `archive-crawler.scan_paths:` 在 `gbrain.yml` 中明确设置，否则
archive-crawler 拒绝运行。这是针对
智能体过度扫描范围并摄取敏感内容（税务 PDF、
医疗记录、凭证）的故意安全围栏。

```yaml
# gbrain.yml — 允许列表是强制性的
archive-crawler:
  scan_paths:
    - ~/Documents/writing/
    - ~/Dropbox/Archive/
    - /mnt/backup/old-letters/
  # 允许列表内的可选拒绝列表：
  # deny_paths:
  #   - ~/Documents/finances/
  #   - ~/Documents/medical/
```

如果 `scan_paths` 为空或缺失，技能将退出并显示：

```
archive-crawler：拒绝运行。gbrain.yml 中没有 `archive-crawler.scan_paths:` 允许列表。
添加智能体被允许扫描的明确路径，然后重新运行。
这是安全围栏 — 智能体不会推断什么是安全可读的。
```

此合约由 `src/core/storage-config.ts` 强制执行（镜像
来自 v0.22.11 存储分层的 `db_tracked` / `db_only` 允许列表模式）。

## 这是什么

用于在明确允许列表中探索任何个人内容树的
通用引擎。适用于本地挂载、Dropbox API 目标、
Backblaze B2、Gmail 导出（`.mbox`）和类似档案。过滤
"黄金"（用户自己的写作、想法、关系）并以
交互方式展示以供审查。跳过噪音（系统文件、配置、二进制
blob）。

## 概念

### 来源

来源是要探索的任何文件树。来源具有：

- **类型**：`local` | `dropbox` | `backblaze` | `gmail-takeout` | `mbox` | `pst`
- **根**：文件系统路径、Dropbox 路径、B2 前缀、mbox 路径
- **清单**：在 `projects/<archive-slug>/STATUS.md` 跟踪进度的
  大脑页面

### 清单

每个档案探索都会获得一个跟踪以下内容的清单大脑页面：

1. **树清单** — 文件夹/文件/大小/类型
2. **分类状态** — 每个项目：`⬜ 未查看` / `👀 已审查` /
   `✅ 已摄取` / `⏭️ 跳过` / `🔥 高信号`
3. **用户反应** — 他们反应时的精确引用（根据
   conventions/quality.md 精确措辞规则）
4. **优先级队列** — 接下来要探索什么，排名
5. **会话日志** — 每个会话显示内容的带时间戳记录

### 黄金过滤器

在向用户展示任何内容之前，应用黄金过滤器：

| 保留（显示） | 跳过（注意存在，不显示） |
|-------------|-----------------------------------|
| 个人写作（日记、信件、反思、文章） | 系统文件、配置、package.json、node_modules |
| 对话（有实质内容的 IM 日志、电子邮件线程） | 二进制 blob（图像/视频） |
| 想法、论点、框架 | 收据、发票、税务文档 |
| 关系材料（来自/发给重要人物的信件） | 垃圾邮件、新闻通讯、邮件列表批量 |
| 创意作品（诗歌、故事、有灵魂的代） | 损坏/空文件 |
| 起源故事（变成重要事物的第一个版本） | |
| 情感内容（愤怒、爱、悲伤、发现） | |

## 协议

### 阶段1：清单

指向新来源时：

1. **确认 scan_paths 已设置**（安全门）。如果没有则退出。
2. **映射树** — 列出文件夹 + 文件 + 大小 + 日期范围。
3. **分类文件夹** — 按可能的内容类型分组（写作、电子邮件、
   代码、照片、文档、系统）。
4. **创建清单** — 写入带有
   完整清单的 `projects/<archive-slug>/STATUS.md`。
5. **提议优先级队列** — 按可能的黄金密度对文件夹排名。
6. **呈现给用户** — 显示地图和提议的顺序。让他们
   覆盖。

### 阶段2：爬取

按优先级顺序处理文件夹：

1. **在展示之前读取** — 打开每个候选文件，应用黄金
   过滤器，跳过噪音。
2. **一次展示一个** — 单独展示黄金项目以供审查。
3. **捕获精确反应** — 使用他们的精确词语在
   清单中跟踪用户的响应（根据 conventions/quality.md）。
4. **如果值得保留则摄取** — 立即创建大脑页面。
5. **更新清单** — 每次交互后标记项目状态。
6. **永不重新展示** — 在展示任何内容之前检查清单。

### 阶段3：摄取

当项目值得保留时，按**主要主题**归档
根据 `_brain-filing-rules.md`：

- 用户自己的写作/想法/起源故事内容 → `originals/<slug>.md`
- 反思/个人生活内容 → `personal/<slug>.md`
- 产品/商业想法 → `ideas/<slug>.md`
- 关于特定人物的信件或线程 → `people/<person>/timeline`
  反向链接加上 `personal/<slug>.md` 或 `originals/<slug>.md` 中的信件

**技能是模式通用的。** 它不嵌入任何特定的
时代文件夹结构（例如，2003 年之前的 `originals/archive/`、
2019 年之后的 `originals/yc-era/` 等）。用户在运行时从
`_brain-filing-rules.json` 读取的归档规则；智能体根据这些内容逐页
决定内容落在这些授权目录中的何处。

大脑页面格式：

```markdown
---
title: "[标题或第一行]"
type: original
source_type: "[local|dropbox|backblaze|gmail-takeout|mbox|pst]"
source_path: "[允许列表扫描路径中的路径]"
date: "YYYY-MM-DD"  # 来自文件元数据或内容的日期
people: ["person-1", "person-2"]
tags: ["tag-1", "tag-2"]
---

# [标题]

[摘要：它是什么，来自何时，为什么重要]

**用户的反应：**[精确引用，无释义]

## 上下文

[交叉链接到人、概念、项目。]

---

[线下的原始源材料 — 全文]
```

## 文件类型处理程序

### 纯文本/HTML/Markdown
直接读取。剥离 HTML 标签以进行显示。

### `.mbox`（电子邮件档案）

```python
import mailbox
mbox = mailbox.mbox('/path/to/file.mbox')
for msg in mbox:
    body = ''
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == 'text/plain':
                body = part.get_payload(decode=True).decode('utf-8', errors='replace')
                break
    else:
        body = msg.get_payload(decode=True).decode('utf-8', errors='replace')
    # 应用黄金过滤器
```

### `.doc` / `.docx`

```bash
# .docx（现代）
python3 -c "
import zipfile, xml.etree.ElementTree as ET
with zipfile.ZipFile('/path/to/file.docx') as z:
    tree = ET.parse(z.open('word/document.xml'))
    print(''.join(t.text or '' for t in tree.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t')))
:"

# .doc（传统，需要 antiword 或 catdoc）
antiword /path/to/file.doc 2>/dev/null || catdoc /path/to/file.doc 2>/dev/null
```

### `.pst`（Outlook 档案）

```bash
# 首先验证；许多 PST 是空字节
python3 -c "
with open('/path/to/file.pst', 'rb') as f:
    print('Valid PST' if f.read(4) == b'!BDN' else 'CORRUPT/NULL')
:"
# 如果有效：
readpst -o /tmp/pst-output /path/to/file.pst
```

### `.zip` / `.tar` / `.tar.gz`

解压到临时目录，然后递归遍历解压的树。

### 图像

注意存在 + 元数据（文件名、大小、日期）。除非
用户要求，否则不要展示。标记扫描/肖像为可能个人。

## 清单模板

```markdown
---
title: "[档案名称] — 摄取状态"
type: project
created: YYYY-MM-DD
updated: YYYY-MM-DD
source_type: "[local|dropbox|...]"
scan_paths: ["来自 gbrain.yml 的路径"]
---

# [档案名称] — 摄取状态

## 来源
- **类型：**[local|dropbox|...]
- **允许列表路径：**[来自 gbrain.yml]
- **文件总数：**[N]
- **总大小：**[X GB]
- **日期范围：**[最早] — [最新]

## 清单

### [文件夹1]
| 项目 | 类型 | 大小 | 状态 | 反应 |
|------|------|------|--------|----------|
| file1.txt | text | 2KB | ✅ 已摄取 | 🔥 "精确引用" |
| file2.doc | doc | 15KB | ⏭️ 跳过 | — |
| file3.html | html | 4KB | ⬜ 未查看 | — |

### [文件夹2]
...

## 优先级队列
1. [最高优先级 — 为什么]
2. [下一个 — 为什么]
...

## 会话日志

### YYYY-MM-DD — [会话主题]
- 审查：[列表]
- 反应：[精确引用]
- 摄取：[创建的大脑页面]
- 下一个：[排队的内容]
```

## 反模式

- ❌ 在没有设置 `archive-crawler.scan_paths:` 的情况下运行。硬拒绝。
  这是安全合约 — 永远不要绕过。
- ❌ 硬编码特定时代的归档路径（例如，`originals/archive/`、
  `originals/yc-era/`）。在运行时读取归档规则。
- ❌ 重新展示已在清单中标记的项目。用户的时间
  是最稀缺的资源。
- ❌ 释义反应。仅精确词语。
- ❌ 用课程或要点包装发现的内容。让故事呼吸。
- ❌ 当内容引用有
  大脑页面的人/公司时跳过反向链接。根据 conventions/quality.md 的 Iron Law。

## 相关技能

- `skills/voice-note-ingest/SKILL.md` — 用于
  音频捕获的相同精确措辞模式
- `skills/idea-ingest/SKILL.md` — 具有相同
  主要主题归档规则的单个链接或文章摄取
- `skills/conventions/quality.md` — 引用、反向链接、语音

## 合约

此技能保证：

- 路由匹配 frontmatter 中的规范触发器。
- 输出写入 `writes_to:` 下列出的目录（如适用）。
- 遵循引用的约定（`quality.md`、`brain-first.md`、`_brain-filing-rules.md`）。
- 保留隐私合约：无真实姓名、无 fork 特定的文件系统路径字面量、无上游 fork 引用。

完整行为合约记录在上面的正文部分；此部分存在用于一致性测试。

## 输出格式

技能的输出形状记录在上面的正文部分的内联中（参见"输出"、"大脑页面格式"或等效项）。此处的字面部分标题存在用于一致性测试（`test/skills-conformance.test.ts`）。
