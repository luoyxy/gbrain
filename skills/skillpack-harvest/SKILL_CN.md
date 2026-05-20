---
name: skillpack-harvest
version: 0.33.0
description: |
  从主机仓库（例如你的OpenClaw fork）提升经过验证的技能到
  gbrain的bundle中，以便其他客户端可以搭建它。编辑工作流：
  CLI执行文件复制 + 隐私lint；此技能驱动
  重度判断的通用化（清除真实名称、通用化触发器、
  将fork特定约定提升到引用）。
triggers:
  - "harvest this skill into gbrain"
  - "publish this skill to gbrain"
  - "lift this skill upstream"
  - "share this skill with other gbrain clients"
  - "promote my skill to gbrain"
mutating: true
writes_pages: false
writes_to:
  - skills/<harvested-slug>/
  - openclaw.plugin.json
---

# skillpack-harvest — 将主机技能提升到gbrain的编辑工作流

> **约定：** 参见 [_brain-filing-rules.md](../_brain-filing-rules.md) 了解
> 文件放置规则。此技能写入gbrain自己的树中，而不是
> brain仓库的笔记。

此技能是 `gbrain skillpack scaffold` 的反向。Scaffold向下游发送
技能（gbrain → 主机）。Harvest向上游提升经过验证的模式
（主机 → gbrain），以便它们成为每个其他客户端
可以搭建的引用。

## 契约

当以下情况时，收获即"妥善完成"：

1. 主机技能是成熟的（在生产中使用，最近的routing-eval
   案例通过）。
2. 阶段3中的编辑通用化已清除每个
   fork特定引用（名称、真实实体、内部渠道）。
3. `gbrain skillpack harvest --dry-run` 预览了文件集。
4. 真实的 `gbrain skillpack harvest <slug> --from <host>` 成功，
   状态为 `harvested`（无隐私lint命中）。
5. `bun test test/skills-conformance.test.ts` 在新建的
   `skills/<slug>/SKILL.md` 上通过。
6. 用户已审查gbrain中的差异并明确批准
   提交。

如果其中任何一项不完整，技能尚未收获 — 
文件可能位于gbrain的工作树中，但它们没有落地。

## 输出格式

此技能在gbrain的工作树中生成三个工件：

1. `skills/<harvested-slug>/SKILL.md`（以及任何兄弟文件，如
   `routing-eval.jsonl`）
2. 镜像路径上的配对源文件（例如
   `src/commands/<slug>.ts`），当主机SKILL.md在frontmatter `sources:`中
   声明它们时
3. 更新的 `openclaw.plugin.json`，将新slug添加到
   `skills:`（已排序）

对用户的会话输出是一个一行成功摘要加上
写入的文件列表。JSON模式（`--json`）返回完整的
`HarvestResult` 形状以供机器使用。

## 反模式

- **跳过dry-run。** 始终首先预览。文件落在
  gbrain的工作树中；清理是 `git checkout`，但你
  不应该需要。
- **仅信任linter。** 默认正则表达式集捕获
  常见情况。它不会捕获每个专有名词。阶段3（
  编辑传递）是主要防御。
- **在没有理由的情况下使用 `--no-lint` 收获。** lint存在
  是有原因的。如果绕过它，在提交中记录原因。
- **收获仍然在变动中的技能。** 等待主机
  版本稳定。否则你将收获，然后重新收获，
  然后重新收获，这会没有益处地搅动gbrain的bundle。
- **移动文件而不是复制。** 收获是复制。主机
  保留其技能。收获后不要 `rm -rf` 源。
- **批量收获（一次多个技能）。** 不支持，并且
  有充分的理由 — 每个技能的编辑审查是真正的工作。

## 何时调用

- 用户在他们的主机fork（Wintermute、Neuromancer、
  Zion等）中开发了技能，并希望其他gbrain客户端能够使用它
- 技能已在生产中验证自身并准备好通用化
- 用户明确要求"收获"或"发布"上游技能

**不要**在以下情况下调用：
- 技能仍在本地变动中 — 首先让它稳定
- 技能引用无法通用化的私有内容
- 用户只想要分享一次性草稿（改用gist）

## 前置条件

运行此技能之前，确认：

1. **技能是成熟的。** 最近的 `routing-eval.jsonl` 案例通过；
   技能已在生产中使用了至少几次。

2. **技能是可通用化的。** 在你脑海中剥离测试：替换
   每个fork特定的名称。作为技能它仍然有意义吗？

3. **用户拥有gbrain检出。** 收获写入
   gbrain的工作树。他们将审查并提交。不要收获到
   用户不打算从中提交的检出中。

## 工作流

### 阶段1 — 计划

询问用户：
- 收获的技能应该有什么slug？（Slug必须是kebab-case，
  在gbrain bundle中全局唯一。）
- 哪个主机仓库是源？（到仓库根目录的路径，而不是技能
  目录 — 例如 `~/git/wintermute`，而不是 `~/git/wintermute/skills/foo`。）
- 配对源文件应该一起来吗？（检查主机SKILL.md的
  frontmatter `sources:` 数组。）

### 阶段2 — Dry-run + 隐私lint预览

使用 `--dry-run` 运行CLI：

```bash
gbrain skillpack harvest <slug> --from <host-repo-root> --dry-run
```

输出显示：
- 哪些文件将落在gbrain的树中
- 是否包含配对源
- （隐式）技能的frontmatter触发器 — 读取它们并检查
  它们是否通用化

**不要**跳过dry-run。隐私linter仅在真实
收获时运行，但dry-run预览让你在文件
落下之前看到它们。抽查SKILL.md和任何配对源，查找
linter可能遗漏的内容（专有名词、内部项目名称等）。

### 阶段3 — 通用化检查表（编辑传递）

在运行真实收获之前，遍历主机的 `skills/<slug>/`
文件并应用此检查表。如果有任何匹配，首先编辑主机
文件，然后运行收获。

1. **Fork特定名称 → 通用措辞**
   - `Wintermute` → `your OpenClaw`（或 `OpenClaw deployment`）
   - `Neuromancer`、`Zion`、`<personal-fork-name>` → 相同处理
   - 个人名字（`garry`、`jane`等） → `the user` /
     `you` / 通用占位符

2. **真实实体 → 占位符**
   - 真实人物、公司、交易、基金 → 占位符slug
     （`alice-example`、`acme-example`、`fund-a`等）
   - 电子邮件地址 → 完全剥离或使用 `example@example.com`
   - 内部Slack渠道 → `#some-channel` 或剥离
   - 特定跟踪器ID / Linear票据编号 → 剥离

3. **Fork特定约定 → 引用**
   - 提及 `<host-repo>/docs/...` 文件 → 要么将文档
     提升到gbrain，要么替换为通用占位符解释
   - 提及 `<host-repo>/skills/<other-fork-only-skill>` → 要么
     决定也收获那个，要么替换为通用
     模式引用

4. **触发器数组通用化**
   - 读取frontmatter `triggers:` 中的每个条目。任何都不应该
     引用用户的名字、fork名称或内部工具。
   - "Have garry sign off on it" → "have the user sign off on it"

5. **routing-eval.jsonl示例已清除**
   - 打开 `skills/<slug>/routing-eval.jsonl`。每个 `intent` 字段
     得到与 `triggers:` 相同的清除。

6. **代码注释 + 日志字符串**
   - 如果要收获配对源，请遍历它查找
     相同的私有模式泄漏。注释是最常见的
     隐藏位置。

### 阶段4 — 真实收获

一旦阶段3完成，运行真实收获：

```bash
gbrain skillpack harvest <slug> --from <host-repo-root>
```

默认行为：
- 文件复制时的路径限制 + 符号链接拒绝
- 隐私linter针对 `~/.gbrain/harvest-private-patterns.txt` 运行
  （加上内置默认值：`\bWintermute\b`、电子邮件、Slack渠道）
- 任何匹配 → 回滚（删除收获的文件）+ 非零退出
- `openclaw.plugin.json` 更新以添加slug，已排序

结果：
- `harvested` — 成功，manifest已更新，文件在gbrain的树中
- `lint_failed` — 隐私linter捕获了某些内容。返回阶段3，
  清除主机文件，重试。
- `slug_collision` — gbrain在该slug处已有技能。要么
  使用不同的slug，要么如果你真的
  意味着替换，则传递 `--overwrite-local`。

### 阶段5 — 在gbrain中验证

成功收获后：

1. `bun test test/skills-conformance.test.ts` — 确认新的
   SKILL.md符合frontmatter契约。
2. `gbrain skillpack check --strict` — 确认bundle和gbrain自己的检出之间没有漂移。
3. `gbrain skillpack list` — 确认slug出现在bundle中。
4. 审查差异：`cd <gbrainRoot> && git diff -- skills/<slug>/`
5. 在gbrain中提交添加（**不要**提交主机仓库中的任何剩余文件
   — 收获是复制，不是移动）。

### 阶段6 — 下游公告（可选）

如果其他gbrain客户端应该接收新技能：
- 在 `CHANGELOG.md` 中的"添加的技能"下记录它，
  用于下一个版本
- 如果技能来自
  核心团队之外的人，在PR中标记用户/贡献者

## 绕过：`--no-lint`

隐私linter是安全网。编辑传递是
主要防御。如果你彻底完成了阶段3并且
linter仍然因误报而触发，请使用 `--no-lint`：

```bash
gbrain skillpack harvest <slug> --from <host-repo-root> --no-lint
```

**在提交消息中记录绕过。** 未来的维护者
应该能够看到**为什么**lint被绕过（例如，"Wintermute
出现在引用中，不是真实引用 — 手动验证"）。

永远不要随意绕过linter。默认开启lint的整个重点是
真实名称偶尔会通过编辑传递
溜走。

## 收获不做什么

- 它不移动文件（它复制）。主机的 `skills/<slug>/`
  保持在适当位置。
- 它不自动清除名称。编辑传递是人类驱动的。
- 它不发布到npm或远程bundle。它写入到
  gbrain的工作树；用户通过正常的
  gbrain发布过程提交 + 发布。
- 它不支持 `--all`（无批量收获）。一次一个技能
  保持编辑审查可处理。

## 此技能接触的文件

- gbrain的 `skills/<slug>/` — 主机技能目录中的每个文件
  （复制）
- gbrain为声明的配对源的镜像路径
  （例如，如果主机SKILL.md在frontmatter中声明它，则为 `src/commands/<slug>.ts`）
- gbrain的 `openclaw.plugin.json` — 将slug添加到 `skills:`
  数组，按字母顺序排序
