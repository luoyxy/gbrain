# 进度事件

`gbrain` 在运行批量命令时使用 `--progress-json` 写入 `stderr` 的 JSONL 进度流的规范参考。从 v0.15.2 开始稳定。仅增量更改；没有主版本提升的情况下不会重命名或移除。

大多数人不会阅读此页面。解析进度的代理会。

## 何时获取这些事件？

以下任何命令在设置 `--progress-json` 时都会流式传输事件：

- `gbrain doctor`（数据库检查、JSONB 完整性、markdown 正文完整性、完整性采样）
- `gbrain orphans`
- `gbrain embed`
- `gbrain files sync`
- `gbrain export`
- `gbrain extract [links|timeline|all]`（fs 或 db 来源）
- `gbrain import`
- `gbrain sync`
- `gbrain migrate --to …`
- `gbrain repair-jsonb`
- `gbrain check-backlinks`
- `gbrain lint`
- `gbrain integrity auto`
- `gbrain eval`
- `gbrain apply-migrations`（编排器 + 每个子命令）

非批量命令（`stats`、`graph-query`、`get`、`put` 等）不会发出事件——它们在不到一秒的时间内返回。

## 通道

- 进度事件：**`stderr`**，每行一个 JSON 对象，`\n` 终止。
- 数据结果（来自每个命令的 `--json` 负载）：**`stdout`**。
- 最终人类摘要：**`stdout`**。

代理可以安全地捕获 stdout 以进行结果解析，并分别读取 stderr 以获取进度。

## 标志

| 标志 | 行为 |
|---|---|
| *（无）* | 自动。TTY：`\r` 重写单行。非 TTY：stderr 上每行事件一行。 |
| `--progress-json` | 强制 stderr 上的 JSON 行模式（本文档）。 |
| `--quiet` | 完全抑制进度。警告和最终输出仍然打印。 |
| `--progress-interval=<ms>` | 覆盖 emit 之间的最小间隔（默认 1000）。 |

全局标志：在命令调度之前由 `src/core/cli-options.ts` 解析，因此 `gbrain --progress-json doctor` 的工作方式与 `gbrain doctor --progress-json` 相同（后者也有效——每命令解析器通过共享的 `CliOptions` 单例查看标志）。

## 事件类型

每个事件都是一个带有这些公共字段的单行 JSON 对象：

| 字段 | 类型 | 备注 |
|---|---|---|
| `event` | string | 以下之一：`start`、`tick`、`heartbeat`、`finish`、`abort`。 |
| `phase` | string | 机器稳定的 snake_case，点分隔。参见下面的"阶段名称"。 |
| `ts` | ISO 8601 UTC 字符串 | 事件发射时间。 |
| `elapsed_ms` | number | 阶段开始后经过的毫秒数。在 `tick`/`heartbeat`/`finish`/`abort` 上显示。 |

### `start`

阶段开始时发射。

```json
{"event":"start","phase":"doctor.db_checks","ts":"2026-04-20T12:34:56.789Z"}
{"event":"start","phase":"import.files","total":52000,"ts":"2026-04-20T12:34:56.789Z"}
```

可选字段：

- `total` —— 如果在开始时已知，则为项目总数。

### `tick`

迭代期间定期发射。受时间和项目限制：报告器
不会比 `minIntervalMs`（默认 1000）更频繁地发射，并且
`minItems`（默认 `max(10, ceil(total/100))`）。

```json
{"event":"tick","phase":"orphans.scan","done":15000,"total":52000,"pct":28.8,"elapsed_ms":4200,"eta_ms":10300,"ts":"..."}
```

字段：

- `done` —— 此阶段完成的项目数。
- `total` —— 项目总数，如果已知。如果扫描不能预先获得总数（例如，流式迭代器），则省略。
- `pct` —— `done/total * 100`，一位小数。当 `total` 未知时省略。
- `eta_ms` —— 直到 `done === total` 的预测毫秒数。
  当 `total` 未知时省略。
- `note` —— 带有当前项目（例如 slug 或文件名）的可选字符串。

### `heartbeat`

为不迭代的长期运行单个操作发射（例如，针对 50K 行表的 `SELECT`）。没有 `done`，没有 `total` —— 只是一个
工作仍在进行中的信号。

```json
{"event":"heartbeat","phase":"doctor.markdown_body_completeness","note":"scanning pages for truncation…","elapsed_ms":1000,"ts":"..."}
```

### `finish`

阶段正常完成时发射。

```json
{"event":"finish","phase":"import.files","done":52000,"total":52000,"elapsed_ms":187000,"ts":"..."}
```

### `abort`

由跟踪每个实时阶段的单个进程级 SIGINT/SIGTERM 处理程序发射。在 `abort` 之后，该阶段不会发射更多事件。

```json
{"event":"abort","phase":"doctor.markdown_body_completeness","reason":"SIGINT","elapsed_ms":5300,"ts":"..."}
```

## 阶段名称

阶段使用 `snake_case.dot.path` 命名。新的报告器从
根开始；`child()` 组合附加到父级的当前阶段，因此
调用 import 的 sync 发射 `sync.import.<file>`，而不是 `import.<file>`。

v0.15.2 中发布的稳定阶段名称：

- `doctor.db_checks`（数据库端 doctor 检查的总括）
- `orphans.scan`
- `embed.pages`
- `extract.links_fs`、`extract.timeline_fs`、`extract.links_db`、`extract.timeline_db`
- `import.files`
- `sync.deletes`、`sync.renames`、`sync.imports`
- `migrate.copy_pages`、`migrate.copy_links`
- `repair_jsonb.run`、`repair_jsonb.<table>.<column>`
- `backlinks.scan`
- `lint.pages`
- `integrity.auto`
- `eval.single`、`eval.ab`
- `export.pages`
- `files.sync`

通过 `child()` 公开的自阶段：

- `sync.import.files` —— 嵌套在 sync 内部
- `apply_migrations.v0_12_2.jsonb_repair` —— 嵌套在编排器内部

## 子进程继承

当父 CLI 生成 `gbrain …` 子进程时（主要在
`src/commands/migrations/*` 中），全局标志（`--quiet`、`--progress-json`、
`--progress-interval`）通过
`src/core/cli-options.ts` 中的 `childGlobalFlags()` 帮助程序传播到子进程的 argv。子 stderr
通过 `stdio: 'inherit'` 直接传递，因此事件流是父级 stderr 上的一个
合并的 JSONL 馈送。

一个例外：`migrations/v0_12_2.ts` 中捕获子 stdout（`repair-jsonb --dry-run --json` 用于验证）的编排器阶段
不传递 `--progress-json` 以避免 stdout 污染的任何风险
破坏编排器的 `JSON.parse`。其 stdio 是显式的：
`['ignore', 'pipe', 'inherit']`，因此 stderr 仍然流过。

## Minion 作业

`gbrain jobs work`（Minion worker 守护进程）将进度保存在 DB 中，
而不是 stderr 上。每个运行批量核心（embed、sync、
extract、import、backlinks）的 Minion 处理程序在每次迭代时调用 `job.updateProgress({done, total,
…})`。代理通过
`get_job_progress` MCP 操作或 `gbrain jobs get <id>` 读取每作业进度。

`jobs work` 守护进程本身仅为活跃性发射粗略的单行每作业 stderr 输出。
每页面详细信息存在于 DB 中。

## 兼容性

- **已添加**：仅。新的事件类型、新的字段、新的阶段名称 —— 全部
  安全。代理必须忽略未知字段和未知事件类型。
- **已移除/重命名**：没有主版本提升永远不会。
- **模式更改**：在 `CHANGELOG.md` 和
  `skills/migrations/v<next>.md` 中公布。

如果你的代理依赖于此模式，并且某些内容让你感到意外，请打开
一个带有你收到的事件以及你期望的事件的问题。
