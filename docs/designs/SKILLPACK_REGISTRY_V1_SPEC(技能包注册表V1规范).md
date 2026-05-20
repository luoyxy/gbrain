# 技能包发布 + 注册表 + 安装规范（post-v0.36.0.0）

> **⚠️ 需要与 v0.36 重新对齐。** 本规范是在假设 pre-v0.36 托管块安装模型（v0.36.0.0 已弃用，支持 scaffold + reference + harvest）的情况下编写的。战略决策仍然正确 — 第三方发布 + 注册表 + doctor + 评分标准 + tarball + TOFU + 沙箱 + CI 工作流拆分 + 防 typosquat — 但**动词和集成点改变了**：
>
> | 旧规范动词 | v0.36 对齐的动词 | 更改内容 |
> |---|---|---|
> | `gbrain skillpack install <name>` | `gbrain skillpack scaffold <source>` | 一次性添加复制，无托管块，拒绝覆盖。 |
> | `gbrain skillpack uninstall <name>` | （已删除） | 用户拥有文件；通过 `rm` 或 git 删除。 |
> | 自动执行运行手册 | scaffold 后显示 `bootstrap.md` | 已经与 codex T1 对齐（每步审批）— 变为打印的核对清单，不是执行器。 |
> | 多源解析器回执 | `~/.gbrain/skillpack-state.json` 中的每 scaffold 状态 | Codex G1 是正确的选择；v0.36 已经弃用了解析器块。 |
> | 自动重命名冲突 | 拒绝覆盖（v0.36 的契约） | Codex 是正确的；v0.36 已经强制执行它。 |
> | 更新路径 | `gbrain skillpack reference <name> [--apply-clean-hunks]` | 带有可选自动合并干净 hunk 的差异透镜。 |
>
> 保持逐字记录的内容：注册表 `garrytan/gbrain-skillpack-registry`、评分标准、doctor、解剖文档、tarball 确定性、TOFU + SHA 固定、背书层级、沙箱 + 环境清理、CI 工作流拆分、防 typosquat。参见 `docs/guides/skillpacks-as-scaffolding.md`（v0.36 规范模型）以了解实施前本规范必须对齐的契约。
>
> 有关状态，请参见文件顶部的 README：完整规范作为战略记录保留在下面。

## 上下文

在 v0.36.0.0（Hindsight Calibration）之后，gbrain 有一个成熟的技能包系统 — 但它只知道如何安装 **一个** 在 gbrain 自己的仓库根目录 `openclaw.plugin.json` 中声明的包。**Garry 想要交付一个"黑客马拉松评估"技能包作为独立制品**，任何 gbrain 用户都应该能够发现 + 安装它，并且生态系统应该在不让 Garry 手动策划每个 README 的情况下增长。这需要五个新功能：

1. **发布** — 一个有文档的仓库布局和清单格式，任何人都可以指向 git 仓库并称之为"技能包"。
2. **分发** — 从一个用户的机器到另一个用户的一种传输。Git + tarball，无集中托管基础设施。
3. **安装** — 扩展 `gbrain skillpack install` 以接受第三方源，具有适合将 markdown/SKILL.md 文件安装到工作空间（然后代理通过它路由）的信任姿态。
4. **发现 + 策划** — `github.com/garrytan/gbrain-skillpack-registry` 处的规范目录（Printing Press 库模式），具有背书层级、安全网关和编程搜索。第三方包住在作者的仓库中；注册表是指向它们的 `registry.json` 清单。
5. **跨分发** — 在 `mvanhorn/printing-press-library` 中列为姐妹注册表，AND 使用 Printing Press 在 gbrain 的 HTTP MCP 周围生成代理原生 CLI 包装器，以便非 gbrain 代理可以远程访问 gbrain 实例。将发现表面翻倍。

预期的结果是：`gbrain skillpack install hackathon-evaluation` 通过注册表解析，克隆源仓库（或获取固定的 tarball），验证清单，将技能文件放到工作空间中，并通过 RESOLVER.md / AGENTS.md 路由它们 — 与今天的捆绑安装相同的代码路径，只是在前面有远程源和注册表目录。

## 格局（为下面的每个设计选择提供信息）

- `agentskills.io` 是跨 Claude Code / Codex / Cursor / Gemini CLI / OpenClaw 采用的开放 SKILL.md 标准。格式已解决。
- 现有市场中约 2,500 个 Claude Code 市场已经存在 (claudemarketplaces.com)。托管已被解决 2,500 次。护城河是策划 + 质量门槛。
- **现有市场中 13% 的技能带有严重漏洞** (根据 tech-leads-club，2026 年 5 月)。发布时的安全网关是真正的差异化因素，不是虚荣功能。
- `mvanhorn/cli-printing-press` (~1.4k 星) 将引擎与库完全按照本计划建议的方式分开。发布技能模式 (`/printing-press-publish`) 是承载 UX 动作 — 没有贡献者手动运行 git。我们复制它。
- gbrain 技能包有一个**运行时契约**（它们假设 `gbrain query`、`put_page`、源、takes、hindsight calibration）。在没有安装 gbrain 的情况下，它们不能移植到通用代理工具。这就是证明专用注册表而不是镜像 agentskills.io 的理由 — 验证表面是 gbrain 形状的。

## 今天的基线（存在什么，将不重新构建）

- `src/core/skillpack/bundle.ts:13-20` 中的 `BundleManifest` schema（`name`、`version`、`description`、`skills[]`、`shared_deps[]`、`excluded_from_install?[]`）。重用 + 扩展；不要重新发明。
- `installer.ts:259-293` — 托管块中嵌入的累积 slug 回执 (`<!-- gbrain:skillpack:manifest cumulative-slugs="..." version="..." -->`)。关于"从 gbrain 安装了什么"的单一事实来源。
- `installer.ts:376-402` — 安装/卸载前的每文件字节比较网关（D11）。拒绝在没有 `--overwrite-local` 的情况下破坏用户编辑。
- `installer.ts:180-253` — 具有 10 分钟陈旧阈值和 PID 活跃度检查的原子锁文件。并发安全。
- `src/core/git-remote.ts` — SSRF 加固的 `cloneRepo` / `pullRepo`，带有 `https://` 仅方案允许列表、无子模块、无重定向、无 `protocol.file`/`protocol.ext`。相同的原语远程源使用。
- `src/core/url-safety.ts:isInternalUrl` — 阻止 RFC1918 / CGNAT / 元数据 IP / IPv6 环回。已经通过 `parseRemoteUrl` 接通。
- `src/core/resolver-filenames.ts` — RESOLVER.md / AGENTS.md 文件名回退链。每技能行住在托管块内的这些文件之一内。

## 推荐设计

### 分发：git + tarball，v1

技能包是**一个在根目录有 `skillpack.json` 和 `skills/` 目录的 git 仓库**。同一树的 `.tgz` 是相同事物的离线可移植形式。两条路径都进入同一个安装程序。

- `gbrain skillpack install <owner>/<repo>` — 通过现有的 `git-remote.ts` SSRF 加固路径克隆。
- `gbrain skillpack install <url.git>` — 逐字 https URL。
- `gbrain skillpack install <path/to/pack.tgz>` — 解压到缓存目录，从解压的树安装。在阻止直接 GitHub 访问的 YC 组织或企业网络内部很有用，或者用于气隙分发。
- `gbrain skillpack install <path/to/repo>` — 本地路径（技能作者测试）。
- `gbrain skillpack pack [--out <path>]` — 发布者端命令，验证清单，运行完整的 `pack --dry-run` 管道，并发出 `<name>-<version>.tgz`。tarball 的 SHA-256 记录在 TOFU 回执中，以便同一 tarball 的重新安装是静默的，但是具有相同文件名的不正当 tarball 会大声失败。
- Tarball schema：gzip 压缩的 tar，在顶层有 `skillpack.json`，在它下面有 `skills/...`。无符号链接、无可执行文件、无允许列表之外的点文件 (`.gitignore`、`.gitattributes`)。验证器在解压时运行。

Tarball 是一种附加传输，不是不同的制品形状。安装程序在运行现有的 `enumerateBundle` + `applyInstall` 管道之前，将两条路径规范化为"磁盘上的解压树"。

### 注册表：`github.com/garrytan/gbrain-skillpack-registry`

一个单独的 git 仓库，Garry 控制。**不是**托管层 — 一个目录。技能包住在它们自己的作者的仓库中；注册表指向它们。

注册表仓库根目录的两个文件：

- `registry.json` — 实时目录。Schema：

  ```json
  {
    "schema_version": "gbrain-registry-v1",
    "updated_at": "2026-06-12T15:00:00Z",
    "skillpacks": [
      {
        "name": "hackathon-evaluation",
        "description": "使用 YC 评分标准对黑客马拉松提交进行评分。",
        "author": "Garry Tan",
        "author_handle": "garrytan",
        "homepage": "https://github.com/garrytan/skillpack-hackathon-evaluation",
        "source": {
          "kind": "git",
          "url": "https://github.com/garrytan/skillpack-hackathon-evaluation.git",
          "pinned_commit": "abc1234567890..."
        },
        "tarball_sha256": "deadbeef...",
        "gbrain_min_version": "0.36.0",
        "tier": "endorsed",
        "tags": ["evaluation", "yc", "founders"],
        "validated_at": "2026-06-12T15:00:00Z",
        "validation_run_id": "2026-06-12T14-58-...",
        "skills_count": 2,
        "skills": ["judge-submission", "score-rubric"]
      }
    ]
  }
  ```

- `endorsements.json` — Garry 控制的。关于哪些条目获得 `endorsed` 层级的单一事实来源。将背书决策与目录写入解耦意味着贡献者的 PR 可以以 `community` 层级将目录条目落地；提升到 `endorsed` 是单独的、更小的、仅限 Garry 的提交。

**背书层级：**

- `endorsed` — Garry 使用过它，它有效，它在他的固定集合中。在 `gbrain skillpack search` 输出的前面列出。手动提升。
- `community` — 通过了发布网关验证，住在目录中，但 Garry 尚未亲自审查它。第一次 PR 时的默认层级。
- `experimental` — 作者自行标记为开发中。最后列出，安装时有 stderr 警告。

**CLI 集成：**

```
gbrain skillpack search <query> [--tier endorsed|community|experimental] [--json]
gbrain skillpack info <name>             # 来自注册表，不是来自本地安装
gbrain skillpack install <name>          # 通过短名称通过注册表解析
gbrain skillpack install <url|tarball>   # 仍然适用于直接安装
gbrain skillpack install starter-pack    # registry.json 中的特殊包条目
gbrain skillpack registry [--url <url>]  # 显示/设置配置的注册表
```

`--url` 默认为 `https://raw.githubusercontent.com/garrytan/gbrain-skillpack-registry/main/registry.json`。企业网络内的操作员可以指向 fork。注册表 URL 记录在 `~/.gbrain/config.json` 中的 `skillpack.registry_url` 下。

`gbrain skillpack install starter-pack` 解析 `registry.json` 中的特殊 `bundles` 数组（命名的技能包名称列表）并按顺序安装每个。Garry 策划入门包。

**首次安装身份确认 + 防 typosquat (codex G4)：**

首次安装给定源的 `gbrain skillpack install <name>` 显示带有完整身份的确认提示：

```
[skillpack] 即将安装：
  Name:          hackathon-evaluation
  Author:        garrytan
  Source:        https://github.com/garrytan/skillpack-hackathon-evaluation
  Pinned commit: abc1234567890abcdef1234567890abcdef12345
  Tier:          endorsed
  Tarball SHA:   sha256:deadbeef...
继续？[y/N]
```

在 TTY 上被尊重；非 TTY 需要 `--trust` 标志并打印相同的块到 stderr。

同一 `<author>/<name>` 对具有相同固定提交 + tarball SHA 的后续安装跳过提示（已经受信任）。不同的固定提交重新提示。具有相同名称但不同作者的不同固定提交重新提示（有人可能转移/fork 了包）。

**注册表端防 typosquat 网关：** 发布网关（合并后工作流）拒绝其名称在 Damerau-Levenshtein 编辑距离 2 内的任何现有 `endorsed` 层级包名称的新提交。社区层级包不阻止（注册表不应该是低层级包的 typosquat 仲裁者；安装时确认是面向用户的防御）。工作量：~0.5 天，将距离检查接通到 validate-pr.yml 清单扫描；使用现成的距离算法（无外部依赖）。

**包原子性契约**（根据 eng-review D3）：每包独立。包安装中的每个包在托管块中是其自己的事务。中途包失败使较早的成功包保持安装，跳过后面的包，并打印摘要：

```
[skillpack] starter-pack：5 个中的 3 个已安装
  ✓ hackathon-evaluation @ 0.1.0
  ✓ founder-scorecard    @ 0.2.0
  ✗ resume-roaster       — 固定提交不可达
  ⤓ market-sizer         — 失败后跳过
  ⤓ pitch-doctor         — 失败后跳过
重试失败的包：gbrain skillpack install resume-roaster
```

匹配多源解析器设计（每源独立）。部分进度是可恢复的；没有意外的回滚。包内的失败不会毒害用户的 RESOLVER.md / AGENTS.md。

**背书工作流**：专用的 CLI 命令使用 schema 验证编辑 `endorsements.json`。手动编辑仍然可能（它只是 JSON），但命令是规范路径。

```
gbrain skillpack endorse <name> [--tier endorsed|community|experimental]
                                [--push] [--dry-run]
```

从 `garrytan/gbrain-skillpack-registry` 的克隆中运行。步骤：
1. 读取 + 验证当前的 `endorsements.json` 与 schema。
2. 确认 `<name>` 存在于 `registry.json` 中。
3. 使用新层级更新或插入条目。
4. 带回稳定的键排序（因此差异是干净的）。
5. Stage + 创建一个单线常规提交：`endorse: <name> -> <tier>`。
6. 如果 `--push`，推送到 `main`。否则打印"now run git push"提示。

### 发布网关技能：`/gbrain-skillpack-publish`

完全镜像 `mvanhorn/cli-printing-press` 的 `/printing-press-publish`。没有贡献者手动运行 git。技能驱动：

1. **本地验证** (`gbrain skillpack pack --dry-run`)：
   - `skillpack.json` schema 检查
   - 每个列出的技能的 SKILL.md 前置元数据
   - 文件类型允许列表（无 `.env`、`.ssh`、`.pem`、无可执行文件）
   - 与实时 `registry.json` 的 Slug 冲突扫描
   - `gbrain check-resolvable` 干净
   - `gbrain routing-eval` 干净（结构层）
2. **安全网关**（发布网关 v1，参见决策 Q3）：
   - 任何嵌入式脚本上的静态分析（`.sh` 的 shellcheck，数据文件上的启发式 JSON/YAML 安全检查通过）
   - 依赖声明检查 — SKILL.md 中引用的每个外部资源必须在声明的 `external_resources:` 数组中
   - 试验安装：将包解压到临时目录中，针对临时 PGLite 支持的 gbrain 运行 `gbrain skillpack install <tempdir>`（镜像 `test/e2e/longmemeval` 临时 PGLite 模式，在 `src/eval/longmemeval/harness.ts`），断言 `gbrain check-resolvable` 保持干净，并且技能行出现在托管块中。
   - 试验安装在 `GBRAIN_SKILLPACK_SANDBOX=1` 下运行，它禁用任何在工作空间外写入或访问网络的操作。
3. **测试 + 评估套件执行**（DX-review 决策：在沙箱中运行所有内容，以便背书信号是可测量的）：
   - **单元测试**：在沙箱中遍历 `unit_tests[]` glob 中的每个，通过 `bun test` 运行，每个文件收集通过/失败。
   - **E2E 测试**：如果 `DATABASE_URL` 暴露在沙箱内（Linux：`unshare`'d PG socket；macOS：docker-bridged）；优雅地跳过何时不可以。
   - **LLM-judge 评估**：加载每个 `*.judge.json`，使用 `__setChatTransportForTests` stubbed 网关运行跨模态管道，以便发布网关在发布网关时不支付实际 LLM 成本。发布者在提交之前运行实际网关评估；验证日志链接到它们的结果。沙箱针对 stubbed 网关重新运行，以证明管道端到端运行并且评估 JSON 格式良好。
   - **路由评估**：通过现有 `gbrain routing-eval` 命令进行结构匹配。断言 `routing-eval.jsonl` 中的每个 `intent` 解析到给定的技能的 `triggers:` 前置元数据的声明 `expected_skill`。
   - **覆盖率分数**：作为验证日志中的单个百分比发布。驱动层级资格：
     - `endorsed`：路由 + 运行手册 + >=95% 通过。
     - `community`：路由 + 安装运行手册 + >=80% 通过。
     - `experimental`：任何通过结构验证的。
   - **失败评估/测试表面可操作行**：验证日志中的每个失败包括文件路径、断言和粘贴就绪的重运行命令 (`bun test <file>` 或 `gbrain routing-eval skills/<name>/routing-eval.jsonl`)。
4. **Tarball + 哈希**：
   - `gbrain skillpack pack --out skillpack-<name>-<version>.tgz`
   - 记录 SHA-256 用于注册表固定
5. **注册表 PR**（Printing Press 逐字模式）：
   - 如果尚未 fork，则 fork `garrytan/gbrain-skillpack-registry`
   - 分支 `add-<name>-<version>`
   - 将目录条目附加到 `registry.json`，层级 = `community`，固定提交，tarball SHA-256，validated_at 时间戳和一个指向验证运行 JSON 的 `validation_run_id`，该 JSON 提交到注册表仓库下的 `validation-runs/<run-id>.json`，以便任何人都可以审计检查了什么
   - 使用验证日志在正文中针对 `garrytan/gbrain-skillpack-registry:main` 打开 PR
   - 延伸：Garry 的 `endorse <name>` 命令通过 `endorsements.json` 上的单线提交将条目翻转为 `endorsed`

技能文件本身在 gbrain 技能包中交付，位于 `skills/gbrain-skillpack-publish/SKILL.md`。可从加载 gbrain 技能的任何代理工具中调用。

### Printing Press 跨分发

双向集成（决策 Q2）：

- **交叉列表**：打开针对 `mvanhorn/printing-press-library` 的 PR，将 `garrytan/gbrain-skillpack-registry` 注册为它们目录中的姐妹注册表（它们的库在它们的 AGENTS.md 中具有 `sister_registries:` 部分）。它们的 1.4k 星观众通过他们已经使用的相同搜索表面发现 gbrain。
- **生成**：针对 `gbrain serve --http` 的 OpenAPI 规范（gbrain 的 HTTP MCP 公开具有稳定工具定义的 JSON-RPC 表面）运行 `printing-press print`。输出是一个 `gbrain-cli` 代理原生二进制文件，带有 SQLite 镜像，任何代理 — 不仅仅是 gbrain 用户 — 可以使用它来访问远程 gbrain。提交回 `mvanhorn/printing-press-library` 作为已发布的 CLI，归功于 Garry。将分发表面翻倍，并将 gbrain 转变为从 gbrain 运行时外部查看的即服务。

交叉列表是 ~1 天。生成的 CLI 是 ~1 周，并产生了一个以前不存在的真正的新型制品：从外部 gbrain 运行时查看的 gbrain-as-a-service。

### 清单 schema：`skillpack.json`（大教堂制品）

gbrain 技能包是一个**完整的软件包**，不仅仅是 markdown。与 npm/cargo 相同的形状：代码、测试、评估、运行手册、更改日志。根据 DX review，这是差异化护城河：没有人像一等包制品那样交付 AI 评估和代理可读的安装/升级运行手册。

```json
{
  "api_version": "gbrain-skillpack-v1",
  "name": "hackathon-evaluation",
  "version": "0.1.0",
  "description": "使用 YC 评分标准对黑客马拉松提交进行评分。",
  "author": "Garry Tan <garry@ycombinator.com>",
  "license": "MIT",
  "homepage": "https://github.com/garrytan/skillpack-hackathon-evaluation",
  "gbrain_min_version": "0.36.0",
  "skills": ["skills/judge-submission", "skills/score-rubric"],
  "shared_deps": [],
  "excluded_from_install": [],

  "unit_tests": ["test/**/*.test.ts"],
  "e2e_tests": ["e2e/**/*.test.ts"],
  "llm_evals": ["evals/*.judge.json"],
  "routing_evals": ["skills/*/routing-eval.jsonl"],
  "runbooks": {
    "install": "runbooks/install.md",
    "uninstall": "runbooks/uninstall.md",
    "upgrades": "runbooks/upgrade-*.md"
  },
  "changelog": "CHANGELOG.md"
}
```

**字段语义：**

- `api_version` — 前向兼容键；安装程序拒绝未知的。Schema 是 `gbrain-skillpack-v1`。Codex 外部声音差距：单个 `api_version` 不涵盖运行手册/评估/sandbox schema 演变。清单还带有 `runbook_schema_version`（默认 1）+ `eval_schema_version`（默认 1）。安装程序接受每维度配置的范围；拒绝声明比本地 gbrain 支持的更新 schema 的清单，并带有粘贴就绪的 `gbrain upgrade` 提示。拒绝静默降级。
- `gbrain_min_version` — 快速失败版本网关（现有的 semver 辅助程序）。
- `name` — 必须与目录名称匹配；在注册表命名空间中唯一。
- `skills[]` — 从仓库根目录的相对路径；与今天的 `enumerateBundle` 相同。
- `unit_tests[]` — 在发布网关期间在沙箱中发现的 Glob（多个）并运行。纯 Bun 单元测试，无 DB。
- `e2e_tests[]` — 用于集成测试的 Glob（多个）。如果 `DATABASE_URL` 在沙箱内可达，则运行（否则优雅地跳过）。
- `llm_evals[]` — 采用 gbrain v0.27.x 格式的跨模态评估配置（带有多模型判断的任务/输出提示）。使用**stubbed 网关**在发布网关沙箱中运行，因此没有实际的 API 支出；发布者的机器在提交之前运行实际网关评估。
- `routing_evals[]` — 带有 `{intent, expected_skill, ambiguous_with?}` 行的 `routing-eval.jsonl` 文件。针对技能 `triggers:` 前置元数据的结构匹配。对于代理路由的技能包，单一最高杠杆评估类型：证明用户输入短语实际触发正确的技能。
- `runbooks.{install, uninstall}` — 代理可读的 markdown（参见下面的格式）。
- `runbooks.upgrades` — 扩展到 `upgrade-<from>-to-<to>.md` 文件的 Glob。代理根据解析器回执中记录的新版本选取正确的文件。
- `changelog` — 必需的；代理在升级时直接从该文件显示"更改了什么"。

**基于覆盖率的层级资格**（发布网关对每个包评分）：

- `endorsed` 层级需要：路由评估 AND 运行手册 AND >=95% 通过声明的测试 + 评估。
- `community` 层级需要：路由评估 AND install.md AND >=80% 通过声明的测试 + 评估。
- `experimental` 层级接受任何通过结构验证的内容。

没有评估 + 没有测试的包只能作为 `experimental` 发布。发布网关发出单线分数摘要，以便发布者准确地看到阻止提升的内容。

### 安装/升级信任模型：每步审批，不是自动执行（codex T1）

DX review 的第一刀有 `gbrain skillpack install <name>` 在拖放文件后自动执行 `runbooks/install.md`。Codex 指出，这在每次安装时针对用户的 brain 运行受信任路径（`remote=false`）gbrain CLI 调用 — 恶意社区层级包在首次安装时会改变 brain 状态。v1 修复：**运行手册执行器默认为每步审批**。

- `gbrain skillpack install <name>` 总是拖放文件 + 更新解析器块。那部分是仅内容的；信任网关（TOFU + 内容哈希 + 背书层级）已经涵盖了它。
- 文件拖放后，如果 `runbooks/install.md` 存在，安装命令**打印每步 + 在 TTY 上等待显式 y/N**。三种步骤：`agent:`、`show user:`、`ask user:` 都在执行前表面逐字文本。
- `--runbook-apply-all` 标志为 CI / 无人值守代理使用绕过每步提示。首次使用时大声 stderr 行：
  `[skillpack] 无人值守地应用运行手册；此技能包是社区层级 — 通过检查 <pack-dir>/runbooks/install.md 确认信任`。
- `--runbook-skip` 仅落地文件而不执行任何运行手册步骤（发布者仅获得文件拖放；其他一切都是用户的决定）。
- `endorsed` 层级有资格在 v1.1 中获得自动执行安装后的 UX（在用户已经确认 N 次运行手册执行成功后，提示下降）。v1 的范围之外。

这是 npm postinstall 的教训，很难学到：安装时的自动执行是供应链攻击的发生方式。每步 + 干运行 + 背书是信任如何获得的方式。

### 代理运行手册格式（`runbooks/install.md`、`uninstall.md`、`upgrade-*.md`）

镜像 gbrain 自己的 `skills/migrations/v0.21.0.md` 模式 — markdown，代理从上到下读取并逐步执行。

```markdown
---
runbook_kind: install
gbrain_version_range: ">=0.36.0 <0.37.0"
skillpack: hackathon-evaluation
skillpack_version: 0.1.0
---

# 安装运行手册：hackathon-evaluation v0.1.0

1. **agent:** `gbrain put_page wiki/_skillpack-hackathon-evaluation --frontmatter type=skillpack-config`
   - 为什么：引导此技能包从中读取的配置页面。
2. **show user:** "黑客马拉松评估已安装。尝试：'针对 YC 评分标准判断此提交。'"
3. **ask user:** "想要将评估标准入门列表添加到你的大脑吗？"
   - 在是上：`gbrain put_page wiki/concepts/yc-rubric < seeds/rubric.md`
   - 在否上：跳过。
```

三种步骤，每个都是标记行形状，因此运行手册解析器是明确的：

- **`agent:`** — 调用代理逐字运行命令。
- **`show user:`** — 向用户显示消息（无操作）。
- **`ask user:`** — 需要用户确认；下一步是网关。

升级运行手册（`upgrade-<from>-to-<to>.md`）遵循相同的形状，带有额外的前置元数据（`from_version`、`to_version`），以便升级遍历器在逐步执行多版本升级时选取正确的运行手册（例如，v0.1 → v0.2 → v0.3 按顺序遍历两个运行手册）。

### 质量评分标准 + doctor + reference 包

技能包仅与代理判断它是否准备好的能力一样好。三个制品闭环：

**1. 声明式评分标准 — `src/core/skillpack/rubric.ts`**

单一事实来源。Doctor 遍历它；解剖文档是从它自动生成的；测试固定每个维度。当评分标准演变时（v1.1 添加维度，v2 更改评分），一个文件移动并且文档保持同步。与 gstack 的 `scripts/question-registry.ts` 相同的模式。

```ts
export const SKILLPACK_RUBRIC_V1: RubricDimension[] = [
  {
    id: 1,
    name: 'manifest_valid',
    description: 'skillpack.json 通过 v1 schema',
    check: async (pack) => validateManifest(pack),
    fix_hint: '运行：gbrain skillpack init <name> 重新生成有效的存根',
    weight: 1,
  },
  {
    id: 2,
    name: 'skills_have_skill_md',
    description: '每个列出的技能都有带有有效前置元数据的 SKILL.md（名称、描述、触发器、mutating、writes_pages）',
    check: async (pack) => allSkillsHaveValidSkillMd(pack),
    fix_hint: '运行：gbrain skillify scaffold <skill-name>',
    weight: 1,
  },
  {
    id: 3,
    name: 'routing_evals_present',
    description: '每个技能都有 routing-eval.jsonl，具有 >= 5 个意图',
    check: async (pack) => allSkillsHaveRoutingEvals(pack, 5),
    fix_hint: 'gbrain skillify scaffold 为每个技能丢弃 5 个示例意图',
    weight: 1,
  },
  {
    id: 4,
    name: 'routing_evals_clean',
    description: 'gbrain routing-eval 在每个 routing-eval.jsonl 上结构性通过',
    check: async (pack) => runRoutingEvalStructural(pack),
    fix_hint: '将缺少的触发短语添加到技能的 `triggers:` 前置元数据中，或将意图移动到正确的技能',
    weight: 1,
  },
  {
    id: 5,
    name: 'check_resolvable_clean',
    description: 'gbrain check-resolvable 为此包的解析器条目通过（MECE，无 DRY 违规，所有触发器到达技能）。针对 PACK-LOCAL 装置运行，不是环境工作空间。',
    check: async (pack) => runCheckResolvableIsolated(pack),
    fix_hint: '为缺少的技能添加解析器行，或移除孤立触发器',
    weight: 1,
  },
  // 注意 (codex 外部声音差距)：现有的 `check-resolvable`
  // 实现 (src/core/check-resolvable.ts) 合并来自 skillsDir AND 其父级的解析器文件
  // — 工作空间全局。包本地发布网关必须通过
  // 仅此包的解析器条目通过，不是发布者本地工作空间中安装的 whatever。
  // Doctor 和发布网关将 check-resolvable 包装在隔离的
  // 临时目录装置中，该装置仅包含此包的
  // RESOLVER.md 及其声明的 skills/，因此结果是包本地的。
  // 作为 `src/core/skillpack/check-resolvable-isolated.ts` 公开。
  {
    id: 6,
    name: 'unit_tests_present',
    description: '每个技能至少有一个导入它的单元测试 (test/**/*.test.ts)',
    check: async (pack) => everySkillHasUnitTest(pack),
    fix_hint: 'gbrain skillify scaffold 丢弃一个通过的 example.test.ts 你可以扩展',
    weight: 1,
  },
  {
    id: 7,
    name: 'llm_eval_present',
    description: '至少有一个 LLM-judge 评估在 evals/*.judge.json，具有 >= 3 个案例',
    check: async (pack) => hasLlmJudgeEval(pack, 3),
    fix_hint: 'gbrain skillify scaffold-eval <skill-name>',
    weight: 1,
  },
  {
    id: 8,
    name: 'install_runbook_present',
    description: 'runbooks/install.md 存在，解析，并且至少有一步',
    check: async (pack) => parseRunbook(pack, 'install'),
    fix_hint: 'gbrain skillpack init 重新生成存根；根据需要编辑',
    weight: 1,
  },
  {
    id: 9,
    name: 'uninstall_runbook_present',
    description: 'runbooks/uninstall.md 存在，解析，并且至少有一步',
    check: async (pack) => parseRunbook(pack, 'uninstall'),
    fix_hint: 'gbrain skillpack init 重新生成存根',
    weight: 1,
  },
  {
    id: 10,
    name: 'changelog_present_and_current',
    description: 'CHANGELOG.md 存在，包含 `## [<current-version>]` 条目，遵循 Keep-a-Changelog 形状',
    check: async (pack) => changelogReferencesVersion(pack),
    fix_hint: '添加 `## [<version>] - <YYYY-MM-DD>` 条目。使用 gbrain skillpack doctor --fix 从 VERSION + git log 自动生成。',
    weight: 1,
  },
];
```

**分数段：**

- `10/10` → **有资格获得背书** (与发布网关的 >=95% 测试+评估通过配对)
- `8-9` → **有资格获得社区层级**，doctor 打印丢失的粘贴就绪修复
- `5-7` → **仅限实验层级**，doctor 列出所需的修复
- `<5` → doctor 拒绝评分，打印"这还不是一个技能包 — 运行 `gbrain skillpack init` 并重试"

**2. 分层 doctor — `gbrain skillpack doctor`**

两种模式；代理根据工作流阶段选取哪一个：

```
gbrain skillpack doctor <pack-dir|tgz> [--quick|--full] [--fix] [--json]
```

- `--quick`（默认）：仅结构扫描。遍历评分标准。在 ~5 秒内。无沙箱，无 LLM，无 DB。在迭代期间是正确的命令 — 保存文件，运行 doctor，查看你的新分数。
- `--full`：等同于 `gbrain skillpack pack --dry-run` — 运行沙箱、测试、LLM-judge 评估、针对试验安装的路由评估、安全网关。在 ~ 分钟内。在调用发布技能之前是正确的命令。
- `--fix`：自动搭建缺少的碎片。为缺少的技能调用 `gbrain skillify scaffold`，从模板中丢弃运行手册存根，从 VERSION + git log 生成 CHANGELOG 条目。**对文件树具有破坏性**：打印 `"这将创建以下 N 个文件，继续？[y/N]"` 确认提示；非 TTY 需要显式 `--yes`。拒绝覆盖其 mtime 比清单 `modified-at` 更新的任何文件（"自上次清单更新以来用户手动编辑此文件"的启发式）。
- `--json`：代理使用的稳定 JSON 信封。

JSON 输出（代理契约）：

```json
{
  "schema_version": "skillpack-doctor-v1",
  "skillpack": "hackathon-evaluation",
  "version": "0.1.0",
  "mode": "quick",
  "score": 7,
  "max_score": 10,
  "tier_eligibility": "community-with-fixes",
  "dimensions": [
    {"id": 1, "name": "manifest_valid", "score": 1, "fix_hint": null},
    {"id": 7, "name": "llm_eval_present", "score": 0,
     "fix_hint": "gbrain skillify scaffold-eval <skill-name>",
     "auto_fixable": true}
  ],
  "next_action": "运行：gbrain skillpack doctor --fix 搭建 3 个缺少的碎片，然后重新运行。"
}
```

**代理指导**（住在 `docs/skillpack-anatomy.md` AND 在 `skills/_brain-filing-rules.md` 中）：

- 在包开发期间每次有意义的编辑之后：`gbrain skillpack doctor --quick --json`。在曾经调用 `pack --dry-run` 之前瞄准 10/10。
- 在发布之前：`gbrain skillpack doctor --full` 以捕获结构传递不能的内容。
- 如果 doctor 标记 `auto_fixable: true` 维度，代理运行 `gbrain skillpack doctor --fix --yes` 并重新运行 `--quick`。

**必需核心与质量徽章维度（codex 外部声音 T4）：**

根据 codex review 的存根垃圾邮件问题，评分标准拆分为**发布必需**（5 个维度，v1 楼层）和**质量徽章**（5 个维度，通过层级资格赢得它们）。具有 0 个徽章的包仍然作为 `experimental` 发布；它只是在注册表中显示可见的"无徽章"标志，以便消费者可以决定。

| 层级            | 必需核心（必须通过） | 徽章（必须通过赢得） |
|-----------------|---------------------------|--------------------|
| `experimental`  | 1, 2, 3, 5, 10            | 0                  |
| `community`     | 1, 2, 3, 5, 10            | + 至少 3 个 {4, 6, 7, 8, 9} |
| `endorsed`      | 1, 2, 3, 5, 10            | + 所有 {4, 6, 7, 8, 9} |

必需核心（5 个维度）：manifest_valid、skills_have_skill_md、routing_evals_present（每技能 >=5 个意图）、check_resolvable_clean、changelog_present_and_current。质量徽章（5 个维度）：routing_evals_clean（LLM-judge 层）、unit_tests_present、llm_eval_present、install_runbook_present、uninstall_runbook_present。

Doctor 仍然报告 10/10 分数（徽章是显示 + 层级网关，不是评分标准替换）。用空固件存根所有 5 个徽章的发布者在其注册表条目中获得可见的"存根评估检测到"标志（例如，评估中 0 个唯一断言字符串，或没有 `expect()` 调用的通过测试）。来自发布网关内容扫描的 Cathedral scaffold，来自 `gbrain skillpack init` 仍然默认丢弃所有 10 个维度；发布的楼层更低。

**3. Reference 包 + 解剖文档**

- `examples/skillpack-reference/` — 一个真实的、工作的 **10/10 包** 住在 gbrain 仓库中。兼作 doctor + 发布网关测试套件的集成测试装置。包括 2 个技能、2 个 routing-eval.jsonl 文件、3 个单元测试、1 个 LLM-judge 评估、完整运行手册集、CHANGELOG。 `bun run build` 包括 `cd examples/skillpack-reference && gbrain skillpack doctor --quick` 作为预提交断言，以便 reference 包永远不会回归。
- `docs/skillpack-anatomy.md` — 单页参考。树图 + 评分标准表 + 粘贴就绪命令。从 `src/core/skillpack/rubric.ts` 通过 `bun run build:skillpack-anatomy` 自动生成。图 + 树是手动策划的；评分标准表是机器生成的；CI 在生成的部分不同步时失败。

**4. 不变量：每个 gbrain 交付的技能包分数 10/10**

捆绑的 gbrain 技能包（今天的 `openclaw.plugin.json` 集，加上任何未来的包，如 `starter-pack`、`founder-pack`）必须在 `gbrain skillpack doctor --quick` 上分数 10/10。这是一个回归守卫，不是一个目标：

- `scripts/check-bundled-skillpacks-rubric.sh` 在 CI 和 `bun run verify` 中运行。遍历 gbrain 仓库交付的每个包并运行 `gbrain skillpack doctor --quick --json`，断言每个分数都是 10。
- 将捆绑包分数降低到 10 以下的新 gbrain 发布在回归时大声失败 CI。修复的成本是几个 `gbrain skillify scaffold` 调用；跳过的成本是 gbrain 交付 gbrain 对第三方要求的低于门槛的技能包 — 可信度毒药。
- 今天的 openclaw.plugin.json 集尚未达到 10/10（无每技能单元测试、无 LLM-judge 评估、无运行手册）。**将它带到 10/10 在范围内用于 v1 — wave W4.5**（在下面添加）。

### Scaffold：`gbrain skillpack init <name>`（大教堂默认值）

开箱即用完整的树。Scaffold 上的 `gbrain skillpack pack --dry-run` 立即通过；开发人员删除他们不需要的内容。

```
hackathon-evaluation/
├── skillpack.json                # 用存根 + 此版本填充
├── skills/
│   └── hackathon-evaluation/
│       ├── SKILL.md              # 前置元数据 + 示例触发器
│       └── routing-eval.jsonl    # 5 个示例意图
├── test/
│   └── example.test.ts           # 一个通过的单元测试，导入技能辅助程序
├── e2e/
│   └── example.e2e.test.ts       # 一个 E2E 骨架，如果无 DB 则标记跳过
├── evals/
│   └── hackathon-evaluation.judge.json  # 一个跨模态 LLM-judge 示例
├── runbooks/
│   ├── install.md                # 显示所有 3 种步骤类型的注释存根
│   ├── uninstall.md              # 注释存根
│   └── upgrade-template.md       # 首次版本碰撞时重命名为 upgrade-<from>-to-<to>.md
├── CHANGELOG.md                  # v0.1.0 条目预填充
├── README.md                     # 给人类
├── LICENSE                       # MIT 默认
└── .gitignore                    # tarball 输出、node_modules
```

 boiling-the-lake 默认。与 `gbrain init` 相同的模式，它播种配置 + 存储层级 + 入门源，而不是向用户询问 15 个问题。

### Slug 冲突：自动后缀，代理解决

代理是主要安装程序。强迫他们在每次冲突时在选择上添加摩擦而不会增加安全性。而是自动解决：

- **平面命名空间，冲突时自动后缀。** 当传入包运送已经由不同已安装源声明的 slug 时，安装程序将 `-2`（然后 `-3` 等）附加到传入 slug 并继续。大声 stderr 行：`[skillpack] 重命名 judge-submission → judge-submission-2（与 hackathon-judging 冲突）`。
- **后缀是持久的，不是装饰性的。** 重命名的 slug 进入源的每源 `cumulative-slugs` 回执 AND 兄弟 `rename-map="judge-submission:judge-submission-2,..."` 属性在源子标头中。卸载读取重命名映射并移除 `-2` 文件 + 行，永远不是原始的。
- **触发器（面向用户的路由表面） untouched。** Slug 是标识符；代理通过 SKILL.md `triggers:` 前置元数据和 RESOLVER.md 描述列路由。重命名的 slug 仍然匹配相同的用户输入短语。
- **保留后缀范围。** `-2..-99` 是自动重命名范围。以 `judge-submission-2` 作为其自己的规范名称创作的包（罕见）仍然安装良好；仅在裸名冲突时触发冲突逻辑，并且随后的 `judge-submission-2` 本身上的冲突遍历到 `-3`。冲突遍历以 `-99` 为界，并且在超出时大声失败（防御性上限；你不会运送 99 个具有相同 slug 的包）。

不需要在 `check-resolvable`、`routing-eval` 或 `filing-audit` 中进行更改 — 它们都解析它们看到的任何 slug，不需要命名空间。

### 安装状态：`~/.gbrain/skillpack-state.json`（codex G1）

DX-review-locked 设计有 TFOU SHA-256、固定提交、重命名映射和每源回执住在 RESOLVER.md 托管块内的 markdown 注释中。Codex 标记为脆弱的信任存储 — 任何代理或人类编辑到解析器文件都会静默破坏来源。v1 修复：**将人类可读行与机器拥有的状态拆分**。

- `~/.gbrain/skillpack-state.json`（机器拥有，代理可读）：
  TFOU SHA-256、固定提交、源 URL、重命名映射、安装时间戳、版本、tier_when_installed、背书-层级-安装时的单一事实来源。每个已安装源的一个条目。通过 `.tmp` + `rename()` 原子更新。在每次安装/卸载/更新时读取；解析器块从中渲染。
- 解析器块子标头（在 RESOLVER.md / AGENTS.md 中）仅携带人类可读的身份：`name`、`version`、`tier` 和累积 slug 列表（仍然需要卸载以知道在没有咨询 state.json 的情况下要移除什么 — 针对损坏的 state.json 的深度防御）。回执注释形状：
  `<!-- gbrain:skillpack:source name="..." version="..." tier="..." cumulative-slugs="..." -->`。
- state.json 与解析器块之间的不匹配（例如，解析器列出不在 state.json 中的源，或 state.json 的累积 slug 与渲染的行不同）在安装时大声失败，并拒绝进一步突变，直到通过 `gbrain skillpack reconcile` 调和。
- Schema：`skillpack-state.json` 具有 `schema_version: "gbrain-skillpack-state-v1"` 用于前向兼容；镜像安装程序.ts 累积 slug 回执演变故事。

### 解析器块：每源一个块

RESOLVER.md / AGENTS.md 中的托管块增长一个**源键控的**子部分标头，以便多个包可以在每次安装时重写整个块而共存。累积 slug 回执是每源的：

```markdown
<!-- gbrain:skillpack:begin -->
<!-- gbrain:skillpack:source name="gbrain" version="0.36.0.0" cumulative-slugs="ingest,query,..." -->
| ingest | ... |
| query  | ... |
<!-- gbrain:skillpack:source name="hackathon-evaluation" version="0.1.0" cumulative-slugs="judge-submission-2,score-rubric" pinned-commit="abc1234" rename-map="judge-submission:judge-submission-2" tofu-sha256="deadbeef..." -->
| judge-submission-2 | 针对 YC 评分标准判断黑客马拉松提交。 |
| score-rubric       | ... |
<!-- gbrain:skillpack:end -->
```

`tofu-sha256` 是解析的提交 SHA（git 源）或 tarball SHA-256（tarball 源）。重新安装/更新将新解析与记录的值进行比较；不匹配 = 重新提示（TTY）或在没有 `--update` 的情况下拒绝（非 TTY）。

每源回执意味着卸载一个包不会触及另一个包的 row 或 D11 哈希预算。

### 信任姿态

- **默认**：TOFU。给定仓库 URL 的首次安装通过 `AskUserQuestion` 等效 CLI 流提示（"你即将从 `<url>` 处的提交 `<sha>` 安装技能包 `<name>`。信任此源？"）。仅 TTY；非 TTY 需要显式 `--trust` 标志。
- **将提交 SHA 固定**到每源解析器回执中。重新安装/升级拒绝在没有用户同意的情况下静默推进 SHA（相同的提示或 `--update`）。
- **`--allow-private-remotes`** 标志通过管道传输到 `git-remote.ts` 的 `GBRAIN_ALLOW_PRIVATE_REMOTES` 以用于内部/Tailscale 技能包。
- 签名（minisign / cosign）是 v2 转义舱口；不在 v1 范围内。

### CLI 表面

```
gbrain skillpack install <source> [--update] [--trust] [--allow-private-remotes] [--dry-run] [--json]
gbrain skillpack list [--source <name>] [--json]
gbrain skillpack uninstall <name> [--overwrite-local] [--dry-run]
gbrain skillpack info <name>                 # 新：显示固定提交、作者、许可证、重命名
gbrain skillpack update [<name>] [--check]   # 新：检查上游提交
gbrain skillpack init <name>                 # 新：搭建发布者仓库
gbrain skillpack pack [--out <path>]         # 新：验证 + 发出 .tgz tarball
```

`<source>` 接受：
- `garrytan/repo` → `https://github.com/garrytan/repo.git`
- `https://github.com/.../...git` → 逐字，SSRF 检查
- `./path/to/pack.tgz` → tarball；解压到缓存，从树安装
- `./path/to/repo` → 本地文件系统目录（用于技能作者在本地测试；与今天的 `--skills-dir` 相同的信任姿态）

### 发布者工作流（"制作技能包"路径）

1. `gbrain skillpack init <name>` — 搭建 `skillpack.json` + `skills/` + `RESOLVER.md`（技能包内部）+ `.gitignore`。
2. 作者使用现有的 `gbrain skillify scaffold` 模式创作技能。
3. `gbrain skillpack pack --dry-run` — 运行完整的验证管道：
   - `skillpack.json` schema 检查
   - 每个列出的技能都有 SKILL.md + 有效前置元数据
   - `gbrain check-resolvable` 干净
   - `gbrain routing-eval` 干净（结构层）
   - 任何技能目录中没有禁止的文件类型（无 `.env`、`.ssh`、可执行文件）
   - 返回结构化的通过/失败 JSON
4. `git push` 以发布。分发是 git 远程。

## 要添加/修改的关键文件

### 新

- `src/core/skillpack/manifest-v1.ts` — `skillpack.json` 的 Zod 等效运行时验证器。拥有 `SkillpackManifest` 类型。
- `src/core/skillpack/remote-source.ts` — 为技能包用例包装 `git-remote.ts`：浅克隆到 `~/.gbrain/skillpack-cache/<host>/<owner>/<repo>/<sha>/` 下的缓存目录，解析 HEAD SHA，支持通过 `pullRepo` 更新。
- `src/core/skillpack/tarball.ts` — `packTarball(dir, outPath)` + `extractTarball(tgzPath, cacheDir)`。Tar 条目通过允许列表验证（无符号链接、无可执行文件、无遍历）。SHA-256 在 gzip 输出上计算用于 TFOU 固定。
  **确定性 tarball 规范（codex 外部声音差距）：** 仅当 tarball 是字节确定性的时，SHA-256 才稳定。打包器强制：（a）条目按路径排序（字典）、（b）所有 mtime 固定到 `1970-01-01T00:00:00Z`（或如果可用则为提交的 mtime，但可重现）、（c）uid=0/gid=0，模式规范化（文件为 0644，目录为 0755），无 pax 标头，（d）带有 `mtime=0` 的 gzip，无 original-filename 标头。在解压时拒绝：符号链接、硬链接、设备文件、FIFO、任何非正则非目录条目。解压时上限：最多 5000 个文件、最多 100MB 解压总计、每个文件最多 1MB、最大路径长度 255 个字符、最大压缩比 100:1（压缩炸弹防御）。由 `test/skillpack-tarball-determinism.test.ts` 固定（在不同日期两次打包同一目录 → 相同的 SHA）。
- `src/core/skillpack/collision-resolver.ts` — 纯函数 `resolveSlugCollisions(incoming: string[], existing: Set<string>): { finalSlugs: string[], renameMap: Record<string,string> }`。以 `-99` 为界的遍历。由单元测试固定。
- `src/core/skillpack/multi-source-receipt.ts` — 解析 + 序列化每源解析器块子标头。纯函数；由测试固定。
- `src/core/skillpack/trust-prompt.ts` — TOFU 提示 + TTY/非 TTY 分支。镜像 v0.32.4 安装选择器提示形状。
- `src/core/skillpack/registry-client.ts` — 通过 HTTPS 获取 + 缓存实时 `registry.json`。使用 `If-None-Match` etag 进行廉价轮询。在使用前验证 schema。缓存在 `~/.gbrain/skillpack-cache/registry-<sha256-of-url>.json` 下，具有 1 小时软 TTL。
  **离线安全**：在获取失败时（网络关闭、GitHub 5xx、DNS 未命中），回退到磁盘上的缓存并发出每个进程的单行 stderr：
  `[skillpack] 注册表获取失败，使用来自 <fetched_at> 的缓存（N 小时前）`。如果缓存 >7 天前，警告升级为 `cache is stale, run 'gbrain skillpack registry --refresh' when back online`。仅在根本没有缓存时（首次运行 + 离线）硬失败。`--no-cache` 标志强制网络并在未命中时大声失败。缓存文件的 `fetched_at` 是挂钟时间；时钟偏移不是问题，因为我们从不将缓存的 fetched_at 与注册表的 `updated_at` 比较以获取新鲜度 — 仅针对年龄显示的当前挂钟。
- `src/core/skillpack/registry-schema.ts` — `registry.json` + `endorsements.json` 形状的运行时验证器。由 `gbrain skillpack search` 和发布网关技能使用的单一事实来源。
- `src/core/skillpack/sandbox.ts` — **子进程隔离的**试验安装工具，具有每平台回退链。
  - **Linux**：`bwrap → unshare → docker`。首先尝试 `bwrap`（bubblewrap）— 最可移植的，在每个最近的发行版仓库上，~100ms 启动。当 bwrap 缺失但内核允许非特权用户命名空间时，回退到 `unshare --net + --mount`（覆盖库存 Debian/Ubuntu/Arch）。回退到 `docker run --rm --network=none --volume <tempdir>:/work --workdir /work` 用于 RHEL/Rocky/CentOS，其中非特权 userns 被 sysctl 禁用。纯树：没有 bwrap AND 没有 docker 的最小 Linux 镜像 — 大声失败，并带有粘贴就绪的 apt/yum 安装提示。
  - **macOS**：`sandbox-exec → docker`。首先尝试 Apple 内置的 `sandbox-exec`，带有每发布 `.sb` 配置文件（文件系统写入限制在 tempdir，网络拒绝，无 IPC）。~50ms 启动。仅当 `sandbox-exec` 不可用时才回退到 Docker Desktop（罕见；Apple 保持弃用它但还没有拉它）。没有 Docker 的 macOS 发布者仍然可以通过 sandbox-exec 发布。
  - 在沙箱内，临时内存中 PGLite gbrain 运行试验安装，重用来自 `src/eval/longmemeval/harness.ts` 的模式。公开 `runTrialInstall(packPath, opts): Promise<TrialResult>` 由发布网关使用。
  - Bun 的带有选定后端包装器 argv 的 `child_process` spawn；中止信号杀死包装器，该包装器级联到子级。
  - **Env 清理（codex G2）：** 生成的进程继承 CLEAN 环境（仅 `PATH`、`LANG`、`TZ` 通过）。显式剥离：`GITHUB_TOKEN`、`GH_TOKEN`、`OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、`VOYAGE_API_KEY`、`GROQ_API_KEY`、所有 `*_API_KEY` / `*_TOKEN` / `*_SECRET` 变量、`SSH_AUTH_SOCK`、`SSH_AGENT_PID`、`GIT_*`（无 GIT_ASKPASS，无 GIT_SSH）、`NPM_TOKEN`、`BUN_INSTALL_TOKEN`，加上在 `src/core/skillpack/sandbox-env.ts` 中定义为纯函数常量的显式拒绝列表。
  - **HOME 覆盖**：`HOME=<tempdir>/sandbox-home`（空目录）。副作用：无 `~/.gbrain` 访问，无 `~/.gitconfig`（凭据帮助程序禁用），无 `~/.netrc`，无 `~/.npmrc`，无 `~/.bunfig.toml`。发布网关的 PGLite + LLM-judge stub 已经被设计为不需要真实凭据；这只是强制执行它。
  - **只读挂载**（bwrap / docker；sandbox-exec 使用拒绝写入配置文件）：仅打包临时目录是可读写的；每个其他路径是只读的或未挂载的。`/proc` 在 bwrap 支持它的地方被屏蔽（`--proc /proc --new-session`）。
  - 由 `test/skillpack-sandbox-env-scrub.test.ts` 固定：8 个案例断言每个已知凭据 env 变量被剥离，HOME 被覆盖，拒绝列表常量与测试装置匹配。
- `src/core/skillpack/sandbox-profiles/macos.sb` — sandbox-exec 策略文件（仅允许在 `${TEMPDIR}` 内读取/写入，拒绝网络，拒绝除了 Bun 需要启动的最小集之外的进程 fork，拒绝除了 Bun 需要启动的最小集之外的 mach lookup）。
- `src/core/skillpack/sandbox-probe.ts` — 预检：检测哪个沙箱后端可用，按顺序。发出结构化的 `SandboxBackend = 'bwrap' | 'unshare' | 'sandbox-exec' | 'docker' | 'none'` 鉴别器。后端选择在每个进程中持久化（避免在每个试验上重新探测）。`gbrain doctor` 将选择的后端作为信息表面。
- `src/core/skillpack/security-gates.ts` — 静态分析管道。`runShellcheck(files)`（如果安装了 shellcheck 则 shell 出来；否则降级到内置正则表达式传递，在不匹配时命名 offending 模式）、`scanForbiddenFiletypes(tree)`、`validateExternalResources(skill)`、`checkFrontmatter(skill)`。每个都返回结构化的发现。
- `src/commands/skillpack-init.ts` — `gbrain skillpack init <name>` 搭建命令。
- `src/commands/skillpack-pack.ts` — `gbrain skillpack pack` 验证器 AND tarball 发射器。单个命令，`--dry-run` 跳过 tarball。
- `src/commands/skillpack-info.ts` + `skillpack-update.ts`。
- `src/commands/skillpack-search.ts` — `gbrain skillpack search <query> [--tier ...] [--json]` 读取注册表，按层级然后标签匹配排名，打印表格。
- `src/commands/skillpack-registry.ts` — `gbrain skillpack registry [--url X] [--refresh]` 显示/设置配置的注册表 URL，可选择强制新鲜获取。
- `src/commands/skillpack-endorse.ts` — `gbrain skillpack endorse <name> [--tier endorsed|community|experimental] [--push] [--dry-run]`。在注册表仓库的克隆中运行；使用 schema 验证验证 `<name>` 针对 `registry.json`；读取、更新、schema 验证并写入带有稳定键排序的 `endorsements.json`；使用单线常规提交消息 `endorse: <name> -> <tier>` stage + 提交；可选地推送。如果不在注册表形状的仓库内，则拒绝。
- `src/core/skillpack/runbook-parser.ts` — 解析 `runbooks/install.md`、`uninstall.md` 和 `upgrade-*.md` 文件。验证前置元数据（`runbook_kind`、`gbrain_version_range`、`skillpack`、`skillpack_version`，加上用于升级的 `from_version`/`to_version`）。将每个编号步骤标记为三种类型之一：`agent:` / `show user:` / `ask user:`。返回强类型的 `Runbook` 值。纯函数；由具有格式错误的运行手册装置的单元测试固定。
- `src/core/skillpack/runbook-walker.ts` — 针对调用上下文执行解析的运行手册。分派每个步骤类型：`agent:` 运行 gbrain CLI 子命令（仅 gbrain CLI；不是任意 shell）；`show user:` 写入 stdout；`ask user:` 在 TTY 确认上阻塞（非 TTY 需要 `--yes` 标志并拒绝确认步骤导致失败）。返回结构化的 `RunbookResult`，以便调用者可以看到哪些步骤运行了。测试接缝：`opts.shellTransport` 让测试在没有真实子进程 spawn 的情况下驱动。
- `src/core/skillpack/upgrade-planner.ts` — 给定解析器回执的记录的包的 `skillpack_version` 和新版本的 `upgrade-*.md` 集，计算升级遍历路径（例如，v0.1 → v0.3 可能遍历 `upgrade-0.1-to-0.2.md` 然后 `upgrade-0.2-to-0.3.md`）。如果没有路径存在则拒绝；拒绝静默降级；纯函数。
- `src/commands/skillpack-test.ts` — `gbrain skillpack test [pack-dir]` 在发布网关之外运行发布者端完整测试+评估套件，以便发布者可以在调用发布技能之前快速迭代。真实网关（发布者在他们的机器上支付真实 LLM 成本，不是发布网关）。输出与发布网关的验证日志使用的相同的 JSON 形状，以便发布者准确地看到网关将看到的内容。
- `src/commands/skillpack-init.ts`（从早期部分扩展范围）— 搭建上面的完整大教堂树。`--minimal` 标志为明确选择退出的强大用户丢弃 test/、e2e/、evals/。
- `src/core/skillpack/rubric.ts` — 声明式的 `SKILLPACK_RUBRIC_V1` 数组 `RubricDimension`（参见上面的 schema）。纯数据 + 检查函数，它们接受解析的包并返回 `{ passed: boolean, detail: string }`。Doctor + 解剖文档 + 测试的单一事实来源。
- `src/core/skillpack/doctor.ts` — `runDoctor(pack, opts: {mode: 'quick' | 'full', fix: boolean, autoYes: boolean}): Promise<DoctorResult>`。遍历评分标准，分派每个检查，计算分数 + 层级资格，发出粘贴就绪的修复。 `--fix` 路径分派每维度自动搭建（为缺少的技能调用 `gbrain skillify scaffold`，从模板中丢弃运行手册存根，从 VERSION + git log 生成 CHANGELOG 条目）。拒绝覆盖其 mtime 比 `skillpack.json` 的 mtime 更新的文件（"自上次清单更新以来手动编辑此文件"的启发式）。
- `src/commands/skillpack-doctor.ts` — CLI 包装器。读取标志，解析包（文件或目录或 tarball），调用 `runDoctor`，格式化 JSON 或人类输出。退出代码：如果 score=10 则为 0，如果 score 6-9 则为 1，如果 score 0-5 或拒绝则为 2。
- `scripts/build-skillpack-anatomy.ts` — 从 `src/core/skillpack/rubric.ts` 生成 `docs/skillpack-anatomy.md` 的评分标准表部分。 `bun run build:skillpack-anatomy`。CI 守卫 `scripts/check-anatomy-fresh.sh` 在 `verify` 中运行以检测评分标准与提交文档之间的漂移。
- `scripts/check-bundled-skillpacks-rubric.sh` — CI 守卫。遍历 gbrain 仓库交付的每个包（今天：`openclaw.plugin.json` 集；未来：任何 `examples/skillpack-*` 和任何捆绑的入门包），针对每个运行 `gbrain skillpack doctor --quick --json`，断言每个分数都是 10。在回归时大声失败构建。接入 `package.json` 的 `verify` 脚本。

### 新（在 github.com/garrytan/gbrain 仓库中，示例 + 文档）

- `examples/skillpack-reference/` — 一个真实的、工作的 **10/10 reference 技能包** 住在 gbrain 仓库中。两个技能、2 个 routing-eval.jsonl 文件（每个 5 个意图）、3 个单元测试、1 个 LLM-judge 评估（3 个案例）、完整运行手册集（安装/卸载/升级模板）、CHANGELOG、README、LICENSE。Reference 包是 doctor + 发布网关完整套件 E2E 测试的集成测试装置，AND 它是 `gbrain skillpack doctor --quick` 针对其进行回归测试的内容。
- `docs/skillpack-anatomy.md` — 单页代理 + 人类参考。包含：（a）大教堂搭建的树图，（b）从 `rubric.ts` 自动生成的评分标准表，（c）从 `init` → `doctor --quick` → `doctor --fix` → `pack --dry-run` → `publish` 的每步的粘贴就绪命令。自动生成的标头 + 手动散文 + 自动生成的评分标准正文；标记块守卫生成的部分。
- `src/core/skillpack/audit.ts` — JSONL 审计在 `~/.gbrain/audit/skillpack-YYYY-Www.jsonl`（ISO 周轮换，镜像 `src/core/audit-slug-fallback.ts` + `src/core/rerank-audit.ts`）。`logSkillpackEvent({event, source_kind, name, version, pinned_commit, tier_when_installed, outcome, error?})` 由安装/卸载/更新/搜索解析路径调用。最大努力 — 从不抛出，在写入失败时记录 stderr 警告。`readRecentSkillpackEvents(days)` 是 `gbrain doctor` 的新 `skillpack_activity` 检查的读回路径（信息级："在过去 7 天内安装了 N 个包，都来自背书层级"或"在过去的 24 小时内安装了 2 个社区层级包 — 在 <audit-path> 处查看"）。
- `skills/gbrain-skillpack-publish/SKILL.md` — 发布网关技能本身。住在捆绑的技能包中，以便每个 gbrain 安装都附带它。引导贡献者通过：
  1. 本地验证 (`gbrain skillpack pack --dry-run`)
  2. 运行安全网关
  3. 打包 tarball + 计算 SHA
  4. Fork `garrytan/gbrain-skillpack-registry`（如果需要）（`gh repo fork`）
  5. 分支，附加目录条目，提交验证运行 JSON
  6. 推送 + 通过 `gh pr create` 打开 PR
  7. 打印 PR URL 并提醒贡献者"Garry 单独背书；回头查看层级翻转。"

### 新（在 github.com/garrytan/gbrain-skillpack-registry 中，单独的仓库）

- `registry.json` — 目录（上面的 schema）
- `endorsements.json` — 仅限 Garry 的文件，控制 `endorsed` 层级
- `validation-runs/<run-id>.json` — 每次发布验证一个文件，不可变，内容可寻址。任何审计技能包的人都可以拉取相应的运行 JSON。
- `tarballs/<name>-<version>.tgz` — 注册表镜像的 tarball，在 PR 合并时由 CI 写入作为持久副本。每个 tarball 由 `registry.json` 中已经记录的 SHA-256 进行内容寻址。Tarball 使用 **git LFS** 以保持注册表克隆小（1GB 注册表克隆将是痛苦的）。每包软上限 5MB；大于 5MB 的包存储为仅链接（注册表条目记录 `source_only: true` 标志并跳过 tarball 镜像）。
- **CI 持久性作业**（`.github/workflows/mirror-tarball.yml`）：在每个 PR 合并时，克隆新条目的固定提交，重新生成 tarball，验证它与注册表记录的 SHA-256 匹配，然后提交到 `tarballs/`。 belt-and-suspenders：如果源仓库 SHA 在 PR 时是说谎，镜像作业会大声失败并且注册表条目被还原。
- **CI 存活性作业**（`.github/workflows/liveness-check.yml`）：每周，遍历每个注册表条目并验证源 URL 仍然解析到固定的提交。不可达的条目获得 `last_alive: <date>` 字段，但 NOT 自动墓碑化 — Garry 决定是否弃用。
- `README.md` — 解释层级系统，链接到发布技能，记录如何 fork + 提交
- **两工作流 CI 拆分（codex G3）** — 注册表端 CI 将静态仅 PR 验证与任何危险执行分开：
  - `.github/workflows/validate-pr.yml` 在 **`pull_request`** 上运行（不是 `pull_request_target`）。权限：`contents: read, pull-requests: read` 仅。无 GitHub 令牌写入范围，无 LFS 写入，无仓库 PAT。执行：清单 schema 检查、文件类型允许列表扫描、与 `registry.json` 的 slug 唯一性、依赖声明检查。纯静态。无法渗出任何东西，因为它没有东西可以渗出。
  - `.github/workflows/post-merge-validate.yml` 在 `push` 到 `main` 上运行，具有新条目的提交。权限：`contents: write`（仅用于新的 tarball）。在注册表自己的沙箱内执行发布网关的测试 + LLM-judge-stub + 路由评估套件（相同 `bwrap`/`sandbox-exec` 配置文件 above；相同的 env-crub 姿态）。如果验证在合并后失败，工作流会打开一个跟进 PR 还原注册表条目并发布一个命名失败的评论。慢路径但隔离。
  - `.github/workflows/mirror-tarball.yml`（第三个工作流）：在 `post-merge-validate.yml` 通过后运行，具有 **deploy key**，范围限定为仅 `tarballs/`。提交 SHA-256 验证的 tarball。无法写入 `registry.json`、`endorsements.json` 或 `tarballs/` 之外的任何内容。
  - 标准供应链姿态：PR 时 = 静态，从不执行贡献者代码。合并后 = 隔离，从不具有特权令牌。镜像提交 = 最小特权部署密钥。
- `bundles.json`（或 `registry.json` 中的 `bundles` 部分）— 命名的包，如 `starter-pack`、`founder-pack`、`journalist-pack`
- `test/skillpack-manifest-v1.test.ts`、
  `test/skillpack-multi-source-receipt.test.ts`、
  `test/skillpack-remote-source.test.ts`、
  `test/skillpack-collision-resolver.test.ts`（覆盖 `-2` 遍历、包创作的 `-2` 角落案例、`-99` 上限）、
  `test/skillpack-tarball.test.ts`（往返、允许列表强制执行、符号链接拒绝、SHA-256 稳定性）、
  `test/skillpack-pack.test.ts`、
  `test/skillpack-registry-client.test.ts`（etag 处理、schema 拒绝格式错误注册表、陈旧缓存行为、网络关闭正常回退到最后一个好缓存）、
  `test/skillpack-registry-schema.test.ts`（每个层级有效、缺少必需字段被捕获、未知层级被拒绝）、
  `test/skillpack-search.test.ts`（层级排序、标签排名、JSON 形状）、
  `test/skillpack-sandbox.test.ts`（试验安装创建 + 拆下 PGLite 干净地、网络禁用断言触发）、
  `test/skillpack-security-gates.test.ts`（禁止的文件类型被捕获、shellcheck 路径 AND 回退正则表达式路径都工作、external_resources 声明强制执行）、
  `test/e2e/skillpack-third-party.test.ts`（仅 PGLite，不需要 `DATABASE_URL`；使用本地文件系统源装置 AND 本地 tarball 源装置，以便两个安装路径都被固定）、
  `test/e2e/skillpack-registry-install.test.ts`（仅 PGLite；通过 localhost HTTP 工具服务装置 `registry.json`，通过短名称安装，断言正确的包落地；覆盖缺少包名错误路径和陈旧 pin 错误路径）、
  `test/skillpack-publish-preflight.test.ts`（T-GAP-1 from eng review：`gh not installed` AND `gh not authed` 都表面可操作的错误，并带有粘贴就绪的安装/登录命令）、
  `test/skillpack-sandbox-network-block.test.ts`（T-GAP-2 from eng review：沙箱内的合成包尝试 `fetch(...)` 和 `https.request(...)` — 两者都必须被选定的后端拒绝。针对测试主机可以启动的每个沙箱后端运行；在后端不可用时优雅地跳过）、
  `test/e2e/skillpack-bundle-atomicity.test.ts`（T-GAP-3 from eng review：具有合成失败的包 #3 的 5 包入门包装置；断言每包独立的契约 — 包 1-2 落地，包 3 报告失败，包 4-5 跳过，打印重试提示，托管块仅用于包 1-2 完整）、
  `test/skillpack-uninstall-renamed.test.ts`（T-GAP-4 from eng review：安装带有 `judge-submission` 的包 A，安装通过重命名映射自动重命名为 `judge-submission-2` 的包 B。卸载包 B 并断言它移除 `-2` 行，不是裸名行。然后卸载包 A 并断言干净状态）、
  `test/skillpack-runbook-parser.test.ts`（前置元数据验证、三种步骤类型正确解析、格式错误的运行手册大声失败、升级运行手册前置元数据需要 from_version + to_version）、
  `test/skillpack-runbook-walker.test.ts`（每个步骤类型分派到正确的处理程序；`ask user:` 在非 TTY 上尊重 --yes；被拒绝的确认停止遍历并报告哪个步骤被拒绝；代理步骤失败停止遍历并表面失败的 CLI 退出代码）、
  `test/skillpack-upgrade-planner.test.ts`（单跳路径 v0.1->v0.2；多跳路径 v0.1->v0.2->v0.3；在没有路径存在时拒绝；拒绝静默降级）、
  `test/skillpack-coverage-score.test.ts`（层级资格数学：背书需要路由 + 运行手册 + >=95%；社区需要路由 + 安装 + >=80%；其他一切都落到 experimental）、
  `test/e2e/skillpack-publish-gate-full-suite.test.ts`（仅 PGLite；具有声明的单元测试 + LLM-judge 评估 + 路由评估的合成包，发布网关在带有 stubbed 网关的沙箱内运行套件，产生带有覆盖率分数的验证日志，层级分配匹配预期）、
  `test/skillpack-rubric.test.ts`（`SKILLPACK_RUBRIC_V1` 中的每个维度都有一个检查函数，该函数返回 `{passed, detail}`；纯函数测试针对单独通过/失败每个维度的装置包 + 同时触发所有 10 个修复的已知坏包）、
  `test/skillpack-doctor-quick.test.ts`（`--quick` 模式在 reference 包上在 < 1s 内运行；产生稳定的 JSON 信封；拒绝分数 < 5；每段的退出代码正确）、
  `test/skillpack-doctor-fix.test.ts`（`--fix` 搭建缺少的碎片；尊重 mtime-vs-manifest 启发式并拒绝覆盖手动编辑的文件；在 TTY 上触发确认提示；`--yes` 跳过它；没有 `--yes` 的非 TTY 拒绝）、
  `test/e2e/skillpack-reference-is-ten.test.ts`（回归守卫：`gbrain skillpack doctor --quick --json examples/skillpack-reference` 总是分数 10/10；如果未来的 PR 将 reference 包降低到 10 以下，此测试会大声失败并且 CI 拒绝）、
  `test/skillpack-anatomy-fresh.test.ts`（断言 `scripts/check-anatomy-fresh.sh` 通过：来自 `docs/skillpack-anatomy.md` 的评分标准部分匹配 `bun run build:skillpack-anatomy` 将从当前 rubric.ts 发出的内容；未来编辑评分标准而没有 doc-reg 在构建时失败）。

### 修改

- `src/commands/skillpack.ts` — 扩展 `install` 以根据源形状分派（捆绑 vs `owner/repo` vs URL vs 本地路径）。
- `src/core/skillpack/installer.ts` — 线程化 `source: {name, version, pinnedCommit?}` 鉴别器通过 `applyInstall` / `applyUninstall`。读取 + 写入每源托管子块。
- `src/core/skillpack/bundle.ts` — 接受今天的 `openclaw.plugin.json` 形状 OR 新的 `skillpack.json`，在内部规范化，以便管道的其余部分不关心。
- `src/commands/skillpack-check.ts` — 表面每源健康状况在代理可读的报告中。
- `CLAUDE.md` 关键文件部分。
- 新的 `docs/skillpack-authoring.md` — 给发布者（不是营销文档；参考文档）的人类可读规范。
- `docs/skillpack-distribution.md` — 注册表形状讨论 + 版本控制策略。

## 验证

端到端：

1. **发布者路径**：在临时目录中 `gbrain skillpack init hackathon-evaluation` → 添加合成技能 → `gbrain skillpack pack --dry-run` → 预期通过。
2. **从本地路径安装**：在新鲜工作空间中 `gbrain skillpack install <tempdir>` → 解析器块显示新源子块 → `gbrain check-resolvable` 干净。
3. **从 git 安装**（E2E，可选）：克隆已知良好的公共示例仓库 → 相同的断言。
4. **多包共存**：将捆绑的 gbrain 集 AND 示例技能包安装到相同的工作空间中 → 两个 row 存在于托管块中，没有一个的累积 slug 回执触及另一个。
5. **冲突自动重命名**：安装运送已经存在的 slug (`judge-submission`) 的第二个包 → 安装程序自动后缀到 `judge-submission-2`，发出 stderr 行，在源回执中记录重命名。触发器仍然匹配相同的用户输入短语。
6. **卸载安全**：编辑第三方包中的一个技能文件 → `gbrain skillpack uninstall hackathon-evaluation` → 在没有 `--overwrite-local` 的情况下拒绝（D11 契约跨源成立）。
7. **TOFU**：新 URL 的首次安装提示；相同的 URL + SHA 的第二次安装不提示。
8. **注册表解析**：针对 localhost 服务的装置 `registry.json` 的 `gbrain skillpack install hackathon-evaluation` 解析正确的 git URL，验证固定的提交，落地包。Pin 不匹配产生大声的拒绝。
9. **搜索**：`gbrain skillpack search yc --json` 返回条目，`endorsed` 层级在 `community` 之前排序，在 `experimental` 之前排序。
10. **包安装**：`gbrain skillpack install starter-pack` 按顺序遍历包列表；中途包失败干净地展开，没有半安装的条目在托管块中。
11. **发布网关（沙箱）**：具有禁止文件类型 (`.env`) 的合成技能包 AND 具有恶意 shell 脚本的合成包都被发布网关拒绝。干净的包通过每个网关并产生 tarball + SHA + 准备好 PR 的验证日志。
12. **试验安装沙箱隔离**：发布网关旋转的次级 PGLite 不触及 `~/.gbrain`。拆下是干净的 — 没有文件制品，没有留下的 DB 连接。
13. **运行手册执行端到端**：`gbrain skillpack install hackathon-evaluation` 落地包 AND 逐步遍历 `runbooks/install.md`。每个 `agent:` 步骤运行；每个 `show user:` 步骤打印；每个 `ask user:` 步骤在 TTY 确认上阻塞或尊重 `--yes`。失败的代理步骤停止遍历并表面失败的命令。
14. **升级遍历多跳**：安装包@v0.1，发布 v0.2 带有 `upgrade-0.1-to-0.2.md`，然后 v0.3 带有 `upgrade-0.2-to-0.3.md`。直接从 v0.1 升级到 v0.3 按顺序遍历两个运行手册。记录的版本与可用运行手册之间的不匹配大声失败，并带有粘贴就绪的修复。
15. **层级资格**：具有路由评估 + 运行手册 + 100% 通过的包获得 `endorsed` 资格；具有相同评估失败的相同包下降到 `community`；没有路由评估的包不管其他覆盖率如何都下降到 `experimental`。
16. **`gbrain skillpack test`** 针对新鲜搭建的包运行并退出 0（搭建的示例测试开箱即通过，示例 LLM-judge 评估在设置了 `ANTHROPIC_API_KEY` 时通过真实网关通过，并且 `--no-llm` 干净地跳过 LLM-judge 路径）。

测试：

- 所有单元测试通过：`bun run test`
- E2E 网关：`bun run test:e2e`（Tier 1，无 API 密钥）
- 类型检查干净：`bun run typecheck`
- `scripts/check-test-isolation.sh` 干净（没有新的允许列表条目）

## 范围外（推迟）

- 加密签名（minisign / cosign / Sigstore）。注册表的 content-hash pin + Garry 控制的背书文件是 v1 信任姿态；签名是顶部的 v2 层。
- 技能包之间的依赖关系解析（`包 A 依赖于包 B`）。v1 将依赖关系声明为仅信息性元数据。
- 比 `gbrain_min_version` 更丰富的版本控制（无 semver 范围匹配，无 `^0.36`）。
- 自动更新/后台拉取。`gbrain skillpack update` 是手动的。
- 中央 Web UI (gbrain.dev/skillpacks)。注册表仓库的 GitHub 页面在 v1 中是 Web UI。
- 支付/货币化。技能包默认是免费/开源的。
- 针对 gbrain HTTP MCP 的 Print-press CLI 生成 — 根据 Q2 明确在范围内，但在此处列出以清晰：它是一个单独的为期一周的工作，住在兄弟分支中，不阻止 v1 注册表交付。

每个推迟的项目是 v1 设计之上的附加层；没有一个对"Garry 交付黑客马拉松评估技能包，让它在注册表中列出，并且有人发现 + 安装它"是承载的。

## 排序 — 按什么顺序交付

六个离散波。每个独立落地；后来的波不阻止更早的波交付价值：

1. **W1：单包安装** — 清单 schema、tarball 打包、从 git URL / tarball / 本地路径安装、多源解析器块、自动重命名冲突解决器、TOFU 提示 + 提交固定。交付楼层：Garry 今天可以手动分发黑客马拉松评估。
2. **W2：注册表目录** — 创建 `garrytan/gbrain-skillpack-registry`，`registry.json` schema + endorsements.json，带有陈旧缓存回退的注册表客户端，`gbrain skillpack search` + `install <short-name>` + `info`。初始目录用捆绑的 gbrain 技能和黑客马拉松评估 + 可能一个社区包种子。
3. **W3：发布网关技能** — `/gbrain-skillpack-publish` 技能、安全网关模块、sandbox-probe、带有 macOS 上 Docker 回退的子进程隔离试验安装。贡献者流从"fork + 提交 + 希望"到"运行一个技能，获得 PR。"
4. **W4：审计 + doctor 集成** — `~/.gbrain/audit/skillpack-*` JSONL，`gbrain doctor` 检查，`gbrain skillpack history` 读取器。
5. **W5：Printing Press 交叉列表** — 打开针对 `mvanhorn/printing-press-library` 的 PR，列出 `garrytan/gbrain-skillpack-registry` 作为姐妹注册表。~1 天。
6. **W6：生成的 gbrain-cli (Printing Press)** — 针对 gbrain 的 HTTP MCP 运行 printing-press，将产生的代理原生 CLI 交付到他们的库。独立的工作周；不阻止 W1-W5。

**W4.5 — 将捆绑的 gbrain 技能包带到 10/10**（在 W4 和 W5 之间丢弃，在 W3 的 doctor + 评分标准上阻塞）。当前的 `openclaw.plugin.json` 集缺少每技能单元测试（大多数从 v0.19 开始已经有 routing-eval.jsonl，缺少 LLM-judge 评估和每技能运行手册）。CI 守卫 `scripts/check-bundled-skillpacks-rubric.sh` 将在每个交付的包分数 10 之前失败构建。工作量：人类 ~3 天 / CC ~3 小时跨越约 25 个捆绑的技能。Doctor 的 `--fix` 自动搭建将此减少到大部分"审查自动生成的存根并填入散文。"

W1 是"Garry 可以交付黑客马拉松评估"的楼层。W2 是"任何人都可以在不读取 Garry 的 README 的情况下发现它"的楼层。W3 是"任何人都可以在不手动运行 git 的情况下发布"的楼层。W4-W6 是工作系统上的质量层。

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR (PLAN) | 6 proposals, 6 accepted, 0 deferred; EXPANSION mode |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 3 arch + 1 quality + 4 test-gap findings; 5 decisions locked |
| DX Review | `/plan-devex-review` | Developer experience gaps | 2 | CLEAR (PLAN) | 8 decisions across 2 rounds: artifact cathedral + rubric/doctor/anatomy + 10/10 bundled invariant |
| Codex Review | `/codex` plan-consult | Independent 2nd opinion | 1 | ISSUES_FOUND → INCORPORATED | 20 findings; 8 surfaced as tensions/gaps; 6 adopted (T1 + T4 + G1-G4); 2 cathedral defenses held (T2 scope, T3 10/10 invariant); 3 trailing correctness fixes folded in |

**Eng-review decisions locked this run:**
1. **Linux sandbox chain**: `bwrap → unshare --net → docker`. bwrap preferred (most portable, ~100ms); unshare covers stock kernels; docker as heavyweight fallback for RHEL/Rocky/CentOS where unprivileged userns is disabled.
2. **macOS sandbox**: `sandbox-exec → docker`. Apple's built-in `sandbox-exec` is the primary path (~50ms, no Docker dep); Docker is the rare fallback. macOS publishers without Docker can still publish.
3. **Bundle install atomicity**: per-pack independent (option γ). Failures inside a bundle leave earlier successful packs installed, skip later packs, print a summary with retry hint.
4. **Deleted source repo durability**: registry CI mirrors tarballs to `tarballs/<name>-<version>.tgz` via git LFS at PR merge time. 5MB per-pack cap; larger packs flagged `source_only: true`.
5. **Endorsement workflow**: `gbrain skillpack endorse <name> [--tier ...] [--push]` CLI command with schema validation; hand-editing remains valid.

**Eng-review findings (resolved by the 5 decisions above):**
- A1: Linux sandbox fallback chain underspecified → locked (#1).
- A2: Docker-on-macOS as a contributor cliff → locked (#2, sandbox-exec preferred).
- A3: Registry source-repo-deleted doom path → locked (#4, tarball mirror).
- C1: Bundle install atomicity unspecified → locked (#3).
- E1: Endorsement workflow unspecified → locked (#5).

**Test coverage:** 31/35 paths planned (~89%) before this review. Four gaps added to the plan as required tests before implementation:
- T-GAP-1: `gh` not-installed / not-authed branches in the publish skill.
- T-GAP-2: sandbox network-block assertion (fetch + https.request both rejected) across every backend the host can spin up.
- T-GAP-3: starter-pack bundle mid-failure (5-pack fixture, pack-3 fails) → per-pack-independent contract verified.
- T-GAP-4: uninstall a pack whose slug was auto-renamed via the rename map → `-2` row removed, not bare-name.

**Failure modes:** 0 critical gaps. Every new codepath is tested, rescued, AND user-visible. The collision-rename rollback path was the only silent-failure candidate; T-GAP-4 closes it.

**Worktree parallelization:** 6 lanes mapped via the W1–W6 sequencing in the plan.
- Lane A (W1: single-pack install): manifest, tarball, collision-resolver, multi-source-receipt, install paths. Sequential; shared `src/core/skillpack/` namespace.
- Lane B (W2: registry catalog): registry-client, registry-schema, search/info commands. Can run parallel to A after manifest schema lands.
- Lane C (W3: publish gate): publish skill, security gates, sandbox + sandbox-probe + macOS profile. Parallel to A+B but depends on tarball from A.
- Lane D (W4: audit + doctor): audit.ts + doctor check. Parallel to everything else.
- Lane E (W5: Printing Press cross-list): a single docs PR against `mvanhorn/printing-press-library`. ~1 day, fully independent.
- Lane F (W6: generated gbrain-cli): independent week of work; spawns its own branch.

Conflict flag: Lane A and Lane C both touch the in-tree skillpack module dir. Recommend serializing A → C within the same worktree.

**DX-review decisions locked across two rounds:**

*Round 1 — artifact scope:*
1. **Artifact scope: full cathedral.** `skillpack.json` declares `skills[]`, `unit_tests[]`, `e2e_tests[]`, `llm_evals[]`, `routing_evals[]`, `runbooks{install, uninstall, upgrades}`, `changelog`. The differentiation moat — nobody else ships AI evals + agent runbooks as first-class package artifacts.
2. **Publish gate runs everything in the sandbox.** Unit + E2E (when DB available) + LLM-judge (stubbed gateway, zero cost) + routing-evals. Coverage score drives tier eligibility: `endorsed` requires routing + runbooks + >=95% pass; `community` requires routing + install + >=80%; `experimental` accepts structural-only.
3. **Runbook format: agent-readable markdown** with three step kinds (`agent:`, `show user:`, `ask user:`). Separate `install.md`, `uninstall.md`, `upgrade-<from>-to-<to>.md` per version. Mirrors gbrain's own `skills/migrations/v0.21.0.md` pattern.
4. **`gbrain skillpack init` scaffolds the cathedral by default.** Full tree (skills, tests, e2e, evals, runbooks, CHANGELOG, README, LICENSE) lands out of the box; `gbrain skillpack pack --dry-run` passes immediately. `--minimal` flag for power users opting out.

*Round 2 — rubric + doctor + reference + invariant:*
5. **Layered doctor:** `gbrain skillpack doctor --quick` (~5s structural sweep, walks the rubric, no sandbox/LLM/DB) for rapid iteration; `--full` (runs the full publish-gate suite) for ship-readiness. Two-tool design; agent picks the mode per workflow phase. The user noted: agents do the operating, so the cognitive cost of two flags is irrelevant as long as the docs teach the agent when to use which.
6. **Rubric as declarative spec:** `src/core/skillpack/rubric.ts` exports `SKILLPACK_RUBRIC_V1` — 10 binary dimensions (manifest valid / SKILL.md complete / routing-evals present + clean / check-resolvable clean / unit test present / LLM-judge eval present / install + uninstall runbooks / CHANGELOG current). Single source of truth: doctor walks it, anatomy doc is auto-generated from it, tests pin each dimension.
7. **`doctor --fix` auto-scaffolds:** Calls `gbrain skillify scaffold` for missing skills, drops runbook stubs, generates CHANGELOG entries from VERSION + git log. Confirm prompt on TTY; `--yes` skips; refuses to overwrite files whose mtime is newer than `skillpack.json`'s.
8. **Reference pack + anatomy doc + 10/10 invariant for EVERY bundled gbrain skillpack:** ship `examples/skillpack-reference/` (real working 10/10 pack) AND `docs/skillpack-anatomy.md` (one-page reference, auto-generated rubric section from `rubric.ts`). NEW INVARIANT (the user's strongest line): every gbrain-shipped skillpack must score 10/10 on `--quick`. `scripts/check-bundled-skillpacks-rubric.sh` is wired into `bun run verify` + CI. Bringing today's `openclaw.plugin.json` set to 10/10 is wave W4.5 — blocking on W3 (doctor) but required before v1.0 ship. Credibility-poison if gbrain ships skillpacks below the bar gbrain demands of third parties.

**DX scorecard (after both DX rounds):**

| Dimension          | Before | Round1 | Round2 | Notes |
|--------------------|--------|---------|---------|-------|
| Getting Started    | 4/10   | 9/10    | **10/10** | scaffold + `doctor --quick` round-trip in <10s; reference pack as ground truth |
| API/CLI/SDK        | 6/10   | 9/10    | **10/10** | `init / doctor / pack / test / publish / endorse / install / search` complete surface |
| Error Messages     | 5/10   | 8/10    | **9/10** | doctor emits paste-ready fix per failed dimension; auto-fixable flag for agents |
| Documentation      | 5/10   | 8/10    | **10/10** | `docs/skillpack-anatomy.md` is one-page + auto-generated rubric + reference pack as example |
| Upgrade Path       | 2/10   | 9/10    | **9/10** | runbook-walker handles multi-hop |
| Dev Environment    | 6/10   | 9/10    | **10/10** | `doctor --quick` (~5s) + `--fix` autoscaffold + `--full` (publish-gate) |
| Community          | 3/10   | 8/10    | **9/10** | registry + tarball mirror + endorsement workflow + reference pack to fork |
| DX Measurement     | 2/10   | 7/10    | **9/10** | doctor JSON envelope is stable; per-dimension scoring trend across publishes |
| **TTHW**           | n/a    | <5min   | **<3min** | `init` → edit → `doctor --quick` → 10/10 |
| **Overall DX**     | 4/10   | 8.5/10  | **9.5/10** | Rubric-as-source-of-truth + `every bundled pack is 10/10` invariant is the kill move |

**Magical moment** (locked from DX 0D): `gbrain skillpack install <name>` lands the pack AND walks `runbooks/install.md` AND the agent immediately knows what triggers fire, what tools the skill exposes, and how to upgrade later. Zero "where are the docs?" moment.

**Second magical moment** (Round 2): `gbrain skillpack doctor --quick --json` prints a 10/10 score with paste-ready fixes for the misses. The agent reads the JSON, runs `--fix --yes` to auto-scaffold, re-runs `--quick`, and the score climbs. The first time an agent gets from 6/10 to 10/10 in 30 seconds via three `gbrain` commands is the moment the "skillpacks are real software packages" claim becomes felt rather than asserted.

**Lake Score:** 25/27 — every cathedral-leaning recommendation accepted across CEO + Eng + DX (both rounds) + 8 codex outside-voice questions. The 2 holds are deliberate: T2 (kept cathedral scope vs codex's minimal v1) and T3 (kept the 10/10 bundled invariant vs codex's defer-to-v1.1). Both defenses were on locked product-strategy decisions; the cathedral moat is the thing.

**CODEX (outside voice) — 20 findings, 8 surfaced for decision:**
- T1 (RUNBOOK TRUST) — adopted: per-step approval replaces auto-walk; `--runbook-apply-all` for CI; `--runbook-skip` for file-drop-only. NPM-postinstall lesson applied.
- T2 (SCOPE) — held: cathedral is the moat; minimal v1 forfeits curation+evals+runbooks differentiation; without those gbrain skillpacks are just another agentskills.io mirror.
- T3 (10/10 BUNDLED) — held: shipping gbrain's own packs below the bar gbrain demands is credibility-poison; W4.5 retrofit costs ~3d with --fix autoscaffold, slips v1 by a week.
- T4 (GAMEABLE CATHEDRAL) — adopted: rubric splits into required core (5 dimensions: manifest + SKILL.md + routing-evals + check-resolvable + CHANGELOG) and quality badges (5: routing-evals-clean + unit tests + LLM-judge + install + uninstall runbook). Endorsed needs all badges; community needs 3/5; experimental needs core only. Plus stubbed-eval detection in publish-gate content scan.
- G1 (TRUST STORE) — adopted: `~/.gbrain/skillpack-state.json` machine-owned (TOFU pins, hashes, rename maps); resolver markdown stays render-only (rows + cumulative-slugs). Mismatch fails loud.
- G2 (ENV SCRUB) — adopted: clean env (only PATH/LANG/TZ), HOME override to empty `<tempdir>/sandbox-home`, explicit denylist (`*_API_KEY` / `*_TOKEN` / `*_SECRET` / SSH_AUTH_SOCK / GIT_* / NPM_TOKEN / BUN_INSTALL_TOKEN). Read-only mounts + masked `/proc` where bwrap supports it.
- G3 (CI SUPPLY CHAIN) — adopted: three-workflow split. validate-pr.yml is static-only on `pull_request` (no privileged tokens, no LFS write). post-merge-validate.yml runs the heavy suite inside the registry's own sandbox after merge. mirror-tarball.yml commits the tarball with a least-privilege deploy key scoped to `tarballs/`.
- G4 (NAMESPACE / TYPOSQUAT) — adopted: first-install identity confirm prompt showing author/source/commit/SHA/tier; subsequent same-author-same-pin installs skip. Registry rejects new endorsed-tier names within Damerau-Levenshtein edit-distance 2 of any existing endorsed pack.

**Trailing correctness fixes (no decision needed, codex gaps clearly worth taking):**
- Tarball determinism: sorted entries, fixed mtimes, gzip mtime=0, no symlinks/hardlinks/devices/FIFOs, extract caps (5000 files / 100MB total / 1MB per file / 255-char paths / 100:1 ratio).
- check-resolvable pack-local isolation: doctor + publish-gate wrap `check-resolvable` in a tempdir fixture containing ONLY the pack's RESOLVER.md + skills/, so verdict is pack-local not workspace-global.
- Versioning beyond `gbrain_min_version`: manifest also carries `runbook_schema_version` + `eval_schema_version`; installer rejects newer-than-supported with paste-ready upgrade hint.

**CROSS-MODEL TENSION (held cathedral over codex):**
- T2 scope and T3 bundled-invariant are product-strategy decisions where codex's argument (ship simpler v1 faster) lost to the user's argument (the differentiation IS the cathedral; shipping below your own bar is credibility-poison). Codex was right on every supply-chain finding; the disagreement on scope is taste, not correctness. Documented here so future maintainers see the trade.

**Recommended next reviews:**
1. **/codex consult** as an outside voice on the locked-in plan; the artifact-as-software-package framing deserves an independent challenge.
2. **/devex-review** after implementation lands — the boomerang. Plan says TTHW < 5min; reality check post-ship.

**UNRESOLVED:** none. CEO + Eng + DX (both rounds) + Codex outside-voice all clear with explicit decisions for every load-bearing item across 27 questions.

**VERDICT:** CEO + ENG + DX + CODEX CLEAR — ready to implement. The plan is a complete spec; the next move is implementation, not more review. Codex's 20 findings were absorbed (6 adopted as direct improvements, 2 held as taste-of-cathedral product calls, 12 minor / overlapping / already-covered). The two cathedral defenses are documented so future maintainers see the trade.