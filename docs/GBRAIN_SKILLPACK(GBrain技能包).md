<!-- skillpack-version: 0.7.0 -->
<!-- source: https://raw.githubusercontent.com/garrytan/gbrain/master/docs/GBRAIN_SKILLPACK.md -->
# GBrain 技能包：AI 代理参考架构

这是生产级 AI 代理如何使用 gbrain 作为知识主干的参考架构。基于真实部署的模式，包含 14,700+ 大脑文件、40+ 技能和 20+ 持续运行的定时任务。

**Memex 愿景的实现。** Vannevar Bush 设想了一个设备，个人可以存储一切，并通过超高速进行查阅。GBrain 就是那个设备，只不过 memex 会自我构建。代理检测实体、丰富页面、创建交叉引用，并自动维护编译真相。

下面每个部分都是一个独立的指南。点击进入完整内容。

---

## 核心模式

基础读写循环和数据模型。

| 指南 | 涵盖内容 |
|-------|---------------|
| [大脑-代理循环](guides/brain-agent-loop.md) | 随时间推移使大脑复合的读写周期 |
| [实体检测](guides/entity-detection.md) | 在每条消息上运行。捕获原创思考 + 实体提及 |
| [原始文件夹](guides/originals-folder.md) | 捕获你的思考，而不仅仅是发现的内容 |
| [大脑优先查找](guides/brain-first-lookup.md) | 在调用任何外部 API 之前先检查大脑 |
| [编译真相 + 时间线](guides/compiled-truth.md) | 线上：当前综合。线下：仅追加证据 |
| [来源归属](guides/source-attribution.md) | 每个事实都需要引用。格式和层次结构 |

## 数据管道

获取数据并保持最新。

| 指南 | 涵盖内容 |
|-------|---------------|
| [丰富管道](guides/enrichment-pipeline.md) | 7 步协议，分级系统（根据重要性分为 1/2/3 级） |
| [会议摄取](guides/meeting-ingestion.md) | 始终拉取完整转录稿，传播到所有实体页面 |
| [内容与媒体摄取](guides/content-media.md) | YouTube、社交媒体包、PDF/文档 |
| [尽职调查摄取](guides/diligence-ingestion.md) | 数据室材料：推介文档、财务模型、股权表 |
| [确定性收集器](guides/deterministic-collectors.md) | 数据用代码，判断用 LLM。收集器模式 |
| [想法捕获 & 原始内容](guides/idea-capture.md) | 深度测试、原创性分布、深度交叉链接 |
| [获取数据入口](integrations/README.md) | 集成配方：语音、电子邮件、X、日历 |

## 运维

运行生产级大脑。

| 指南 | 涵盖内容 |
|-------|---------------|
| [参考定时任务计划](guides/cron-schedule.md) | 20+ 重复任务、安静时间、梦境周期 |
| [通过 Minions 的定时任务](../skills/conventions/cron-via-minions.md) | 为什么计划任务作为 Minion 作业运行，而不是 `agentTurn`。v0.11.0 迁移自动应用于内置处理程序；主机特定处理程序使用下面的插件契约。 |
| [插件处理程序](guides/plugin-handlers.md) | 通过代码注册主机特定的 Minion 处理程序（无数据文件执行表面）。 |
| [Minions 修复](guides/minions-fix.md) | 修复半迁移的 v0.11.0 安装。 |
| [Shell 作业 (v0.14.0+)](guides/minions-shell-jobs.md) | 将确定性定时任务（API 获取、令牌刷新、抓取+写入）从 LLM 网关移开。每次触发零令牌，~60% 网关余量。遵循 `skills/migrations/v0.14.0.md` 获取采用手册。 |
| [安静时间与时区](guides/quiet-hours.md) | 睡眠期间暂停通知，感知时区的传递 |
| [执行助理模式](guides/executive-assistant.md) | 电子邮件分类、会议准备、日程安排 |
| [运维规范](guides/operational-disciplines.md) | 信号检测、大脑优先、写入后同步、心跳、梦境周期 |
| [技能开发周期](guides/skill-development.md) | 5 步周期：概念、原型、评估、编撰、定时任务 |

**子代理路由 (v0.11.0+)：** 调度后台工作的代理应通过 `skills/conventions/subagent-routing.md` 路由 —— 它读取 `~/.gbrain/preferences.json#minion_mode` 并在原生子代理和 Minion 作业之间分支。v0.11.0 迁移自动注入指向此约定的标记到 AGENTS.md。

**定时任务路由 (v0.11.0+)：** 计划工作通过 Minions 进行，而不是 OpenClaw 的 `agentTurn`。有关重写模式，请参见 `skills/conventions/cron-via-minions.md`。v0.11.0 迁移自动重写处理程序是 gbrain 内置的条目；主机特定处理程序（例如 `ea-inbox-sweep`）需要按照 `docs/guides/plugin-handlers.md` 进行代码级注册。

## 架构

如何构建你的系统。

| 指南 | 涵盖内容 |
|-------|---------------|
| [双仓库架构](guides/repo-architecture.md) | 代理仓库 vs 大脑仓库、边界规则、决策树 |
| [子代理模型路由](guides/sub-agent-routing.md) | 哪个任务用哪个模型、信号检测器模式、成本优化 |
| [三种搜索模式](guides/search-modes.md) | 关键词、混合、直接。何时使用每种 |
| [大脑 vs 代理记忆](guides/brain-vs-memory.md) | 3 层：GBrain（世界知识）、代理记忆、会话 |

## 集成

连接你的生活。

| 指南 | 涵盖内容 |
|-------|---------------|
| [凭证网关](integrations/credential-gateway.md) | ClawVisor / Hermes 用于 Gmail、日历、联系人 |
| [会议 & 通话 Webhook](integrations/meeting-webhooks.md) | Circleback 转录稿 + Quo/OpenPhone 短信/通话 |
| [语音到大脑](../recipes/twilio-voice-brain.md) | 电话通话 + WebRTC 浏览器通话创建大脑页面。25 个生产模式：身份分离、竞标系统、对话时机、主动顾问、提示压缩、呼叫者路由、动态 VAD、实时日志记录、双重保障通话后 |
| [电子邮件到大脑](../recipes/email-to-brain.md) | Gmail 消息通过确定性收集器流入实体页面 |
| [X 到大脑](../recipes/x-to-brain.md) | Twitter 监控，带删除检测和互动速度 |
| [日历到大脑](../recipes/calendar-to-brain.md) | Google 日历事件变为可搜索的每日大脑页面 |
| [会议同步](../recipes/meeting-sync.md) | Circleback 转录稿自动导入并传播给参会者 |

## 管理

保持运行并更新。

| 指南 | 涵盖内容 |
|-------|---------------|
| [升级 & 自动更新](guides/upgrades-auto-update.md) | 检查更新、代理通知、迁移文件 |
| [实时同步](guides/live-sync.md) | 保持索引最新：定时任务、--watch、webhook 方法 |

## 入门

设置后，大脑是空的。冷启动技能按顺序调用最高杠杆的数据源来填充它：

| 指南 | 涵盖内容 |
|-------|---------------|
| [冷启动](../skills/cold-start/SKILL.md) | 第一天引导：联系人、日历、电子邮件、对话、社交媒体、存档。使用 ClawVisor 进行安全凭证处理 —— 代理永远不持有原始 API 密钥。 |
| [询问用户](../skills/ask-user/SKILL.md) | 决策点的人类输入选择门模式。被冷启动和其他技能使用。 |

---

## 附录：GBrain CLI 快速参考

| 命令 | 用途 |
|---------|---------|
| `gbrain search "term"` | 跨所有大脑页面进行关键词搜索 |
| `gbrain query "question"` | 混合搜索（向量 + 关键词 + RRF） |
| `gbrain get <slug>` | 通过 slug 读取特定大脑页面 |
| `gbrain sync` | 将本地 markdown 仓库同步到 gbrain 索引 |
| `gbrain import <path>` | 将文件导入大脑 |
| `gbrain embed --stale` | 重新嵌入具有陈旧或缺失嵌入的页面 |
| `gbrain integrations` | 管理集成配方（感知 + 反射） |
| `gbrain stats` | 显示大脑统计信息（页面计数、上次同步等） |
| `gbrain doctor` | 诊断大脑健康问题 |
| `gbrain check-update` | 检查新版本和集成配方 |

运行 `gbrain --help` 获取完整命令参考。

---

## 架构 & 哲学

- [基础设施层](architecture/infra-layer.md) — 导入管道、分块、嵌入、搜索
- [薄外壳，胖技能](ethos/THIN_HARNESS_FAT_SKILLS.md) — 架构哲学
- [Markdown 技能即配方](ethos/MARKDOWN_SKILLS_AS_RECIPES.md) — 为什么 markdown 是代码，而你的代理是包管理器
- [个人 AI 的 Homebrew](designs/HOMEBREW_FOR_PERSONAL_AI.md) — 10 星愿景
- [推荐模式](GBRAIN_RECOMMENDED_SCHEMA.md) — 你的大脑仓库的目录结构
- [验证运行手册](GBRAIN_VERIFY.md) — 端到端安装验证
