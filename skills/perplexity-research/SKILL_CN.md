---
name: perplexity-research
version: 0.1.0
description: 大脑增强的网络研究。将关于主题的大脑
  上下文发送到 Perplexity，它使用引用和返回搜索网络
  什么是新的 vs 大脑已经知道的。用于实体丰富、当前状态
  检查、交易监控和新鲜度增量。不用于简单 URL 获取（使用 web_fetch）或仅大脑查询（使用 gbrain query）。
triggers:
  - "perplexity research"
  - "perplexity-research"
  - "what's new about"
  - "current state of"
  - "web research"
  - "what changed about"
  - "surface new developments"
mutating: true
writes_pages: true
writes_to:
  - research/
---

# perplexity-research — 大脑增强的网络研究#

> **约定：** 参见 [conventions/quality.md](../conventions/quality.md) 了解
> 引用规则；来自网络研究的每个声明都带有可验证的
> 引用，而不是释义。

>
> **约定：** 参见 [conventions/brain-first.md](../conventions/brain-first.md)
> 了解查找链。此技能通过发送大脑
> 上下文作为 Perplexity 提示的一部分来增强 —— 网络搜索专注于
> 与提供的上下文之间的增量。

## 这是做什么的#

将现有大脑知识与 Perplexity 的网络搜索相结合。#
智能体将关于主题的大脑上下文发送到#
Perplexity 查询；#
Perplexity 搜索 + 读取 + 综合多个页面并带有引用，#
专注于与提供的上下文相比什么是新的。

**关键见解：** Perplexity 不仅仅是搜索 —— 它读取并#
综合带有引用的页面。通过发送大脑上下文#
在提示中，它知道你已经知道什么，所以它浮出增量#
而不是重复已确定的事实。

## 何时使用 vs 其他工具#

| 需要 | 使用 |
|------|-----|
| 带有引用的深度研究 | **此技能** — Perplexity + Opus |
| 快速 URL 内容 | `web_fetch` |
| 仅大脑查找 | `gbrain query` / `gbrain search` |
| 实时社交媒体监控 | 外部 X / 社交媒体收集器 |
| 针对跟踪器的结构化数据查找 | `skills/data-research/SKILL.md` |

## 输出结构#

研究输出作为 `research/<slug>.md` 下的大脑页面落地，带有#
此结构：

```markdown
---
title: "[主题] — 研究 [YYYY-MM-DD]"
type: research
date: YYYY-MM-DD
brain_context_slugs: ["以其上下文发送到 Perplexity 的页面"]
recency_filter: "[hour|day|week|month|none]"
---

# [主题] — 研究 [YYYY-MM-DD]

> 执行摘要：2-3 句话关于大脑知识
> 和当前网络状态之间的增量。

## 关键新发展#

自大脑上次更新此主题以来什么改变了。

## 确认信号#

验证现有大脑知识的网络证据。

## 矛盾或更新#

与此冲突的事物 —— 这些需要更仔细地查看。

## 推荐的大脑更新#

基于此研究，用户可能想要进行的特定页面更新。
每个项：哪个页面，要添加或更改什么，源 URL。

## 引用#

- [源标题](URL) — 访问 YYYY-MM-DD
- [源标题](URL) — 访问 YYYY-MM-DD
- ...
```

## 调用#

技能是 markdown 智能体指令；智能体直接使用 Perplexity 的#
API（或如果安装了主机提供的 `perplexity` CLI）：

```bash
# 1. 拉取大脑上下文
gbrain get <slug>                    # 或
gbrain query "<主题关键词>"

# 2. 使用大脑上下文撰写 Perplexity 查询：
#    """
#    主题：<主题>
#    大脑上下文（我们已经知道的）：<嵌入的 gbrain 内容>
#    查找：自 YYYY-MM-DD 以来什么是新的，大脑不反映。
#    引用每个声明。
#    """

# 3. 调用 Perplexity API 或主机的 perplexity 二进制：
#    curl https://api.perplexity.ai/chat/completions \
#      -H "Authorization: Bearer $PERPLEXITY_API_KEY" \
#      -H "Content-Type: application/json" \
#      -d '{"model": "sonar-pro", "messages": [{"role":"user","content":"..."}]}'

# 4. 通过 put_page 写入结构化研究页面：
gbrain put research/<slug>      # 通过 put_page 操作

# 5. 按铁律交叉链接实体。
```

## 模型#

| 模型 | 每次查询的成本 | 使用时间 |
|-------|-------------|----------|
| Perplexity sonar-pro | ~$0.04 | 深度分析、实体丰富、交易研究 |
| Perplexity sonar | ~$0.007 | 快速查找、批量监控、简报管道 |

默认为 sonar-pro。为批量/定时上下文丢弃到 sonar#
当成本#
相对于深度更重要时。

## 集成模式#

### 实体丰富#

由 `skills/enrich/SKILL.md` 在实体页面（人员、公司）#
需要当前网络上下文时调用：

```bash
# 从需要丰富内容的实体页面拉取 gbrain 上下文
BRAINS=$(gbrain get people/<slug> 2>/dev/null || echo)
# 发送 <slug> 的页面内容作为大脑上下文到 Perplexity，获取
# 当前新闻 / 角色 / 上下文，然后更新大脑页面以及新的内容。
```

### 交易 / 公司监控（定时）#

对于每个 `deals/` 或 `companies/` 下的活跃项：#

```bash
# 每周：拉取每个公司的最近新闻；标记更改以进行审查。
```

### 早晨简报#

用此技能替换简报管道中的原始 `web_fetch` 调用，以便#
智能体不会重新叙述已知事实。

## 最近过滤器#

传递 `recency_filter` 到 Perplexity：`hour | day | week | month`。有用#
用于新闻循环主题；对于常青研究则省略。

## 反模式#

- ❌ 发送否大脑上下文。然后它就仅仅是搜索 —— 使用 `web_fetch`
  相反。
- ❌ 截断大脑上下文。发送密集上下文 —— 价值
  在"我们知道什么"和"什么是新的"之间。
- ❌ 丢弃引用。输出中的每个声明都必须有 URL。
- ❌ 跳过交叉链接步骤当实体被提到时。铁律。
- ❌ 用 API 样板覆盖用户的直接陈述。#

## 环境#

- `PERPLEXITY_API_KEY` 设置在智能体的环境中（或在#
  `~/.gbrain/.env` 中）。
- 可选：安装 Perplexity 的官方 CLI 以获取更丰富的流式输出。#

## 相关技能#

- `skills/academic-verify/SKILL.md` — 包装 perplexity-research 以获取
  引用验证的学术声明检查#
- `skills/enrich/SKILL.md` — 调用 perplexity-research 作为
  实体丰富循环的一部分#
- `skills/data-research/SKILL.md` — 结构化数据跟踪器（不同的
  形状：参数化 YAML 配方，而不是自由形式研究）#

## 合约#

此技能保证：#

- 路由匹配 frontmatter 中的规范触发器。#
- 输出写入 `writes_to:` 下列出的目录（如适用）。#
- 遵循引用的约定（`quality.md`、`brain-first.md`、`_brain-filing-rules.md`）。#
- 隐私合约保留：无真实姓名、无 fork 特定的文件系统路径字面量、无上游 fork 引用。#

完整行为合约记录在上面的正文部分；此部分存在用于一致性测试。

## 输出格式#

技能的输出形状记录在上面的正文部分的内联中（参见"输出"、"大脑页面格式"或等效项）。此处的字面部分标题存在用于一致性测试（`test/skills-conformance.test.ts`）。#
