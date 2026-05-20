---
name: citation-fixer
version: 1.1.0
description: |
  审计和修复跨大脑页面的引用格式。确保每个事实都有
  匹配标准格式的内联 [来源: ...] 引用。在
  v0.25.1 中扩展：扫描缺少实际 URL 的损坏推文/帖子引用并
  通过主机的 X / Twitter API 集成解析它们。
triggers:
  - "fix citations"
  - "fix broken citations"
  - "citation audit"
  - "check citations"
  - "citation fixer"
tools:
  - search
  - get_page
  - put_page
  - list_pages
mutating: true
---

# 引用修复器技能

> **约定：** 参见 [conventions/quality.md](../conventions/quality.md) 了解
> 每个修复应该匹配的规范引用格式。
>
> **输出规则：** 所有链接必须是确定性的（从 API 数据构建，
> 不是由 LLM 编写）。参见 [_output-rules.md](../_output-rules.md)。

## 合约

此技能保证：

- 扫描每个大脑页面的引用合规性。
- 缺少的引用被标记有具体位置。
- 格式错误的引用被修复以匹配标准格式。
- **（v0.25.1）** 没有 URL 的推文/帖子引用通过
  X API 解析并修补有确定性的 `https://x.com/<handle>/status/<id>`
  链接。
- 结果用计数报告（扫描的、修复的、剩余的）。

## 阶段

1. **扫描页面。** 列出页面并读取每个页面，检查内联
   `[来源: ...]` 引用。
2. **识别问题：**
   - 没有任何引用的引用
   - 缺少日期的引用
   - 缺少来源类型的引用
   - 格式错误的引用
   - **（v0.25.1）** 没有 `x.com` URL 的推文引用
3. **修复格式问题。** 重写格式错误的引用以匹配
   `conventions/quality.md`。
4. **（v0.25.1）通过 X API 集成解析推文引用。**
5. **报告结果。** 计数：扫描的页面、发现的引用、问题
   修复的、解析的推文、剩余的差距。

## 推文解析管道（v0.25.1 扩展）

对于每个损坏的推文引用，遵循此链。实际的 API 调用
通过主机配置的任何 X 集成（典型
形状：在 `recipes/x-api/` 下带有 handle / search-all
端点的配方）。

### 步骤1：识别损坏的引用

扫描页面以查找指示没有 URL 的推文引用的模式：

- 包含诸如 `tweeted`、`posted`、`said on X`、`RT`、`retweet`、
  `X post` 的词语
- 包含看起来像推文的引用文本（简短、有力、经常
  以引用开始）
- 有 `[来源: ... X/Twitter ...]` 而没有 `x.com` URL
- 引用参与指标（点赞、展示）而没有链接

### 步骤2：提取可搜索的内容

从每个损坏的引用中，提取：

- **句柄**（如果提到：`@<username>`）
- **引用文本**（如果可用）
- **近似日期**（经常出现在周围的时间线条目中）

### 步骤3：搜索实际推文

使用主机的 X API 集成。查询模式：

```
# 句柄 + 引用文本：
from:<handle> "<精确引用片段>"

# 仅引用文本：
"<精确引用片段>"

# 转推的原始内容：
"<精确引用>" -is:retweet
```

### 步骤4：验证并提取元数据

找到候选后：

- 确认文本与引用片段匹配。
- 拉取推文 ID、作者句柄、参与指标（点赞 / 转推 /
  展示）。
- 构造 URL：`https://x.com/<handle>/status/<tweet_id>`。

### 步骤5：修补大脑页面

用适当的引用替换损坏的引用：

**之前：**

```
"<引用片段>" [来源: <一些模糊归属>]
```

**之后：**

```
"<完整验证的引用>" — <N> 点赞，<N> 转推，<N> 展示
[来源: [X/<handle>, YYYY-MM-DD](https://x.com/<handle>/status/<tweet_id>)]
```

## 批量模式

扫描许多页面时：

### 查找候选页面

```bash
# 提到推文但没有 x.com 链接的页面
for f in $(find . -name "*.md" -not -path "./node_modules/*"); do
  refs=$(grep -ci "tweet\|posted\|x post\|RT\|retweet\|said on X" "$f")
  links=$(grep -c "x.com/.*/status/" "$f")
  if [ "$refs" -gt 2 ] && [ "$links" -eq 0 ]; then
    echo "$f"
  fi
done
```

### 优先级顺序

1. 最近创建/更新的页面 — 新鲜的损坏引用最容易
   在上下文新鲜时解析。
2. 高流量页面（来自其他技能的频繁读取/写入）。
3. 其他一切 — 随着时间的推移进行批量清理。

### 速率限制

- X API：尊重主机的层级限制；不要攻击。
- 目标：每批运行约 50 个页面。
- 每个页面 1-3 个 API 调用（搜索 + 验证）。
- 每 10-20 个页面批量提交，以便部分失败不会
   丢失进度。

## 输出格式

```
引用审计报告
=====================
扫描的页面：        N
发现的引用：      N
修复的问题：         N
解析的推文链接： N
剩余的差距：       N（有不可引用事实的页面）
```

## 反模式

- ❌ 为没有来源的事实发明引用。标记它们。
- ❌ 删除缺少引用的引用（标记它们；不要删除）。
- ❌ 在不读取完整页面上下文的情况下修复引用。
- ❌ 在不首先检查样本质量的情况下进行批量修复
  （参见 `conventions/test-before-bulk.md`）。
- ❌ 通过猜测推文 ID 来编写推文 URL。始终通过
  X API；仅确定性链接。

## 集成

可以调用此技能：

- **手动** — "修复此页面上的引用"
- **作为批量定时任务** — 每周扫描有损坏引用的页面
- **由其他技能** — `enrich` 或 `media-ingest` 可以在提交之前调用 citation-fixer
  以验证输出

## 指标

如果作为重复批量运行，请在
`~/.gbrain/citation-fixer-state.json` 下的小 JSON 文件中跟踪状态：

```json
{
  "last_run": "2026-04-15T...",
  "pages_scanned": 0,
  "citations_fixed": 0,
  "tweet_links_resolved": 0,
  "citations_unresolvable": 0,
  "pages_remaining": 1424
}
```

## 输出格式

技能的输出形状记录在上面的正文部分的内联中（参见"输出"、"大脑页面格式"或等效项）。此处的字面部分标题存在用于一致性测试（`test/skills-conformance.test.ts`）。
