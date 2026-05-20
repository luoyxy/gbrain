# 记录系统

**GitHub 仓库（markdown + frontmatter）是记录系统。**
**Postgres/PGLite 数据库是派生缓存。我们不对数据库进行备份 —— 我们从仓库重建它。**

本文档是该契约的权威参考。每条写入用户知识状态的代码路径都应匹配此处描述的模式。`scripts/check-system-of-record.sh` 中的 CI 门通过编程方式强制执行它。

## 为什么这很重要

数据库是 markdown 内容上的派生索引。它的存在是为了使搜索快速、去重嵌入相似的声明、实现跨页图谱。这些数据都不是不可替换的 —— 只要 markdown 完整，`gbrain sync && gbrain extract all` 就会从头重建整个数据库。

这意味着：

- **灾难恢复是一个命令。** 如果你的数据库卷损坏，如果 Postgres 吞噬自身，如果 PGLite 的 WASM 锁卡住 —— 你不需要备份。你擦除数据库，从你的大脑仓库重新导入，派生状态重新生成。v0.32.3 发布 `gbrain rebuild --confirm-destructive` 作为文档化的单行命令。
- **多机器同步是 git。** 你的大脑是一个仓库。从一台机器推送，从另一台机器拉取，第二台机器的数据库在下次同步时重建。没有"备份数据库"步骤。
- **隐私掌握在你手中。** 敏感实体页面可以被 git 忽略（通过 `gbrain.yml` 的 `db_only` 路径或每页），它们保留在磁盘上但不在 git 中。围栏尊重你在页面级别所做的任何 git 跟踪选择。
- **跨代理协作是可能的。** 多个代理可以写入同一个大脑，因为围栏是合并点，而非数据库。Git 处理并发编辑的方式与 git 处理并发编辑的方式相同。

## 三个类别

gbrain schema 中的每个表都属于三个类别之一。该类别决定了在灾难恢复期间如何重建它。

### FS 权威（markdown 是真相来源）

这些是你创作的知识。数据库行是 markdown 上的派生索引 —— 擦除表并且 `gbrain extract` 会相同地重建它。CI 门防止直接数据库写入偏离 markdown 契约。

| 类别 | 如何在 markdown 中存储 | 派生数据库表 | 协调器 |
|---|---|---|---|
| **Takes**（包括 hunches、bets） | `## Takes` 在 `<!--- gbrain:takes:begin -->` / `:end -->` 标记之间的围栏表 | `takes` | `extract takes` |
| **Facts** | `## Facts` 在 `<!--- gbrain:facts:begin -->` / `:end -->` 标记之间的围栏表 | `facts` | `extract_facts` 循环阶段 |
| **Links** | 内联 `[text](slug)` / `[[slug]]` 在 markdown 正文中 + frontmatter `direction: incoming` | `links` | `extract links` |
| **Timeline** | `<!-- timeline -->` 哨兵后的 `## Timeline` 部分 | `timeline_entries` | `extract timeline` |
| **Tags** | Frontmatter `tags:` YAML 数组 | `tags` | `importFromFile`（在导入时每页协调） |
| **emotional_weight** | 从 takes + tags 重新计算 | `pages.emotional_weight`（信号列） | `recompute_emotional_weight` 循环阶段 |
| **synthesis_evidence** | 合成页面内 `takes` 行的 FK（`slug#N`） | `synthesis_evidence` | `extract takes`（传递地） |

### 从 FS 派生但非用户创作

这些持有派生状态，可从 markdown 自动重建，但用户不直接创作为 markdown。分块器 + 嵌入器在导入时重建这些。

| 表 | 来源 | 备注 |
|---|---|---|
| `pages` | markdown 文件整体 | 每个文件一行；`compiled_truth` + `frontmatter` 来自解析 |
| `content_chunks` | `pages.compiled_truth` 在分块器剥离后 | 在 content_hash 更改时重新分块；通过配置的模型嵌入 |
| `page_versions` | 每个 `pages` UPDATE | 审计历史；原则上可重建但在实践中不可 |
| `brain_cycles` / `brain_cycle_*` | 循环编排器 | 运行时状态；从页面 + takes 重建 |

### 设计上仅 DB（命名例外）

这些持有运行时/基础设施状态，故意不在仓库中。架构规则仍然适用 —— 这些不是"用户知识" —— 但它们在设计上是仅 DB 的。

| 类别 | 为什么可以是仅 DB |
|---|---|
| `raw_data` | Webhook/转录侧车；非用户创作的知识。 |
| `subagent_messages` / `subagent_tool_executions` / `subagent_rate_leases` | 运行时作业状态。仅重放，非持久知识。 |
| `oauth_clients` / `oauth_tokens` / `access_tokens` | 凭证。根据定义不在源代码控制中。 |
| `mcp_request_log` | 审计跟踪。设计上易失。 |
| `minion_jobs` / `minion_inbox` / `minion_attachments` | 作业队列。重启重新入队或丢弃。 |
| `eval_candidates` / `eval_capture_failures` | 贡献者模式开发循环；选择加入捕获。 |
| `dream_verdicts` | 廉价裁决缓存。通过重新运行 Haiku 可重建。 |
| `gbrain_cycle_locks` / 迁移分类账 | 基础设施。 |
| `config`（某些键） | 站点本地路由配置（例如 `sync.repo_path`）。 |

持有用户知识的新派生表必须落地 FS 优先。如果你 tempted 将其添加为"暂时仅 DB"，结构性问题是：它是否属于此设计上仅 DB 的列表？如果不是，它是 FS 权威的，需要围栏（或 frontmatter 字段）加上协调器。

## 隐私边界

围栏中的私有知识仍然存在于 markdown 文件中。如果用户将页面提交到 git，私有数据也会进入 git。这是现有的操作模型 —— 我们不推断 git 策略。

对于不受信任的读取者（远程 MCP、子代理），v0.32.2 版本发布 3 层剥离：

1. **层 A（分块器）：** `src/core/chunkers/recursive.ts` 在分块之前调用 `stripFactsFence({keepVisibility: ['world']})` + `stripTakesFence`。私有事实文本永远不会到达 `content_chunks.chunk_text`、嵌入或搜索结果。
2. **层 B（get_page）：** 当 `ctx.remote === true` 时，响应正文两个围栏都被剥离（来自 facts 的私有行；整个 takes 围栏）。本地 CLI（`ctx.remote === false`）看到完整的围栏。
3. **层 C（git 跟踪）：** 用户决定是否提交实体页面。`gbrain.yml` 的 `db_only` 路径被自动 git 忽略；每页选择通过用户的正常 git 工作流。

对于普遍私有的实体（朋友的名字、投资者的内部笔记），将实体页面的目录标记为 `gbrain.yml` 中的 `db_only`。文件保留在磁盘上但永远不会进入 git。

## 遗忘契约

`gbrain forget <id>` 和 MCP `forget_fact` 操作以删除线 + `valid_until = today` + `context: "forgotten: <reason>"` 重写围栏行。数据库的 `expired_at = valid_until + now()` 推导在每次重建时重新构建遗忘状态，因为围栏是权威的。

删除线有两个由上下文区分的语义：

- `~~claim~~` + `context: "superseded by #N"` → 行被同一围栏中的较新行替换
- `~~claim~~` + `context: "forgotten: <reason>"` → 行通过遗忘操作撤回

两种编码都将行保留在 markdown 中以供审计历史。要永久删除事实，直接在 markdown 中编辑围栏并移除行。下一次 `extract_facts` 循环擦除数据库行。

## 灾难恢复

规则做出的承诺：

```bash
# 快照当前内容
gbrain stats > /tmp/before.txt

# 擦除并重建
gbrain rebuild --confirm-destructive   # v0.32.3 — 删除派生表
                                       #（pages + content_chunks 在 CASCADE 安全设计中存活）
                                       # 或手动用于 v0.32.2：
psql -c 'DELETE FROM facts; DELETE FROM takes; DELETE FROM links; DELETE FROM timeline_entries;'
gbrain sync
gbrain extract all

# 计数匹配
gbrain stats > /tmp/after.txt
diff /tmp/before.txt /tmp/after.txt
```

不变式 E2E 测试在 `test/e2e/system-of-record-invariant.test.ts` 中在每次 CI 运行时执行此精确流程。

## 新代码规则

当你添加一个新的用户知识类别时：

1. **定义 markdown 形状。** 围栏（`<!--- gbrain:NAME:begin --> ... :end -->` 表）或 frontmatter 字段。
2. **构建解析器**，从 markdown 生成结构化数据。请参阅 `src/core/fence-shared.ts` 中的共享原语。
3. **构建写入器**，往返：解析 + 编辑 + 渲染为相同输入生成字节相同的 markdown。
4. **添加引擎方法**，获取解析的数据并标记派生表。该方法在 CI 门的禁止直接调用列表中获得一个条目。
5. **添加协调器：** 一个遍历页面、解析围栏并从头重建派生表的循环阶段。协调器是引擎方法的唯一合法调用站点；`// gbrain-allow-direct-insert: <reason>` 显式注释它。
6. **添加往返测试**，在 `test/e2e/system-of-record-invariant.test.ts` 中证明 DELETE + 协调重建表字节相同。

`scripts/check-system-of-record.sh` 中的 CI 门在任何 PR 添加对派生表写入器的新直接调用时失败，除非在协调器/迁移层之外有明确的允许列表注释。

## 相关

- `~/.claude/plans/system-instruction-you-are-working-expressive-pony.md` — v0.32.2 设计计划（决策 D1-D22 + Q1-Q8，Codex 第 1 轮和第 2 轮发现）
- `skills/migrations/v0.32.2.md` — 面向代理的迁移指南
- `CHANGELOG.md` v0.32.2 条目 — 发布宣言
- `scripts/check-system-of-record.sh` — 强制执行规则的 CI 门
