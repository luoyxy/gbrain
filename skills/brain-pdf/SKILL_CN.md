---
name: brain-pdf
version: 0.1.0
description: 通过 gstack make-pdf 二进制文件从任何大脑页面生成出版质量的 PDF。剥离 YAML frontmatter，清理 emoji，应用运行页眉和页码。大脑页面始终是真相源；PDF 是渲染。
triggers:
  - "make pdf from brain"
  - "brain pdf"
  - "convert brain page to pdf"
  - "publish this page as pdf"
  - "export brain page"
---

# brain-pdf — 将大脑页面渲染为出版质量的 PDF

> **约定：** 参见 [conventions/quality.md](../conventions/quality.md) 了解
> 输出规则。PDF 是渲染 — 永远不是主要工件。如果
> PDF 存在，源大脑页面就在它后面。

## 规则

大脑页面始终是真相源。PDF 是
它的渲染，永远不是独立工件。如果 PDF 存在于某处，大脑
页面必须在它后面存在。

## 这是什么

使用 gstack `make-pdf` 二进制文件将大脑页面（带有 frontmatter 的 markdown）
渲染为出版质量的 PDF。输出
适用于：

- 通过电子邮件或 Telegram 共享个性化书籍镜像
- 将战略阅读剧本作为清晰读物交付
- 生成带有运行页眉和页码的简报或报告
- 以可移植格式归档长篇文章

## 前提条件：gstack make-pdf

此技能依赖于位于以下位置的 gstack `make-pdf` 二进制文件：

```
$HOME/.claude/skills/gstack/make-pdf/dist/pdf
```

用户必须已安装 gstack。如果缺失，技能无法运行。
未来的 v0.26+ 可能会捆绑回退 PDF 渲染器；对于 v0.25.1，gstack
是软前提条件。

在调用之前验证它存在：

```bash
P="$HOME/.claude/skills/gstack/make-pdf/dist/pdf"
[ -x "$P" ] || { echo "make-pdf not installed; install gstack" >&2; exit 1; }
```

## 工作流

```
1. 解析  → 确认大脑页面存在 (gbrain get <slug>)。
2. 剥离    → 移除 YAML frontmatter — 否则渲染器会
              将其转储为一整页原始元数据文本。
3. 渲染   → 使用合理的默认值调用 make-pdf（无 --cover，无 --toc）。
4. 交付  → 通过智能体的首选
              渠道将 PDF 交给请求者（不要在 Telegram 上使用原始 `MEDIA:` 标签 —
              它们会静默失败）。
```

## 调用

```bash
SLUG="path/to/page"
P="$HOME/.claude/skills/gstack/make-pdf/dist/pdf"

# 1. 确认页面存在。
gbrain get "$SLUG" > /dev/null || { echo "Page $SLUG not found" >&2; exit 1; }

# 2. 获取原始 markdown。两条路径：从大脑仓库读取（如果用户
#    本地同步）或 通过 API 向 gbrain 请求正文。
BRAIN_DIR=$(gbrain config get sync.repo_path 2>/dev/null || echo)
if [ -n "$BRAIN_DIR" ] && [ -f "$BRAIN_DIR/$SLUG.md" ]; then
  RAW="$BRAIN_DIR/$SLUG.md"
else
  RAW=$(mktemp /tmp/brain-page-XXXXXX.md)
  gbrain get "$SLUG" --raw > "$RAW"   # 无论什么标志暴露原始正文
fi

# 3. 剥离 YAML frontmatter — sed：跳过开头的 '---' 直到
#    结束的 '---'（第 1..N 行），然后保留之后的一切。
CLEAN=$(mktemp /tmp/brain-page-clean-XXXXXX.md)
sed '1{/^---$/!q}; /^---$/,/^---$/d' "$RAW" > "$CLEAN"

# 4. 渲染。默认无 --cover，无 --toc — 它们看起来很企业化
#    并浪费空间。仅在明确请求时添加它们。
OUT="/tmp/$(basename "$SLUG").pdf"
CONTAINER=1 "$P" generate "$CLEAN" "$OUT"

echo "Rendered: $OUT"
```

`CONTAINER=1` 在容器化环境中是强制性的 — 它告诉
Playwright 跳过 Chromium 沙盒。在裸机上无害。

## 常见模式

```bash
# 默认 — 干净 PDF，无封面，无 TOC
brain-pdf <slug>

# 进行中工作的草稿水印
CONTAINER=1 "$P" generate --watermark DRAFT "$CLEAN" "$OUT"

# 如果用户明确要求，可选封面 + TOC
CONTAINER=1 "$P" generate --cover --toc "$CLEAN" "$OUT"

# 自定义标题 + 作者覆盖（否则从 frontmatter 拉取）
CONTAINER=1 "$P" generate --title "Custom Title" --author "Custom Author" "$CLEAN" "$OUT"
```

## 默认值：无封面，无 TOC

这些标志默认关闭，因为它们看起来很企业化并在
大多数个人知识内容上浪费空间。仅当用户
明确要求"正式"输出时添加它们（例如，他们要发送到
董事会或打印为可交付物）。

## 字体要求

渲染器需要：

- `fonts-liberation`（Helvetica/Arial 替代）
- `fonts-noto-cjk`（中文/日文/韩文字符）
- 最小正文字体大小：10pt（页面 chrome 9pt）
- 正文文本：11pt

如果在没有这些字体的环境中运行，请通过
主机的包管理器安装它们（`apt install fonts-liberation fonts-noto-cjk`，在
Debian/Ubuntu 容器上）。

## 交付

渲染后，通过智能体的首选渠道交付：

- **Telegram：** 使用带有 `filePath="/tmp/<slug>.pdf"`
  附件的 `message` 工具。永远不要使用原始 `MEDIA:` 标签 — 它们会静默失败。
- **电子邮件：** 通过主机的电子邮件工具附加。
- **直接文件响应：** 打印 PDF 路径；用户可以手动
  拉取它。

始终在交付消息中包含大脑页面链接，以便用户
也可以在 GitHub / 本地看到它。PDF 是渲染；源
是工件。

## 反模式

- ❌ 在没有首先确认大脑页面存在的情况下生成 PDF。
  无源 = 无 PDF。
- ❌ 跳过 frontmatter 剥离。渲染器将 frontmatter 转储为
  第一页上的原始文本；难看。
- ❌ 跳过 emoji 清理。未映射到渲染的 emoji
  字体显示为 `□` 框。
- ❌ 默认添加 `--cover` 或 `--toc`。除非被要求，否则关闭。
- ❌ 对 Telegram 交付使用原始 `MEDIA:` 标签。使用带有 `filePath` 的 `message`
  工具。

## 相关技能

- `skills/book-mirror/SKILL.md` — 生成一个大脑页面，它是
  brain-pdf 的自然输入（逐章个性化分析）。
- `skills/strategic-reading/SKILL.md` — 相同形状，问题镜头变体。
- `skills/publish/SKILL.md` — 将大脑页面共享为密码保护的
  HTML（不同的渲染目标）。

## 合约

此技能保证：

- 路由匹配 frontmatter 中的规范触发器。
- 输出写入 `writes_to:` 下列出的目录（如适用）。
- 遵循引用的约定（`quality.md`、`brain-first.md`、`_brain-filing-rules.md`）。
- 保留隐私合约：无真实姓名、无 fork 特定的文件系统路径字面量、无上游 fork 引用。

完整行为合约记录在上面的正文部分；此部分存在用于一致性测试。

## 输出格式

技能的输出形状记录在上面的正文部分的内联中（参见"输出"、"大脑页面格式"或等效项）。此处的字面部分标题存在用于一致性测试（`test/skills-conformance.test.ts`）。
