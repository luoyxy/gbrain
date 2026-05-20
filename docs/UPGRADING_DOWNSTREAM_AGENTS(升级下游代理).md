# 升级下游代理

GBrain 在 `skills/` 中提供技能。下游代理（自定义 OpenClaw 部署、任何类型的代理分支）通常**复制**这些技能文件到自己的工作区，并随着时间的推移而**分叉**——添加代理特定的阶段、删除不相关的阶段、收紧语言。一旦发生这种情况，gbrain 就无法将更新推送到这些分支。代理必须手动应用差异。

本文档列出了每个下游代理在升级时需要应用的确切差异。对照你的分支的本地技能文件进行交叉引用。

## 为什么存在这个文档

`gbrain upgrade` 发布新的二进制文件。`gbrain post-upgrade [--execute --yes]` 运行模式迁移并回填数据。但是告诉代理如何行为的**技能文件本身**是用户拥有的。如果你的 `~/git/<your-agent>/workspace/skills/brain-ops/SKILL.md` 顶部显示 `# Based on gbrain v0.10.0`，那么它不知道 v0.12.0 的功能。

代理将在每次 `put_page` 后继续手动调用 `gbrain link`（现在冗余——自动链接会处理它），错过了用于关系问题的 `gbrain graph-query`，并且不知道回填结构化时间线。

## 如何应用

1. 识别你的分叉技能文件。通常在 `~/git/<your-agent>/workspace/skills/` 或你的代理的技能目录所在位置。
2. 对于下面列出的每个技能，在你的分叉中找到匹配的阶段/部分。
3. 应用差异（将新块粘贴到指示的位置）。
4. 更新分叉顶部的版本横幅（`# Based on gbrain v0.12.0`）。
5. 验证：要求代理编写一个测试页面，并确认响应包含 `auto_links: { created, removed, errors }`。

总时间：所有四个技能约 10 分钟。

---

## 1. brain-ops/SKILL.md

**位置：** 在 `### Phase 2: On Every Inbound Signal` 之后立即插入一个新的 `### Phase 2.5` 部分。

**为什么：** 阶段 2.5 声明自动链接会自动运行。如果没有这个，代理的心智模型会说它必须在每次 `put_page` 后调用 `gbrain link`，现在这是冗余的，并且可能导致双重添加警告。

```markdown
### Phase 2.5: Structured Graph Updates (automatic)

Every `put_page` call automatically extracts entity references and writes them
to the graph (`links` table) with inferred relationship types. Stale links
(refs no longer in the page text) are removed in the same call. This is
"auto-link" reconciliation.

- No manual `add_link` calls needed for ordinary page writes.
- Inferred link types: `attended` (meeting -> person), `works_at`, `invested_in`,
  `founded`, `advises`, `source` (frontmatter), `mentions` (default).
- The `put_page` MCP response includes `auto_links: { created, removed, errors }`
  so the agent can verify outcomes.
- To disable: `gbrain config set auto_link false`. Default is on.
- Timeline entries with specific dates still need explicit `gbrain timeline-add`
  (or batch via `gbrain extract timeline --source db`).
```

**还要更新铁律部分。** 如果你的分叉仍然说"每次大脑写入时维护反向链接（铁律）"而没有限定条件，请追加：

```markdown
**v0.12.0 update:** Auto-link satisfies the Iron Law for entity-reference links
on every `put_page`. The agent's Iron Law obligation is now: include the
entity reference in the page content (e.g., `[Alice](people/alice)`); auto-link
handles the structured row. Manual `add_link` calls are reserved for
relationships you can't express in markdown content.
```

---

## 2. meeting-ingestion/SKILL.md

**位置：** 追加到 `### Phase 3: Attendee enrichment` 的末尾。

**为什么：** 消除每个出席者的冗余 `gbrain link` 调用（当会议页面将出席者引用为 `[Name](people/slug)` 时，自动链接会处理它们）。

```markdown
**Note (v0.12.0):** Once the meeting page is written via `gbrain put`, the
auto-link post-hook automatically creates `attended` links from the meeting
to each attendee whose page is referenced as `[Name](people/slug)`. You don't
need to call `gbrain link` for attendees. You DO still need `gbrain timeline-add`
for dated events (auto-link only handles links, not timeline entries).
```

**位置：** 在 `### Phase 4: Entity propagation` 中，行"从实体页面到会议页面的反向链接"可以替换为：

```markdown
4. Entity references in the meeting page body auto-create the link via auto-link.
   For incoming references on the entity page (entity page → meeting page), edit
   the entity page to mention the meeting and `put_page` it — auto-link handles
   the rest.
```

---

## 3. signal-detector/SKILL.md

**位置：** 追加到 `### Phase 2: Entity Detection` 的末尾。

**为什么：** 与 brain-ops 相同的逻辑——消除在写入引用人物或公司的 originals/ideas 页面后手动调用 `gbrain link`。

```markdown
**Auto-link (v0.12.0):** When you write/update an originals or ideas page that
references a person or company, the auto-link post-hook on `put_page`
automatically creates the link from the new page to that entity. You don't
need to call `gbrain link` manually. Timeline entries still need explicit calls.
```

---

## 4. enrich/SKILL.md

**位置：** 用 v0.12.0 版本替换 `### Step 7: Cross-reference`。

**为什么：** 步骤 7 以前主要是关于在相关实体页面之间创建链接。使用自动链接，这是自动的。步骤 7 现在是关于内容更新，而不是链接创建。

旧版本（删除）：
```markdown
### Step 7: Cross-reference

- Update company pages from person enrichment (and vice versa)
- Update related project/deal pages if relevant context surfaced
- Check index files if the brain uses them
- Add back-links manually via `gbrain link` for any new entity references
```

新版本（粘贴）：
```markdown
### Step 7: Cross-reference:

- Update company pages from person enrichment (and vice versa)
- Update related project/deal pages if relevant context surfaced
- Check index files if the brain uses them

**Note (v0.12.0):** Links between brain pages are auto-created on every
`put_page` call (auto-link post-hook). Step 7 focuses on content
cross-references (updating related pages' compiled truth with new signal
from this enrichment), not on creating links. Verify via the `auto_links`
field in the put_page response (`{ created, removed, errors }`).
Timeline entries still need explicit `gbrain timeline-add` calls.
```

---

## 应用所有四个差异后

1. **提升每个分叉文件顶部的版本横幅：**
   ```
   # Based on gbrain v0.12.0 skills/<skill-name>, extended with <your-agent>-specific config
   ```

2. **运行 v0.12.0 回填**（这为你的现有大脑填充图）：
   ```bash
   gbrain post-upgrade
   ```
   v0.12.0 发布版将 post-upgrade 连接为自动调用 `apply-migrations --yes`，它运行 v0_12_0 编排器（模式 → 配置检查 → `extract links --source db` → `extract timeline --source db` → 验证）。幂等；当没有待处理项时成本低。

3. **验证自动链接工作：** 要求代理编写一个引用 `[Some Person](people/some-person)` 的测试页面。确认 put_page 响应包含 `auto_links: { created: 1, removed: 0, errors: 0 }`。

4. **验证图遍历工作：**
   ```bash
   gbrain graph-query people/some-well-connected-person --depth 2
   ```
   应该返回类型化边的缩进树。

---

## v0.12.2 热修复（数据正确性，无技能编辑）

v0.12.2 是一个 Postgres 数据正确性热修复。不需要更改分叉技能文件——技能契约未更改。但是你确实需要运行迁移，并且你应该知道 markdown 解析中的一个行为变更。

### 1. 运行迁移（Postgres 支持的大脑）

```bash
gbrain upgrade
```

`v0_12_2` 编排器自动运行 `gbrain repair-jsonb`。它重写 `pages.frontmatter`、`raw_data.data`、`ingest_log.pages_updated`、`files.metadata` 和 `page_versions.frontmatter` 中 `jsonb_typeof = 'string'` 的行。幂等，安全重新运行。PGLite 大脑干净地无操作。

升级后验证：

```bash
gbrain repair-jsonb --dry-run --json    # expect totalRepaired: 0
```

### 2. 恢复任何截断的维基文章

如果你的大脑在 v0.12.2 之前导入了维基风格的 markdown，一些页面被静默截断（正文中的任何独立 `---` 被视为时间线分隔符）。从来源重新导入：

```bash
gbrain sync --full
```

新的 `splitBody` 正确重建 `compiled_truth`。

### 3. 了解未来的 splitBody 契约

`splitBody` 现在需要一个显式的时间线标记。识别的标记（优先级顺序）：

1. `<!-- timeline -->` （首选——`serializeMarkdown` 发出的内容）
2. `--- timeline ---` （装饰性分隔符）
3. `---` 直接在 `## Timeline` 或 `## History` 标题之前（向后兼容）

正文文本中的裸 `---` 现在是 markdown 水平规则，而不是时间线分隔符。如果你的代理使用裸 `---` 分隔符写入页面，请迁移到 `<!-- timeline -->`——`serializeMarkdown` 助手已经这样做。

### 4. 维基子类型现在自动类型化

`inferType` 现在自动检测五个额外的目录模式作为它们自己的页面类型（以前它们都默认为 `concept`）：

| 路径模式           | 新类型       |
|------------------------|----------------|
| `/wiki/analysis/`      | `analysis`     |
| `/wiki/guides/`        | `guide`        |
| `/wiki/hardware/`      | `hardware`     |
| `/wiki/architecture/`  | `architecture` |
| `/writing/`            | `writing`      |

如果你的技能或查询按 `type=concept` 过滤并期望该桶中有维基内容，请更新它们以包含新类型。

---

## v0.13.0 — Frontmatter 关系索引

**裁定：大多数技能不需要操作。** v0.13 将 YAML frontmatter 字段投射到图中作为类型化边。摄取 API 未更改——继续像今天一样使用 frontmatter 调用 `put_page`；图在幕后自动填充。

如果你想要使用新的 `auto_links.unresolved` 响应字段，三个技能会获得一个可选的新阶段。如果没有这个，无法解析的 frontmatter 名称会静默跳过（与 v0.12 行为相同）。

### 1. meeting-ingestion/SKILL.md（可选）

**位置：** 在"Phase 3: Write Meeting Page"之后添加一个新部分。

```markdown
### Phase 3.5: Check for unresolved attendees (v0.13+)

After `put_page`, inspect `response.auto_links.unresolved` — an array of frontmatter
references that did not resolve to existing pages. For meetings, this usually means
attendees you haven't created a person page for yet.

If `unresolved.length > 0`:
- Option 1 (create pages now): trigger an enrichment pass to build the missing people pages.
- Option 2 (defer): log the unresolved names to the enrichment queue for later.
- Option 3 (accept the gap): the attendee edge will not be created until a page exists.
  Re-running `gbrain extract links --source db --include-frontmatter` after creating
  the page fills in the missing edges.
```

### 2. enrich/SKILL.md（可选）

**位置：** 添加到 enrichment 触发器列表。

```markdown
### Drain unresolved frontmatter names (v0.13+)

If any `put_page` response includes `auto_links.unresolved` entries, the enrichment
tier should pick up those (field, name) pairs and try to create the missing entity
pages. Example flow:

1. signal-detector captures a meeting with `attendees: [Alice Known, Unknown Person]`
2. put_page returns `auto_links.unresolved = [{field: 'attendees', name: 'Unknown Person'}]`
3. enrichment tier consumes `Unknown Person` → web search → creates `people/unknown-person.md`
4. The next put_page (or a backfill run) wires up the `attended` edge automatically
```

### 3. idea-ingest/SKILL.md（可选）

**位置：** 与 meeting-ingestion 相同的模式——在 `put_page` 后检查 `auto_links.unresolved`，将名称路由到 enrichment。

### 未更改的技能（不需要差异）

- **brain-ops/SKILL.md** —— 自动链接机制是内部的；写入路径保持不变。
- **signal-detector/SKILL.md** —— 信号捕获路径未更改。
- **query/SKILL.md** —— `traverse_graph` 现在自动返回更丰富的结果。
- **daily-task-manager/SKILL.md**、**briefing/SKILL.md**、**citation-fixer/SKILL.md**、**media-ingest/SKILL.md** —— 未更改。

### 你可以在图查询中过滤的新边类型

v0.13 边携带新的 `link_type` 值。如果你的分叉有按类型过滤的图查询技能，现在可以使用这些：

- `works_at` (person → company) — 来自 `company:`、`companies:` 或 `key_people:`
- `founded` (person → company) — 来自 `founded:`
- `invested_in` (investor → deal/company) — 来自 `investors:` 或 `lead:`
- `led_round` (lead → deal) — 来自 `lead:`
- `yc_partner` (partner → company) — 来自 `partner:`
- `attended` (person → meeting) — 来自 `attendees:`
- `discussed_in` (source → page) — 来自 `sources:`
- `source` (page → source) — 来自 `source:`
- `related_to` (page → target) — 来自 `related:` 或 `see_also:`

### 迁移时机

`gbrain upgrade` 在 46K 页面的大脑上需要 2-5 分钟（一次性）。通过 `gbrain post-upgrade` 在进程外运行。如果代理在升级期间持有数据库连接，请在之后重新连接；否则继续服务。

### v0.13 中不进行类型规范化

带有 `link_type='attendee'` 或 `link_type='mention'` 的旧行与新的 `'attended'` / `'mentions'` 行共存。你按旧类型名称过滤的查询继续工作。v0.14 中的一个单独的选择加入 `gbrain normalize-types` 命令处理重命名。

## v0.14.0 shell 作业（可选采用，无技能编辑）

向 Minions 添加 `shell` 作业类型，以便确定性 cron 脚本（API 获取、token 刷新、抓取 + 写入）从 LLM 网关移出。每次触发零 token。~60% 网关 CPU 余量在典型规模下。功能**默认关闭**，现有安装继续保持与以前完全相同的方式运行。没有破坏。

要采用，请遵循 `skills/migrations/v0.14.0.md`。简短版本：

1. 在 worker 进程上设置 `GBRAIN_ALLOW_SHELL_JOBS=1`，然后 `gbrain jobs work`（Postgres）。在 PGLite 上，每个 crontab 调用使用 `--follow` 进行内联执行；没有持久 worker。
2. 将主机的每个 cron 条目分类：需要 LLM（留在网关上）vs 确定性（shell 候选）。典型拆分：
   - **确定性 → shell：** `ycli-token-refresh`、`x-oauth2-refresh`、`x-garrytan-unified`、`calendar-sync-to-brain`、`github-pulse`、`frameio-scan`、`flight-tracker`、`x-raw-json-backfill`。
   - **需要 LLM → 保留：** `social-radar`、`content-ideas`、`adversary-vacuum`、`ea-inbox-sweep`、`morning-briefing`、`brain-maintenance`。
3. 对于每个确定性 cron，重写为：
   ```cron
   3 13,16,19,22,1,4,7,10 * * * \
     gbrain jobs submit shell \
       --params '{"cmd":"node scripts/your-script.mjs","cwd":"/data/.openclaw/workspace"}' \
       --max-attempts 3 --timeout-ms 300000
   ```
4. 在每次触发时观察 `gbrain jobs get <id>` 的 exit_code / stdout_tail / stderr_tail。在批准下一批之前与迁移前行为进行比较。

**不需要技能编辑。** 处理程序在 worker 端运行；技能文件不会更改。如果主机通过插件契约（v0.11.0）公开自定义处理程序，它们的工作方式仍然相同。

铁律：**永远不要自动重写操作员的 crontab。** 每次重写都是每个 cron、人工批准的，带有差异。如果你以后想要自动化，即将到来的 `gbrain crontab-to-minions <file>` 助手在 TODOS 中是 P1。

---

## v0.16.0：持久代理运行时

v0.15 发布 `gbrain agent run` / `gbrain agent logs`、Minions 中的新 `subagent` 处理程序类型，以及用于主机仓库子代理 def 的插件契约。现有技能都不需要手术。下游代理的问题是*如何*采用新的运行时，而不是如何围绕破坏性更改进行修补。

### 1. 使用 Anthropic 密钥运行 worker

子代理处理程序（`subagent` 和 `subagent_aggregator`）始终在 worker 上注册。没有单独的选择加入标志——`ANTHROPIC_API_KEY` 是自然成本门（没有密钥，SDK 调用在第一次失败时），并且谁可以提交已经受到保护（`PROTECTED_JOB_NAMES` + trusted-submit：MCP 调用者获得 `permission_denied`；只有 `gbrain agent run` 可以插入这些行）。

```bash
ANTHROPIC_API_KEY=sk-ant-... gbrain jobs work
```

Worker 启动打印：

```
[minion worker] subagent handlers enabled
```

### 2. 将子代理作为插件发布（OpenClaw + 类似）

将你的自定义子代理定义从 gbrain 分叉中移出，放入你自己的仓库作为插件。具体来说：

```
~/<your-agent>/gbrain-plugin/
├── gbrain.plugin.json
└── subagents/
    ├── meeting-ingestion.md
    ├── signal-detector.md
    └── daily-task-prep.md
```

`gbrain.plugin.json`：

```json
{
  "name": "your-openclaw",
  "version": "2026.4.20",
  "plugin_version": "gbrain-plugin-v1"
}
```

每个 `subagents/*.md` 是一个纯文本代理定义——YAML frontmatter + body-as-system-prompt。识别的 frontmatter 字段：`name`、`model`、`max_turns`、`allowed_tools`（必须子集派生的 brain-tool 注册表）。

打开它：

```bash
export GBRAIN_PLUGIN_PATH="$HOME/<your-agent>/gbrain-plugin"
```

Worker 启动在每个插件打印 `[plugin-loader] loaded '<name>' v<ver> (N subagents)`；任何拒绝（错误清单、未知工具 `allowed_tools`、版本不匹配）在启动时显示为响亮的警告，而不是静默调度时间失败。有关完整契约，请参见 `docs/guides/plugin-authors.md`。

### 3. 用持久性替换临时子代理运行

如果你的代理当前为应该经受崩溃、睡眠或 worker 重启的工作生成临时子代理（OpenClaw `Agent()`、临时 Anthropic API 调用等），请将那些迁移到 `gbrain agent run`。持久性是免费的：

```bash
gbrain agent run "analyze my last 50 journal pages for recurring themes" \
  --subagent-def analyzer --fanout-manifest manifests/journal-pages.json
```

每次轮换都持久化到 `subagent_messages`，每个工具调用都是一个两阶段分类账，并且 `gbrain agent logs <job>` 显示它死在哪里 + 最后一次成功调用返回了什么。不再有"因为会话上下文蒸发而从零开始重新运行"。

### 4. 来自子代理的 `put_page` 在代理命名空间下写入

如果你采用了 v0.15 子代理运行时，请注意源自子代理工具调度的 `put_page` 调用必须定位到 `wiki/agents/<subagent_id>/...`。显示给模型的模式在第一次尝试时强制执行此操作；服务器端故障关闭检查拒绝其他任何内容。这**不**影响你的技能文件、CLI put_page 调用或 MCP put_page——只有 LLM 循环内的工具调度写入。

聚合输出（最终的"这是所有 N 个子项发现的内容"大脑页面）通过单独的可信 CLI 路径，而不是通过子代理工具调用，因此它可以写入你想要的任何位置。

铁律：**永远不要授予代理超出其命名空间的写入访问权限**。服务器端检查存在是因为调度程序错误会发生；将其视为深度防御，而不是主要边界。

---

## v0.22.4 — frontmatter-guard 采用

### 1. 停止手工滚动 frontmatter 验证器

如果你的分叉有直接调用 `js-yaml` 来验证大脑页面 frontmatter 的脚本，请将它们替换为 `gbrain frontmatter validate` 调用。CLI 涵盖七个规范错误类，并发布一个跨版本稳定的 `--json` 信封。

```diff
- # Custom validator script
- node scripts/validate-frontmatter.mjs <path>
+ gbrain frontmatter validate <path> --json
```

对于需要在另一个脚本中使用验证器的消费者，从 gbrian 的 `markdown` 导出中导入，而不是复制逻辑：

```ts
import { parseMarkdown } from 'gbrain/markdown';

const parsed = parseMarkdown(content, filePath, { validate: true, expectedSlug });
for (const err of parsed.errors ?? []) {
  // err.code: MISSING_OPEN | MISSING_CLOSE | YAML_PARSE | SLUG_MISMATCH |
  //           NULL_BYTES | NESTED_QUOTES | EMPTY_FRONTMATTER
}
```

### 2. 删除对 `lib/brain-writer.mjs` 的任何引用

如果你的分叉的技能或脚本引用了期望的 `lib/brain-writer.mjs`（它从未发布——规范在 PR #392 中，从未落地），请将那些引用替换为 gbrain CLI。frontmatter-guard 技能位于 `skills/frontmatter-guard/SKILL.md` 并指向 `gbrain frontmatter validate` / `audit` / `install-hook`。

### 3. 将 doctor 子检查接入你的健康管道

`gbrain doctor` 现在自动报告 `frontmatter_integrity`。如果你的分叉有自定义健康管道（例如，关于大脑健康的每日 Slack 帖子），请从 `gbrain doctor --json` 中提取并呈现 `frontmatter_integrity` 行计数。

### 4.（可选）在大脑仓库上安装预提交钩子

对于由 git 支持的资源，v0.22.4 install-hook 助手放置一个预提交脚本，阻止带有格式错误的 frontmatter 的提交：

```bash
gbrain frontmatter install-hook
```

如果你的大脑不是 git 仓库，或者你的下游代理已经在写入时强制执行验证，请跳过此步骤。有关完整配方，请参见 `docs/integrations/pre-commit.md`。

### 5. 迁移人体工程学——读取 pending-host-work.jsonl

在 `gbrain apply-migrations --yes` 运行 v0.22.4 审计后，你的代理应该读取 `~/.gbrain/migrations/pending-host-work.jsonl`（过滤到 `migration === "0.22.4"`）并遍历每个条目的 `command` 字段。每个条目指向每个资源的 `gbrain frontmatter validate <source_path> --fix` 命令——将计数呈现给用户，获得明确同意，然后运行。

迁移是**仅审计**。它在 `apply-migrations` 期间从不变异大脑内容。你的代理在用户同意的情况下运行修复命令。

---

## 未来版本

当 gbrain 发布新版本时，本文档将使用该版本的差异进行更新。每个新版本附加一个部分；旧部分保留，以便你可以一次赶上多个版本。

要检查你的分叉缺少什么：

```bash
diff <(grep -A3 "Based on gbrain" ~/<your-fork>/skills/brain-ops/SKILL.md) \
     <(grep "v[0-9]" ~/gbrain/skills/migrations | tail -3)
```

---

## v0.36.5.0 — 调用 `gbrain` CLI 的 shell 作业的自由格式秘密继承

**变更。** Shell-job 参数获得一个新的 `inherit:` 字段。在其上传递任何 snake_case 配置密钥名称；worker 在子生成时从其 `loadConfig()` 解析值并将其注入到子 env 中。名称落在行中；值从 `inherit:` 开始永远不会持久化。验证在两个提交路径（CLI + `submit_job` op）中**入队前**运行，因此格式错误的负载永远不会落在 `minion_jobs.data` 中。

**为什么。** 在 v0.36.5.0 之前，想要从 shell 作业调用 `gbrain` 的代理必须要么将 `database_url` 写入 `~/.gbrain/config.json` 明文，要么按作业传递 `env: { GBRAIN_DATABASE_URL: "..." }`。两者都将明文秘密留在某处——磁盘或数据库行。`inherit:` 将名称保留在行中，并在生成时解析值。

**你的代理可以做什么。** `inherit:` 是自由格式的。传递任何配置密钥：

```jsonc
{
  "cmd": "gbrain sync --skip-failed && gbrain embed --stale",
  "cwd": "/data/gbrain",
  "inherit": ["database_url", "anthropic_api_key", "voyage_api_key"]
}
```

子环境中的 env 密钥名称是通过将配置密钥大写派生的：`database_url` → `GBRAIN_DATABASE_URL`、`anthropic_api_key` → `ANTHROPIC_API_KEY`、`voyage_api_key` → `VOYAGE_API_KEY` 等。验证器**不** policing你继承哪些配置密钥——代理与 worker 处于相同的 uid，因此由代理决定。

**你仍然可以使用 `env:`。** v0.36.5.0 不禁止 `env:{ ANYTHING }`。如果你有理由将值放在行明文中（不透明的关联 token，或者你知道可以持久化的秘密），请通过 `env:` 传递。当你想要值离开行时，更喜欢 `inherit:`。

**Worker 设置**（一次性，每个主机）：

- `gbrain config set database_url postgresql://...`（或你想要可用于继承的任何其他密钥）
- 或将密钥直接放入 `~/.gbrain/config.json`
- 或在 worker 进程上设置 `GBRAIN_DATABASE_URL` / `DATABASE_URL` / 每个提供程序 env

如果 worker 无法解析请求的名称，验证器在提交时快速失败，并带有 `gbrain config set <X>` 提示。提交后几分钟，子 stderr 中不再有静默的"没有数据库 URL"失败。

**也是新的。** `gbrain doctor` 检查 `home_dir_in_worktree` 如果 `~/.gbrain/` 位于 git 工作树内会发出警告。追溯 `~/.gbrain/.gitignore`（单行 `*`）现在由每个 `saveConfig()` 调用和 `gbrain post-upgrade` 放置，因此现有用户在不需要重新运行 `gbrain init` 的情况下获得覆盖。诚实范围：`.gitignore` 涵盖临时 `git add` 但不涵盖已跟踪的文件、屏幕截图、备份或 `git add -f`。

**策略框架。** 对于代理到大脑的调用，新的规范指南是 `docs/guides/agent-to-gbrain.md`。两个不同的面：通过 OAuth 的 HTTP MCP 用于具有 MCP 等效项的操作（`search`、`query`、`put_page` 等），以及用于 `localOnly` 管理操作（`sync`、`embed`、`dream`、`doctor` 等）的 shell job + `inherit:`。不是后备层次结构——按 op 选择。

**要处理的错误**（你的代理提交 shell 作业；清楚地呈现这些）：

| 错误 | 含义 | 代理操作 |
|---|---|---|
| `shell: inherit must be an array of config-key names` | `inherit` 不是数组。 | 传递 `"inherit": ["database_url", ...]`。 |
| `shell: inherit entries must be non-empty strings` | 元素为空、非字符串或 null。 | 使用 snake_case 配置密钥名称。 |
| `shell: inherit name "<X>" must match [a-z][a-z0-9_]*` | 名称未通过 snake_case 正则表达式（大写、前导下划线等）。 | 按原样使用配置密钥——`database_url`，而不是 `DATABASE_URL`。 |
| `shell: inherit requested "<X>" but worker has no <X> configured` | Worker 无法从其 `loadConfig()` 解析名称。 | 在 worker 主机上运行 `gbrain config set <X> <value>`。 |
