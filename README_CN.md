# GBrain

你的 AI 智能体很聪明但很健忘。GBrain 为它提供一个大脑。

由 Y Combinator 总裁兼首席执行官开发，用于运行他的实际 AI 智能体。他的 OpenClaw 和 Hermes 部署背后的生产级大脑：**17,888 个页面，4,383 人，723 家公司**，21 个自主运行的定时任务，12 天内构建完成。智能体在你睡觉时摄取会议、电子邮件、推文、语音通话和原始想法。它丰富它遇到的每个人和公司的信息。它在夜间自动修复引用并整合记忆。你醒来时比睡觉时更聪明。

大脑自动连接自己。每次页面写入都会提取实体引用并创建类型化链接（`attended`、`works_at`、`invested_in`、`founded`、`advises`），无需调用 LLM。混合搜索。自连接知识图谱。结构化时间线。反向链接增强排名。询问"谁在 Acme AI 工作？"或"Bob 这个季度投资了什么？"，获得仅靠向量搜索无法触及的答案。并肩基准测试：gbrain 在 240 页 Opus 生成的富文本语料库上获得 **P@5 49.1%，R@5 97.9%**，比禁用图谱的变体高出 **+31.4 个百分点 P@5**，比 ripgrep-BM25 + 仅向量的 RAG 也有类似优势。完整的 BrainBench 记分卡在兄弟仓库 [gbrain-evals](https://github.com/garrytan/gbrain-evals) 中。

**v0.36.2.0 中的新默认设置：ZeroEntropy**，用于嵌入（`zembed-1`，1280 维，通过 Matryoshka）和重排序器（`zerank-2`）。在真实语料库基准测试中对比 OpenAI 和 Voyage：**快 2.2 倍**（442ms vs OpenAI 973ms），**常规定价便宜 2.6 倍**（$0.05/百万 vs OpenAI $0.13），在 20 个查询中有 11 个头对头获胜，用作第二遍重排序器时重新排序 60% 的 top-1 结果。从 [zeroentropy.dev](https://dashboard.zeroentropy.dev) 获取你自己的密钥，或通过 `gbrain config set embedding_model <provider:model>` 继续使用 OpenAI/Voyage——你的选择是持久的。

GBrain 是这些模式的通用化。30 分钟完成安装。你的智能体完成工作。随着 Garry 的个人智能体变得更聪明，你的也是。

**v0.36.4.0 新功能 — 你的智能体自动将大脑驱动到 90/100 分。** 一个命令完成你以前手动运行的循环：`gbrain doctor --remediate --yes --target-score 90 --max-usd 5`。它计算依赖有序的计划（在提取之前同步，在整合之后嵌入），将每个步骤提交为 Minion 作业，在每个步骤之间重新检查分数，并拒绝超出成本上限的花费。定时任务可以无人值守地驱动它。`gbrain doctor --remediation-plan --json` 预览将运行什么。Autopilot 现在在 5 分钟滴答上做同样的事情：小问题获得针对性处理程序，大问题获得完整周期，健康的大脑休眠 60 分钟，而不是在每个滴答上研磨 synthesize+patterns+embed。你可以作为后台作业提交的 11 个新功能（`reindex`、`repair-jsonb`、`orphans`、`integrity`、`purge`，加上六个周期阶段）；其中三个（synthesize、patterns、consolidate）是 PROTECTED，因此 MCP 连接的智能体无法静默消耗 Anthropic 积分。`gbrain embed` 上的新 `--background` 标志提交作业并以 `job_id=N` 退出，用于 shell 组合。

**v0.35.7 新功能 — 时间轨迹 + 创始人记分卡。** 在 `## Facts` 围栏中授权类型化指标断言（`mrr=50000`、`arr=2000000`、`team_size=12`），gbrain 将它们存储为一等类型化列。`gbrain eval trajectory companies/acme-example` 打印时间历史，内联自动标记回归。`gbrain founder scorecard companies/acme-example` 将声明准确性、一致性、增长方向和危险标志汇总为稳定的 `schema_version: 1` JSON 合约。新的 MCP 操作 `find_trajectory` 向智能体公开相同的数据（读取范围，对远程调用者进行可见性过滤）。`consolidate` 周期阶段现在在按时间顺序被取代的事实上写入 `valid_until`，并在 `(page_id, claim, since_date)` 上使用语义 upsert——在稳定输入上重新运行梦想周期现在是一个真正的无操作（修复了先前版本中预先存在的重复问题 bug）。

> **约 30 分钟获得完全工作的大脑。** 数据库在 2 秒内准备就绪（PGLite，无服务器）。你只需回答有关 API 密钥的问题。

> **LLM：** 获取 [`llms.txt`](llms.txt) 获取文档地图，或获取 [`llms-full.txt`](llms-full.txt) 获取在一次函数调用中内联核心文档的相同地图。**智能体：** 从 [`AGENTS.md`](AGENTS.md) 开始（如果你使用的是 Claude Code，则从 [`CLAUDE.md`](CLAUDE.md) 开始）。

## 安装

GBrain 以三种形式运行。选择与你今天使用 AI 智能体的方式匹配的一种。

### 与你的智能体平台一起运行

已经在使用 [OpenClaw](https://github.com/garrytan/openclaw) 或 [Hermes](https://github.com/garrytan/hermes)？GBrain 作为技能包脚手架安装到你的智能体工作区中。

```bash
gbrain init --pglite
gbrain skillpack scaffold --all   # 或：每个技能 scaffold <name>
```

就这样。你的智能体获得 43 个技能（信号检测、大脑操作、摄取、丰富、引用修复、每日任务管理器、定时任务调度器、评估框架，以及 35 个更多）。路由位于 `skills/RESOLVER.md`——智能体每个请求读取一次，选择正确的技能，执行。脚手架技能是你智能体仓库的一等成员——你拥有它们，自由编辑；当你想拉取上游改进时，`gbrain skillpack reference <name>` 将你的副本与 gbrain 的包进行比较。（传统的 `gbrain skillpack install` 托管块模型在 v0.36.0.0 中退役；如果你从旧版本升级，运行一次 `gbrain skillpack migrate-fence`。）

### CLI 独立版

从任何 shell 使用 gbrain，无需智能体平台。

```bash
bun install -g github:garrytan/gbrain
gbrain init --pglite   # 2 秒；无服务器，无 Docker
gbrain doctor          # 验证健康状况
```

然后将任何支持 MCP 的客户端（Claude Code、Cursor、Windsurf）指向它，或从你的 shell 使用它：

```bash
gbrain search "谁在 acme AI 工作？"
gbrain query "Bob 这个季度投资了什么？"
gbrain graph-query people/garry-tan --depth 2
```

详细的设置路径（大规模 Postgres、Supabase、瘦客户端模式）位于 [`docs/INSTALL.md`](docs/INSTALL.md)。

### MCP 服务器（任何 MCP 客户端）

```bash
gbrain serve              # stdio MCP（Claude Desktop / Code / Cursor）
gbrain serve --http       # HTTP MCP，带有 OAuth 2.1 + 管理仪表板
                          # 位于 /admin，SSE 活动源位于 /admin/events
```

每个客户端的指南（Claude Desktop、Code、Cursor、ChatGPT、Perplexity、Cowork）位于 [`docs/mcp/`](docs/mcp/)。HTTP 服务器支持 DCR 风格的客户端注册、范围门控访问（`read`/`write`/`admin`）和内置速率限制。

## 它做什么（循环）

```
  信号   →   搜索   →   响应   →   写入   →   自动链接   →   同步
  （每    （大脑优先  （由上下文   （页面 +    （类型化边     （定时任务
  条消息）  检索）     告知）     时间线）   + 反向链接）     保持新鲜）
```

- **信号检测器** 在你的智能体收到的每条消息上运行。捕获想法、实体提及、时间敏感的待办事项、姓名、链接。
- **大脑优先查找** 在任何外部 API 调用之前。你拥有的最便宜、最快、最个性化的信息源。
- **自动链接** 在每次页面写入时触发。无 LLM 调用；对 `[[wiki/people/bob]]` 样式引用进行纯模式匹配。新实体 → 新页面存根 → 图谱增长。
- **定时驱动丰富** 在你睡觉时运行：去重人员页面、修复引用、评分显著性、发现矛盾、准备明天的任务。

整个循环在 [`docs/architecture/topologies.md`](docs/architecture/topologies.md) 中通过图表描述。

## 功能

**混合搜索。** 向量（pgvector 上的 HNSW）+ BM25 关键词 + 倒数排名融合 + 源层提升 + 意图感知查询重写。三个命名搜索模式（`conservative`、`balanced`、`tokenmax`）将成本/质量旋钮捆绑到单个配置键中。实时成本/召回比较在 [`docs/eval/SEARCH_MODE_METHODOLOGY.md`](docs/eval/SEARCH_MODE_METHODOLOGY.md)。默认：`balanced`，启用 ZeroEntropy 重排序器。

**自连接知识图谱。** 每次 `put_page` 都会从 markdown/wikilinks/类型化链接语法中提取实体引用，并无需 LLM 调用即可写入边。类型化边（`attended`、`works_at`、`invested_in`、`founded`、`advises`、`mentions`……）。通过 `gbrain graph-query` 进行多跳遍历。图谱正是产生超过仅向量 RAG 的 +31.4 P@5 提升的原因。

**作业队列（Minions）。** BullMQ 形状、Postgres 原生的作业队列。持久的智能体（通过两阶段 pending→done 持久性在崩溃中生存的 LLM 工具循环）、带审计的 shell 作业、具有级联超时的子作业、用于出站提供商的速率租约、通过 S3/Supabase 存储的附件。用可以从任何事情中恢复的东西替换"生成子智能体作为即发即忘 Promise"。

**43 个精选技能。** 路由位于 [`skills/RESOLVER.md`](skills/RESOLVER.md)。涵盖信号捕获、摄取（想法/媒体/会议）、丰富、查询、大脑操作、引用修复、每日任务管理、定时任务调度、报告、语音、灵魂审计、技能创建、评估框架和迁移。技能是 markdown 文件（工具不可知），打包为安装程序放入你的智能体工作区的单个技能包。

**评估框架。** `gbrain eval longmemeval` 针对你的混合检索运行公共 [LongMemEval](https://huggingface.co/datasets/xiaowu0162/longmemeval) 基准测试。`gbrain eval export` + `gbrain eval replay` 捕获真实查询并根据代码更改重放它们（设置 `GBRAIN_CONTRIBUTOR_MODE=1`）。`gbrain eval cross-modal` 使用三个不同提供商的前沿模型根据任务交叉检查输出。完整方法在 [`docs/eval/SEARCH_MODE_METHODOLOGY.md`](docs/eval/SEARCH_MODE_METHODOLOGY.md)。

**大脑一致性。** `gbrain eval suspected-contradictions` 对检索对进行采样、分层日期预过滤、查询条件 LLM 判断、持久缓存。显示智能体写入的 takes + 事实之间的矛盾。连接到每日梦想周期。

## 集成

流入大脑的数据。每个集成都是一个配方——markdown + 设置提示——在 `recipes/` 中发布，可通过 `gbrain integrations list` 发现。

- **语音**：通过 Twilio + OpenAI Realtime（或 DIY STT+LLM+TTS）创建大脑页面的电话。设置配方：[`recipes/twilio-voice-brain.md`](recipes/twilio-voice-brain.md)。
- **电子邮件 + 日历**：路由到大脑信号的 webhook 处理程序。[`docs/integrations/meeting-webhooks.md`](docs/integrations/meeting-webhooks.md)。
- **嵌入提供商**：涵盖 OpenAI（默认回退）、Voyage、ZeroEntropy（默认）、Google Gemini、Azure OpenAI、MiniMax、Alibaba DashScope、Zhipu、Ollama（本地）、llama.cpp llama-server（本地）、LiteLLM 代理的 14 个配方。定价矩阵 + 决策树在 [`docs/integrations/embedding-providers.md`](docs/integrations/embedding-providers.md)。
- **凭证网关**：支持 vault 的密钥分发。[`docs/integrations/credential-gateway.md`](docs/integrations/credential-gateway.md)。
- **MCP 客户端**：支持每个主要的 MCP 客户端。[`docs/mcp/`](docs/mcp/) 每个客户端的设置。

## 架构

**两个引擎，一个合约。** PGLite（通过 WASM 的 Postgres 17，零配置，默认）用于多达约 50K 页面的个人大脑。Postgres + pgvector（Supabase 或自托管）用于共享/大型/多机器部署。[`src/core/engine.ts`](src/core/engine.ts) 中的合约优先 `BrainEngine` 接口定义了两个引擎都实现的约 47 个操作；CLI 和 MCP 服务器从一个源生成。

**大脑仓库是记录系统。** 你的知识作为 markdown 文件存在于常规 git 仓库（你的"大脑仓库"）中。GBrain 将仓库同步到 Postgres 以进行检索；git 中的删除成为数据库中的软删除。你可以发布公共子集、共享团队挂载、运行指向同事大脑服务器的瘦客户端设置。拓扑在 [`docs/architecture/topologies.md`](docs/architecture/topologies.md)。

**两个组织轴（brain ⊥ source）。** *brain* 是一个数据库（你的个人大脑、你加入的团队挂载）。*source* 是该大脑内的一个仓库（wiki、gstack、文章、知识库）。路由位于 `.gbrain-source` 点文件中，并通过文档化的 6 层优先级链解析。完整图表在 [`docs/architecture/brains-and-sources.md`](docs/architecture/brains-and-sources.md)。

**为什么图谱很重要。** 向量搜索返回语义上接近的块。图谱返回事实上连接的块。混合搜索从两者中提取；每次写入时的自动链接保持图谱新鲜。深入探讨：[`docs/architecture/RETRIEVAL.md`](docs/architecture/RETRIEVAL.md)。

## 文档

- [`docs/INSTALL.md`](docs/INSTALL.md) — 每个安装路径，端到端
- [`docs/architecture/`](docs/architecture/) — 系统设计、拓扑、检索理论
- [`docs/guides/`](docs/guides/) — 操作指南（子智能体路由、minion 部署、技能开发、大脑优先查找、想法捕获、尽职调查摄取）
- [`docs/integrations/`](docs/integrations/) — 连接外部数据源（语音、电子邮件、日历、嵌入提供商）
- [`docs/mcp/`](docs/mcp/) — 每个客户端的 MCP 设置（Claude Desktop、Code、Cursor、ChatGPT、Perplexity、Cowork）
- [`docs/eval/`](docs/eval/) — 评估框架、指标词汇表、方法
- [`docs/ethos/`](docs/ethos/) — 哲学（薄工具、胖技能、markdown 作为配方、起源故事）
- [`AGENTS.md`](AGENTS.md) — 非 Claude 智能体的入口点
- [`CLAUDE.md`](CLAUDE.md) — Claude Code 的入口点（深度操作上下文）
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — 贡献者指南、测试规范、评估捕获模式
- [`SECURITY.md`](SECURITY.md) — OAuth 威胁模型、加固默认值

## 贡献

运行 `bun run test` 进行快速循环，运行 `bun run verify` 进行推送前门控，运行 `bun run ci:local` 在本地运行完整的 Docker 支持的 CI 堆栈。详细的测试规范在 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

社区 PR 被批处理到发布波中，而不是逐个合并——请参阅 [`CLAUDE.md`](CLAUDE.md) 中的"PR wave workflow"部分。贡献者归属通过 `Co-Authored-By:` 预告片保持附加。我们在 [`CHANGELOG.md`](CHANGELOG.md) 中 crediting 每个接受的贡献。

如果你发现 bug 或想要功能：首先打开 issue。快速修复（错别字、文档 bug、明显回归）可以直接转到 PR。任何触及架构、检索排名、MCP 协议或安全边界的内容都需要首先在 issue 中进行设计讨论。

## 许可证 + 致谢

MIT。由 Garry Tan 构建，用于运行他的 OpenClaw 和 Hermes 部署——他的实际 AI 智能体背后的生产级大脑。

起源故事：[`docs/ethos/ORIGIN.md`](docs/ethos/ORIGIN.md)。

社区 PR 贡献者在每个发布的 `CHANGELOG.md` 中获得信用。ZeroEntropy（[@zeroentropy](https://zeroentropy.dev)）用于成为 v0.36.2.0 默认的嵌入 + 重排序器堆栈。Voyage AI 用于非对称编码配方模板。Ramp Labs 用于搜索质量改进谱系。
