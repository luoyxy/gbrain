---
name: maintain
version: 1.0.0
description: |
  大脑健康检查：反向链接强制执行、引用审计、归档验证、
  过时信息检测、孤立页面和基准。当要求检查
  大脑健康、运行维护或审计质量时使用。
triggers:
  - "brain health"
  - "check backlinks"
  - "maintenance"
  - "orphan pages"
  - "stale pages"
  - "extract links"
  - "build link graph"
  - "populate timeline"
  - "populate links"
  - "backfill graph"
  - "extract timeline entries"
  - "run dream"
  - "process today's session"
  - "process yesterday's transcripts"
  - "synthesize my conversations"
  - "what patterns did you see"
  - "did the dream cycle run"
  - "consolidate yesterday's conversations"
tools:
  - get_health
  - get_page
  - put_page
  - list_pages
  - get_backlinks
  - add_link
  - search
mutating: true
---

# 维护技能#

定期大脑健康检查和清理。

## 合约#

此技能保证：

- 检查所有健康维度（过时、孤立、死链接、交叉引用、反向链接、引用、归档、标签）
- 发现的每个问题都有具体的修复操作
- 反向链接铁律被强制执行
- 引用格式根据标准进行验证
- 结果按维度用计数报告

## 阶段#

### 自主路径（v0.36.4.0）—— 当你想要达到目标分数时#

如果用户询问"get my brain to 90/100"或"fix what's broken"，更喜欢
单命令循环而不是手动遍历每个维度：

```bash
gbrain doctor --remediation-plan --json              # 预览什么会运行
gbrain doctor --remediate --yes --target-score 90 --max-usd 5
```

`--remediation-plan` 打印依赖有序的列表（同步在提取之前，嵌入在整合之后，等）带有每步 `est_seconds` 和 `est_usd_cost`。

`--remediate` 遍历计划，将每个步骤提交为 Minion 作业，在
每个步骤之间重新检查分数。当计划会超过上限时，`--max-usd N` 是硬性成本上限
——提交拒绝
当大脑无法达到目标分数时（空大脑没有实体
页面 → `graph_coverage` 上限在 70；未配置的嵌入密钥 → 上限在 60），
命令失败并列出缺少的内容，而不是循环。

在以下情况下使用下面的每维度遍历：
- 用户明确要求逐维度审计
- 你正在调查为什么分数卡在 `--remediate` 的天花板以下
- 特定维度需要自动路径跳过的手动判断

### 手动路径#

1. **运行健康检查。** 检查 gbrain 健康以获得仪表板。
2. **检查每个维度：**

### 过时页面#

编译真相比最新时间线条目更旧的页面。评估还没有
被更新以反映最近证据。

- 检查健康输出中的过时页面计数
- 对于每个过时页面：从 gbrain 读取页面，审查时间线，确定编译真相是否需要重写

### 孤立页面#

零入站链接的页面。没有人引用它们。

- 审查或phans：它们是真正孤立的还是只是缺少链接？
- 从相关页面添加链接或在审查后标记为删除

### 死链接#

指向不存在的页面的链接。

- 在 gbrain 中移除死链接

### 缺少交叉引用#

提及实体名称但没有正式链接的页面。

- 从 gbrain 读取编译真相，提取实体提及，在 gbrain 中创建链接

### 链接图提取#

如果 link_count 是 0 或相对于 page_count 较低，运行批量提取：

```bash
gbrain extract links --dir ~/brain
```

这扫描所有 markdown 文件以查找实体引用、参见 Also 部分和
frontmatter 字段，然后在数据库中创建类型化链接。

### 时间线提取#

如果 timeline_entry_count 是 0，从 markdown 提取结构化时间线：

```bash
gbrain extract timeline --dir ~/brain
```

### 梦想周期（v0.23）：综合 + 模式#

`gbrain dream` 运行完整的 8 阶段维护周期：

```
lint -> backlinks -> sync -> synthesize -> extract -> patterns -> embed -> orphans
```

两个新阶段将昨天的对话整合到长期记忆中：

**综合阶段：** 从 `dream.synthesize.session_corpus_dir` 读取记录，
运行廉价的 Haiku 判决（缓存在 `dream_verdicts`）以过滤常规
操作会话，然后为每个值得处理的通话分出 one Sonnet 子智能体。
每个子智能体写入反思（`wiki/personal/reflections/...`）、
原始内容（`wiki/originals/ideas/...`）和人员时间线条目。 orchestrator
从 `subagent_tool_executions` 收集 slug（不是
`pages.updated_at` —— 那会获取不相关的写入）并从 DB → markdown on disk 反向渲染
每个新页面。

**模式阶段：** 在 `extract` 之后运行（所以图状态是新鲜的）。
读取 `dream.patterns.lookback_days` 内的最近反思（默认 30），
运行单个 Sonnet 传递以浮出反复出现的主题，并在 ≥`dream.patterns.min_evidence`
时写入模式页面到 `wiki/personal/patterns/<theme>`（默认 3）个反思支持模式。

**质量栏（综合铁律）：**
1. 逐字引用用户。不要释义值得纪念的措辞。
2. 强迫性交叉引用：每个新页面必须至少有一个 wikilink。
3. Slug 纪律：仅小写字母数字和连字符。没有下划线，没有文件扩展。
4. 编辑的记录产生新的 slug（内容哈希后缀更改）—— 永远不要静默覆盖。

**信任边界（`allowed_slug_prefixes`）：** 综合子智能体使用从 `_brain-filing-rules.json` 的 `dream_synthesize_paths.glob`s 明确允许列表运行。即使在提示注入成功的情况下，子智能体
也不能在该列表之外写入。信任来自 PROTECTED_JOB_NAMES —— MCP
不能根本提交子智能体作业。编辑 JSON 是智能体可以添加
综合器可以写入的新目录的唯一方法。

**幂等性 + 隐私：** 记录通过 `(file_path, content_hash)` 键控，所以
在相同内容上重新运行是无操作的。`dream.synthesize.exclude_patterns`
（默认 `["medical", "therapy"]`）在任何 LLM 调用之前过滤记录。每个条目都是
自动包装为词边界正则表达式（例如 `medical` 匹配
"medical advice" 但 NOT "comedical"）。高级用户可以传递完整正则表达式。

**冷却：** 周期的支出上限。`dream.synthesize.cooldown_hours`（默认
12）意味着在 autopilot 下每天最多 ~2 次综合运行。完成
时间戳存储在 `dream.synthesize.last_completion_ts` 中，并且仅
在成功运行（不是跳过/失败）时写入。明确的 `--input` /
`--date` / `--from` / `--to` 调用绕过冷却。

**`--dry-run` 语义：** 运行廉价的 Haiku 显著性过滤器（缓存
判决）但跳过 Sonnet 综合传递。不是零 LLM 调用。

**在新鲜大脑上配置综合：**

```bash
gbrain config set dream.synthesize.session_corpus_dir /path/to/transcripts
gbrain config set dream.synthesize.enabled true
gbrain dream --phase synthesize --dry-run --json   # 预览
gbrain dream                                       # 完整 8 阶段周期
```

**调用模式：**

```bash
gbrain dream                                          # 完整周期
gbrain dream --phase synthesize                       # 仅综合
gbrain dream --phase patterns                         # 仅模式
gbrain dream --input ~/transcripts/2026-04-25.txt     # 临时单个记录
gbrain dream --from 2026-04-01 --to 2026-04-25        # 回填范围
gbrain dream --json                                   # CycleReport JSON
```

**Autopilot 检查：**
验证 autopilot 正在运行：

```bash
gbrain autopilot --status
```

如果未运行，请安装：

```bash
gbrain autopilot --install --repo ~/brain
```

Autopilot 在带有自适应调度的连续循环中运行同步、提取和嵌入。
在 v0.11.1+ 中，autopilot 将每个周期分派为单个 `autopilot-cycle`
Minion 作业并监督工作者子项 —— 一次安装步骤给你
同步 + 提取 + 嵌入 + 持久作业处理。

### 修复半迁移安装#

v0.11.0 安装在哪里迁移技能从未触发留下 Minions
部分设置：架构已应用，但 `~/.gbrain/preferences.json`
不存在，autopilot 内联运行，主机清单仍然引用
`agentTurn`。修复：

```bash
# 检查迁移状态
gbrain apply-migrations --list

# 应用待处理的迁移（幂等；在健康安装上安全）
gbrain apply-migrations --yes

# 如果主机特定的处理程序在 ~/.gbrain/migrations/pending-host-work.json 中被标记：
# 遍历它们按照 skills/migrations/v0.11.0.md + docs/guides/plugin-handlers.md，
# 在主机仓库中发送处理程序注册，然后重新运行 apply-migrations。
```

完整故障排除指南：`docs/guides/minions-fix.md`。

### 反向链接强制执行#

检查反向链接铁律是否正在被遵循：

- 对于每个最近更新的页面，检查其中提到的实体是否有
  来自这些实体页面的相应反向链接
- 没有反向链接的提及是损坏的大脑
- 修复：将缺少的反向链接添加到实体时间线或 See Also 部分

### 归档规则违规#

检查常见的错误归档模式（参见 `skills/_brain-filing-rules.md`）：

- 在 `sources/` 中带有清晰主要主题的内容（sources 仅用于原始数据转储）
- 使用 gbrain 搜索以查找在 `sources/` 中引用特定
  人员、公司或概念的页面 —— 这些可能归档错误
- 标记错误归档的页面以进行审查或重新归档

### 引用审计#

抽查页面以查找缺少 `[来源: ...]` 引用的内容：

- 读取 5-10 个最近更新的页面
- 检查编译真相（线以上）是否有内联引用
- 检查时间线条目是否有来源归属
- 标记事实出现而没有来源保留的页面

### 标签一致性#

不一致的标签（例如"vc" vs "venture-capital"、"ai" vs "artificial-intelligence"）。

- 使用 gbrain 标签操作标准化为最常见变体

### 图填充（v0.10.3+）#

`links` 和 `timeline_entries` 表是结构化图层和。
定期或在主要导入后填充它们：

- `gbrain extract links --source db` —— 通过遍历页面从
  引擎回填结构化链接。读取 `[姓名](people/slug)` / `[姓名](companies/slug)` 引用
  并推断关系类型（`attended`、`works_at`、`invested_in`、`founded`、
  `advises`、`mentions`、`source`）。幂等。如果你有
  markdown 检出以遍历，则使用 `--source fs --dir <brain>`。
- `gbrain extract timeline --source db` —— 回填结构化时间线条目。
  解析来自页面内容的 `- **YYYY-MM-DD** | 摘要` 行。幂等（DB
  唯一约束）。
- `gbrain extract all --source db` —— 在一次运行中同时运行两者。

验证填充：

- `gbrain graph-query <slug> --depth 2` —— 验证连接性（使用任何知名
  实体 slug 作为探测）。
- `gbrain stats` —— 在提取后验证 `link_count > 0` 和 `timeline_entry_count > 0`。
- `gbrain health` —— 审查 `link_coverage` 和 `timeline_coverage` 百分比
  在实体页面（人员/公司）上。低于 50% 意味着需要更多提取。

可用链接类型（与 `gbrain graph-query --type` 一起使用）：
`attended`、`works_at`、`invested_in`、`founded`、`advises`、`mentions`、`source`。

向前发展，每次 `gbrain put` 调用都会在
auto-link 后钩子上自动创建并对账链接（默认开启；通过 `gbrain config set auto_link false` 禁用）。
所以链接提取大多是一次性回填。时间线提取应该在
批量导入或添加新日期条目的内容编辑后重新运行。

### 嵌入新鲜度#

没有嵌入或带有旧模型的嵌入的块。

- 对于大型嵌入刷新（>1000 个块），使用 nohup：
  `nohup gbrain embed refresh > /tmp/gbrain-embed.log 2>&1 &`
- 然后检查进度：`tail -1 /tmp/gbrain-embed.log`

### 安全（RLS 验证）#

运行 `gbrain doctor --json` 并检查 RLS 状态。
所有表都应该显示 RLS 已启用。如果没有，请重新运行 `gbrain init`。

### 架构健康#

检查架构版本是否最新。`gbrain doctor --json` 报告
当前版本 vs 预期。如果落后，`gbrain init` 自动运行迁移。

### 文件存储健康#

检查存储文件和重定向指针的完整性：

- 运行 `gbrain files verify` 以检查所有 DB 记录是否有有效数据
- 运行 `gbrain files status` 以查看迁移状态（本地、镜像、重定向）
- 检查是否有引用缺少存储文件的 `.redirect.yaml` 指针
- 检查是否有应该存储在云存储中但仍留在 git 中的大型二进制文件（>= 100 MB）
- 如果配置了存储后端：验证重定向指针解析（下载测试）

### 开放线程#

带有 30 天以上未解决行动项目的超过 30 天的时间线条目。

- 标记以进行审查

## 基准测试#

定期验证搜索质量没有回归。运行跨越难度层的
测试查询电池：

- **层 1（实体查找）：** 已知姓名 —— 应该始终解析
- **层 2（主题召回）：** 概念、主题 —— 关键词搜索应该处理
- **层 3（语义）：** 没有精确关键词匹配的查询 —— 需要嵌入
- **层 4（跨域）：** 关系/连接查询 —— 仅语义处理

比较来自 `gbrain search`（关键词）vs `gbrain query`（混合）的结果。

质量比速度更重要（2.5 秒正确 > 200 毫秒错误）。

何时运行基准：
- 在主要大脑导入或重新导入后
- 在 gbrain 版本升级后
- 在嵌入重新生成后
- 每月跟踪质量漂移

## 心跳集成#

对于按计划运行的生产智能体，将 gbrain 健康检查集成到
你的操作心跳中。

### 在每个心跳上（每小时或每会话）#

运行 `gbrain doctor --json` 并检查降级。向
用户报告任何失败的检查。关键信号：连接健康、架构版本、RLS 状态、嵌入
过时性。

### 每周维护#

运行 `gbrain embed --stale` 以刷新自
它们上次嵌入以来已更改的页面的嵌入。对于大型大脑（>5000 个页面），使用 nohup 运行此操作：

```bash
nohup gbrain embed --stale > /tmp/gbrain-embed.log 2>&1 &
```

### 每日验证#

验证同步正在运行：检查 `gbrain stats` 并确认 `last_sync` 在
最后 24 小时内。如果同步已停止，大脑正在从仓库漂移。

### 过时编译真相检测#

标记编译真相 >30 天旧但时间线有最近条目的页面。

这意味着存在尚未被综合的新证据。这些页面需要
编译真相重写（参见上面的维护工作流）。

## 报告存储#

维护运行后，保存报告：

- 处理的实体数
- 新建的页面 vs 现有更新
- 调用的数据源和结果质量
- 显著发现或矛盾
- 验证标志或 API 失败

这为随时间的大脑健康创建了审计线索。

## 质量规则#

- 连接计数 < 20 在 LinkedIn 上 = 可能是错误的人，跳过
- 大脑和 API 之间的姓名不匹配 = 跳过，标记以进行审查
- 玩笑资料或明显错误的数据 = 保存到原始数据，不要更新页面
- 不要用 API 样板覆盖用户撰写的评估
- 有疑问时：保存原始数据但不要更新大脑页面

## 反模式#

- 在没有首先读取它们的情况下修复页面
- 静默跳过维度 —— 必须检查并报告每个维度，即使干净
- 在没有首先检查是否应该链接的情况下删除孤立页面
- 在高峰使用时间期间运行嵌入刷新
- 批量修复反向链接而不验证关系是否真实
- 将维度标记为"干净"而没有实际查询它
- 在没有首先读取完整时间线的情况下重写编译真相
- 移除标签而不检查其他页面是否一致使用相同的标签

## 输出格式#

维护报告遵循此结构：

```
大脑健康报告 — YYYY-MM-DD
=========================

| 维度           | 发现的问题 | 已修复 | 剩余 |
|----------------------|-------------|-------|-----------|
| 过时页面          | N           | N     | N         |
| 孤立页面         | N           | N     | N         |
| 死链接           | N           | N     | N         |
| 缺少交叉引用   | N           | N     | N         |
| 反向链接违规 | N           | N     | N         |
| 引用差距        | N           | N     | N         |
| 归档违规    | N           | N     | N         |
| 标签不一致  | N           | N     | N         |
| 嵌入过时性  | N           | N     | N         |
| 安全（RLS）       | N           | N     | N         |
| 架构健康        | N           | N     | N         |
| 文件存储         | N           | N     | N         |
| 开放线程         | N           | N     | N         |

### 详情 #

[每个维度的细分，带有具体页面和采取的措施]

### 基准结果（如果运行）#

[层 1-4 查询结果，带有通过/失败]

### 突出问题 #

[需要用户注意或确认的项目]
```

## 工具使用#

- 检查 gbrain 健康（get_health）
- 按过滤器在 gbrain 中列出页面（list_pages）
- 从 gbrain 读取页面（get_page）
- 在 gbrain 中交叉引用页面（add_link）
- 在 gbrain 中检查反向链接（get_backlinks）
- 从 gbrain 读取时间线（get_timeline）
- 在 gbrain 中添加时间线条目（add_timeline_entry）
- 在 gbrain 中写入页面（put_page）
- 在 gbrain 中移除链接（remove_link）
- 在 gbrain 中标记页面（add_tag）
- 在 gbrain 中移除标签（remove_tag）
