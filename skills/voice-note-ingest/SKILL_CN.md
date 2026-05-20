---
name: voice-note-ingest
version: 0.1.0
description: |
  摄取语音笔记并保留确切措辞（绝不释义）。根据决策树将内容路由到originals/、concepts/、people/、companies/、ideas/、personal/或voice-notes/。用户的确切话语就是信号。
triggers:
  - "voice note"
  - "ingest this voice memo"
  - "transcribe and file"
  - "voice note ingest"
  - "save this audio note"
  - "audio message"
mutating: true
writes_pages: true
writes_to:
  - voice-notes/
  - originals/
  - concepts/
  - people/
  - companies/
  - ideas/
  - personal/
---

# 语音笔记摄取 — 确切措辞语音捕获

> **约定：** 参见 [conventions/quality.md](../conventions/quality.md) 了解
> 引用规则、反向链接强制执行和确切措辞要求。
>
> **约定：** 参见 [_brain-filing-rules.md](../_brain-filing-rules.md) 了解
> 归档决策协议。

## 铁律

用户的**确切话语**就是洞察。绝不释义。绝不清理。
生动、未润色的意识流措辞捕获了
润色后的散文所没有的东西。在块引用中保留它。
分析部分可以解释；转录本部分是神圣的。

- ✅ `"The ambition-to-lifespan ratio has never been more fucked"`
- ❌ `User noted the tension between ambition and mortality`

## 何时调用

用户通过任何渠道（Telegram、语音
备忘录上传、openclaw音频附件）发送音频或语音消息。主机代理通常提供
转录本文本。如果没有，通过`gbrain transcription`转录（默认使用Groq
Whisper；对于> 25MB的音频，通过ffmpeg分段使用OpenAI后备）。

## 管道

```
1. 存储       → 上传原始音频到gbrain存储后端
                 （S3 / Supabase存储 / 本地 — 可插入每个
                 src/core/storage.ts）。
2. 转录  → 使用代理提供的逐字转录本，或调用
                 gbrain transcription（如果未提供转录本）。
3. 路由       → 应用决策树（如下）找到正确的
                 目标目录。
4. 写入       → 创建/更新目标brain页面；保留
                 逐字转录本在块引用的"User's Words"
                 部分中。
5. 交叉链接  → 对于每个提及的实体（人物、公司），从它们
                 的brain页面添加时间线反向链接到这一个
                 （按照conventions/quality.md的铁律）。
```

## 决策树（内容去向）

按顺序应用。第一个匹配获胜。如果多个类别适用，归档到
主要目录并交叉链接到其他目录。

1. **原始想法、观察或论文** — 用户正在表达
   新颖的思想、框架或他们生成的联系。
   → `originals/<slug>.md`。使用用户的生动语言作为slug。

2. **关于他们遇到的世界概念** — 用户引用的
   其他人创建的框架或模型。
   → `concepts/<slug>.md`。

3. **关于特定人物** — 关于某人的新信息、意见或观察。
   → 更新`people/<person>.md`时间线。

4. **关于特定公司** — 关于公司的新信息。
   → 更新`companies/<company>.md`时间线。

5. **产品或商业想法** — 可以构建的东西。
   → `ideas/<slug>.md`。

6. **个人反思** — 治疗相邻、情感、身份。
   → 附加到适当的`personal/<slug>.md`。

7. **以上都不是/随机想法/不太适合** —
   → `voice-notes/YYYY-MM-DD-<slug>.md`（包罗万象）。

**多个类别？** 创建主要页面，然后交叉链接到所有
其他。如果语音笔记涵盖了人物**和**新颖想法，创建
originals/页面**并**更新该人物的时间线。

## Brain页面格式

对于所有语音笔记衍生的页面，包括此骨架：

```markdown
---
title: "[从内容派生的标题]"
type: [original | concept | voice-note | ...]
created: YYYY-MM-DD
updated: YYYY-MM-DD
tags: [voice-note, relevant-tags]
sources:
  voice-note:
    type: voice_note
    storage_path: "[gbrain存储URL或相对路径]"
    acquired: YYYY-MM-DD
    acquired_via: "来自<channel>的语音笔记"
---

# 标题

> 所说的内容的执行摘要以及为什么它很重要。

## User's Words

> "确切的转录本，逐字，保留每个词、犹豫和口头
> 填充词。这是主要来源材料。不要编辑。"

🔊 [Audio]([gbrain存储URL或相对路径])

## Analysis

[这意味着什么，为什么它很重要，与其他思想的联系。
分析是代理的解释；上面的转录本是神圣的。]

## 另见

- [带有相对链接的相关brain页面]

---

## 时间线

- **YYYY-MM-DD** | 来自<channel>的语音笔记 — [简要描述]
```

## 引用格式

```
[Source: voice note, <channel>, YYYY-MM-DD]
```

可用时包括时间戳：

```
[Source: voice note, <channel>, YYYY-MM-DD HH:MM PT]
```

## 命名约定

- 音频文件：`YYYY-MM-DD-<brief-slug>.<ext>`（例如，
  `2026-04-13-rick-rubin-creative-philosophy.ogg`）
- Brain页面：匹配目标目录的slug。

## 批量与单个

本技能一次处理一个语音笔记。每个都是自己的摄取周期。
无批处理。

## 反模式

- ❌ **释义转录本。** 确切的词就是信号。
- ❌ **清理犹豫或填充词**（"um"、"like"、"you
   know"）。纹理很重要。
- ❌ **创建没有实体交叉链接的页面**，当提及了人物/公司时。
  铁律失败。
- ❌ **跳过音频存储步骤。** 始终上传原始文件；
  brain页面具有指向它的`🔊 [Audio]`链接。

## 相关技能

- `skills/signal-detector/SKILL.md` — 用于
  文本渠道想法捕获的相同确切措辞模式
- `skills/idea-ingest/SKILL.md` — 用于键入文本想法摄取
- `skills/conventions/quality.md` — 引用 + 反向链接规则

## 契约

本技能保证：

- 路由匹配frontmatter中的规范触发器。
- 输出写入`writes_to:`下列出的目录（如适用）。
- 遵循引用的约定（`quality.md`、`brain-first.md`、`_brain-filing-rules.md`）。
- 保留隐私契约：无真实姓名、无特定于fork的文件系统路径字面量、无上游fork引用。

完整行为契约在上述正文部分中记录；此部分存在用于一致性测试。

## 输出格式

技能的输出形状在上述正文部分中内联记录（参见"输出"、"brain页面格式"或等效项）。此处的字面部分标题存在用于一致性测试（`test/skills-conformance.test.ts`）。
