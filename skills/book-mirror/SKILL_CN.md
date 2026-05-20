---
name: book-mirror
version: 0.1.0
description: 获取任何书籍（EPUB/PDF），生成带有双列表格的个性化逐章分析。左列保留章节内容；右列使用大脑上下文将每个想法映射到读者的实际生活。输出是 media/books/<slug>-personalized.md 的单个大脑页面，可选通过 brain-pdf 生成 PDF。
triggers:
  - "personalized version of this book"
  - "mirror this book"
  - "two-column book analysis"
  - "apply this book to my life"
  - "how does this book apply to me"
mutating: true
writes_pages: true
writes_to:
  - media/books/
---

# book-mirror — 个性化逐章书籍分析

> **约定：** 参见 [_brain-filing-rules.md](../_brain-filing-rules.md) 了解
> 此技能归档在的授权 `media/<format>/<slug>` 例外。
>
> **约定：** 参见 [conventions/quality.md](../conventions/quality.md) 了解
> 引用规则、反向链接强制执行和输出质量标准。
>
> **约定：** 参见 [conventions/brain-first.md](../conventions/brain-first.md)
> 了解上下文收集阶段遵循的查找链（大脑 → 搜索 → 外部）。

## 这是什么

给定一本书（EPUB 或 PDF），生成一个大脑页面，其中每个章节
在左侧详细摘要，在右侧使用他们自己的词语、情况、人物和
大脑中的模式镜像回读者的实际生活。
输出是 `media/books/<slug>-personalized.md` 的大脑页面。

这不是通用书籍摘要。右列是价值：它使
这本书读起来像一位知道读者正在边距中留下笔记的治疗师。如果用户想要平面摘要，请将他们路由到不同的
技能。

## 信任合约（运行前阅读此内容）

book-mirror 作为 CLI 命令（`gbrain book-mirror`）运行，而不是作为
智能体通过工具调度的纯
markdown 技能。CLI 是受信任的
运行时；技能是围绕它的编排散文。

这对智能体意味着什么：

- CLI 提交 N 个只读子智能体作业（每章一个）。每个子智能体
  只有 `allowed_tools: ['get_page', 'search']`。他们不能
  调用 put_page 或任何变更操作。他们通过
  最终消息生成 markdown 分析。
- CLI 读取每个子项的 `job.result`，组装最终的
  双列页面，并通过单个 operator-trust `put_page` 写入。
- 这意味着不受信任的 EPUB/PDF 内容不能提示注入任何
  `people/*` 页面。信任缩小发生在工具允许列表，
  而不是在 slug 前缀层。

## 管道

```
1. 获取   → 用户在本地拥有 EPUB/PDF（手动；书籍获取
               当前未发布 — 参见下面的"获取书籍"）。
2. 提取   → 从 EPUB/PDF 将章节文本提取到每个章节一个 .txt。
3. 上下文   → 收集大脑知道的关于读者的一切。
4. 分析   → `gbrain book-mirror` 分出 N 个只读子智能体。
5. 组装  → CLI 读取每个子结果并写入一个 put_page。
6. PDF       → 可选：通过 skills/brain-pdf 渲染以交付。
```

## 1. 获取书籍

书籍获取（法律灰色区域下载器）被故意不发布
在此技能浪潮中。用户手动放置 EPUB/PDF。用户可能使用的
常见路径：

```bash
# 用户提供的路径
ls path/to/book.epub
ls path/to/book.pdf

# 或已在大脑仓库中（推荐用于跟踪）
ls $BRAIN_DIR/media/books/
```

从 gbrain 配置解析 `$BRAIN_DIR`（`gbrain config get sync.repo_path`）
或接受用户的输入。

## 2. 文本提取

目标：临时目录下每个章节一个 `.txt` 文件。智能体具有
shell + python 访问权限；CLI 在此下游并将
提取的目录作为输入。

### EPUB

```bash
SLUG="this-book"                                # kebab-case
WORK="$(mktemp -d)/$SLUG"
mkdir -p "$WORK/chapters"
unzip -o path/to/book.epub -d "$WORK/unpacked"

# 查找内容文件（XHTML/HTML），排序（章节顺序 = 排序顺序）
find "$WORK/unpacked" -name "*.xhtml" -o -name "*.html" | sort > "$WORK/files.txt"

# 按章节将 HTML 剥离为文本
python3 - <<'PY'
from bs4 import BeautifulSoup
import os, sys
work = os.environ['WORK']
files = open(f'{work}/files.txt').read().splitlines()
for i, path in enumerate(files, 1):
    html = open(path, encoding='utf-8', errors='replace').read()
    text = BeautifulSoup(html, 'html.parser').get_text('\n')
    text = '\n'.join(line.strip() for line in text.splitlines() if line.strip())
    with open(f'{work}/chapters/{i:02d}.txt', 'w') as f:
        f.write(text)
PY
```

如果 `bs4` 缺失：`pip3 install beautifulsoup4 lxml`。

检查章节文件以识别哪些是真实章节与
前辅文（目录、版权、致谢）。通常 EPUB 每个章节提供一个文件；
有时每个文件多个章节。使用
`head -5 "$WORK/chapters/"*.txt` 进行抽查。

### PDF

```bash
pdftotext -layout path/to/book.pdf "$WORK/full.txt"
```

然后按章节标题拆分（查找"Chapter N"、"CHAPTER N"或
全大写标题行），使用 `awk` 或 `python`。如果 PDF 是
没有嵌入文本的扫描，回退到通过 `skills/brain-pdf` 或另一个
视觉工具进行 OCR。

### 质量检查

对于每个章节文件：

- 字数 > 1500（典型章节范围 2k-8k 字）。
- 无 HTML 标签。
- 段落用 `\n\n` 保留。

保存 `chapters/INDEX.md` 映射章节号 → 标题 → 文件 → 字数
以供参考。

## 3. 上下文收集

这是最关键的步骤。右列仅与
馈送到每个章节子智能体的上下文一样好。

### 要拉取什么

1. **模板：USER.md 和 SOUL.md** 如果用户维护它们
   （gbrain 在 `templates/USER.md` 和 `templates/SOUL.md` 发布模板；
   它们在填充时位于大脑仓库中）。完整读取。
2. **最近每日记忆** — 大脑页面下最近 14 天
   `wiki/personal/reflections/` 或用户归档每日笔记的任何位置。
3. **调整到书籍主题的主题相关大脑搜索**：
   - `gbrain query "marriage"`，`gbrain query "couples therapy"` 用于
     婚姻书籍。
   - `gbrain query "founders"`，`gbrain query "fundraising"` 用于
     商业书籍。
   - `gbrain query "shame"`，`gbrain query "anger"` 用于心理学书籍。
4. **相关实体的大脑页面** — `gbrain query "<name>"` 用于
   可能会出现的人。
5. **固定模式** — 用户反思或
   原始内容中反复出现的任何内容。

### 组装上下文包

将所有内容写入 CLI 可以读取的单个文件：

```bash
CONTEXT="$WORK/context.md"
{
  echo "## USER.md（如果有）"
  [ -f "$BRAIN_DIR/USER.md" ] && cat "$BRAIN_DIR/USER.md"
  echo
  echo "## SOUL.md（如果有）"
  [ -f "$BRAIN_DIR/SOUL.md" ] && cat "$BRAIN_DIR/SOUL.md"
  echo
  echo "## 最近反思（最近 14 天）"
  # 拉取最近每日反思 — 调整以适应用户的归档方案
  # ...
  echo
  echo "## 主题相关大脑页面"
  # gbrain 查询书籍的关键主题，嵌入顶部结果
  # ...
  echo
  echo "## 主题和关键点"
  # 由智能体编写的 1 页摘要，调用出：
  # - 用户生活中当前活跃的与此书相交的内容
  # - 映射到书籍主题的用户的具体引用
  # - 应该出现在右列的人和日期
} > "$CONTEXT"
```

使其密集。每个章节子智能体都会读取它。

## 4. 分析：调用 `gbrain book-mirror`

```bash
gbrain book-mirror \
  --chapters-dir "$WORK/chapters" \
  --context-file "$CONTEXT" \
  --slug "$SLUG" \
  --title "Book Title Goes Here" \
  --author "Author Name" \
  --model claude-opus-4-7
```

CLI：

- 验证输入并加载章节文件。
- 打印成本估算（Opus 约 $0.30/章节）并提示确认。
- 提交 N 个带有只读 `allowed_tools` 的子智能体作业。
- 等待每个子项完成。
- 读取每个子项的 `job.result`（markdown 分析文本）。
- 将所有章节组装成一个带有 frontmatter + 介绍 + 每章节
  部分 + 结尾的页面。
- 写入一个 `put_page` 到 `media/books/<slug>-personalized.md`。
- 在 stdout 上报告 JSON 信封：
  `{"slug": "...", "chapters_total": N, "chapters_completed": N, "chapters_failed": 0}`。

如果任何章节失败，CLI 退出 1，用户可以重新运行 — 幂等性
键（`book-mirror:<slug>:ch-<N>`）在
队列级别去重已完成的章节，所以重试很便宜。

### 模型：Opus 默认

默认模型是 `claude-opus-4-7`。Sonnet 工作（使用 `--model
claude-sonnet-4-6`）但右列质量明显下降 — 使分析读起来像知道用户的治疗师的
纹理需要 Opus 级推理。

### 成本门

CLI 拒绝在非 TTY 上下文中花费而不使用 `--yes`。CI/脚本
调用必须显式传递 `--yes`。TTY 用户在提交之前获得 `[y/N]` 提示。

## 5. PDF（可选）

大脑页面写入后，使用 `skills/brain-pdf` 渲染为 PDF：

```bash
gbrain put_page  # CLI 已完成；此处无需添加
# 然后调用 brain-pdf：
# （参见 skills/brain-pdf/SKILL.md 了解 make-pdf 调用）
```

## 6. 事实检查和交叉链接

页面落地后，对关于读者的事实声明进行事实检查
（父母、兄弟姐妹、婚姻历史、工作、遗产）。常见错误
模式要注意：

- 将读者的父母关系与扩展家庭中的模式混淆。
- 当读者的父母仍在一起时发明治疗背景故事（"在他父母离婚后…"）。
- 错误的孩子数量/年龄、错误的配偶/孩子/兄弟姐妹姓名。

如果你无法验证声明，请删除它。最好丢失纹理而不是
引入虚假。

交叉链接分析中提到的人/公司：

- 对于右列引用的每个有大脑页面的人，从 `people/<slug>` 添加
  反向链接到新的 `media/books/<slug>-personalized`
  页面（根据 `conventions/quality.md` Iron Law）。

## 质量标准（门槛）

**左列**应该：

- 保留作者的实际故事、统计数据、框架、示例。
- 逐字引用令人难忘的短语。
- 足够详细，读者可以跳过书籍而不会丢失太多。

**右列**应该：

- 使用读者来自上下文包的*实际引用词语*。
- 按名称引用*具体*日期、情况、人。
- 读起来像知道读者正在边距中留下笔记的治疗师。
- 对直接命中诚实（"这正是[name a real situation]"）。
- 对未命中诚实（"此章节不太直接相关的
  因为…"）。不要强制连接。

**整个文档**应该感觉像一个连贯的声音，校准到
读者的实际生活而不是通用配置文件，并诚实关于
书籍的框架如何为此特定读者 breakdown。

## 反模式（不要做这些）

- ❌ **略读章节。** 固定指令：保留细节。
- ❌ **通用右列。** "如果你曾经感到…，这可能适用→"
  立即杀死。
- ❌ **关于读者生活的 factual 错误。** 始终在
  组装后进行事实检查。
- ❌ **给子智能体 put_page 访问权限。** 信任合约是只读的；
  CLI 进行写入。
- ❌ **强制连接。** 如果章节不适用，就直说。
- ❌ **右列中的奉承或说教。** 无"你应该…"，
  无"考虑…"，无"也许是时候…"。
- ❌ **截断左列。** 书籍的实际内容需要
  存活。

## 输出检查列表

- [ ] 书籍文件在本地存在（路径已知）。
- [ ] `$WORK/chapters/*.txt` 下的章节文本，具有合理的字数。
- [ ] `$WORK/context.md` 的上下文包是密集的。
- [ ] `gbrain book-mirror --chapters-dir … --context-file … --slug … --title …` 返回退出 0。
- [ ] `media/books/<slug>-personalized.md` 在大脑中存在。
- [ ] 事实检查通过（对 USER.md 或其他真理源页面无错误）。
- [ ] 从引用的人/公司添加的交叉链接。
- [ ] 可选：通过 brain-pdf 渲染并交付的 PDF。

## 相关技能

- `skills/brain-pdf/SKILL.md` — 将个性化页面渲染为 PDF。
- `skills/strategic-reading/SKILL.md` — 通过特定的
  问题镜头而不是个性化到整个读者来阅读书籍。
- `skills/article-enrichment/SKILL.md` — 应用于文章的相同形状
  而不是书籍。

## 合约

此技能保证：

- 路由匹配 frontmatter 中的规范触发器。
- 输出写入 `writes_to:` 下列出的目录（如适用）。
- 遵循引用的约定（`quality.md`、`brain-first.md`、`_brain-filing-rules.md`）。
- 保留隐私合约：无真实姓名、无 fork 特定的文件系统路径字面量、无上游 fork 引用。

完整行为合约记录在上面的正文部分；此部分存在用于一致性测试。

## 输出格式

技能的输出形状记录在上面的正文部分的内联中（参见"输出"、"大脑页面格式"或等效项）。此处的字面部分标题存在用于一致性测试（`test/skills-conformance.test.ts`）。

## 反模式

完整反模式列表在上面的正文部分；此标题存在用于一致性测试，如果正文使用不同的大小写。
