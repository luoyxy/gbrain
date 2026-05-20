---
name: frontmatter-guard
version: 1.0.0
description: |
  验证和自动修复大脑页面上的 YAML 前言。捕获格式错误的
  页面，在它们进入大脑之前（缺少关闭的 ---、嵌套引号、slug
  不匹配、空字节、空前言、YAML 解析失败）。包装
  `gbrain frontmatter` CLI 用于智能体驱动的工作流。
triggers:
  - "validate frontmatter"
  - "check frontmatter"
  - "fix frontmatter"
  - "frontmatter audit"
  - "brain lint"
tools:
  - exec
mutating: true
---

# 前言守卫技能

> **约定：** 参见 `skills/conventions/quality.md` 了解引用规则；此技能是结构验证，不是引用审计。

## 合约

此技能保证：

- 每个大脑页面都根据七个规范前言验证类进行扫描
- 机械错误（嵌套引号、缺少关闭 `---`、空字节、slug 不匹配）可根据需要使用 `.bak` 备份自动修复
- 验证逻辑与 `gbrain doctor` 的 `frontmatter_integrity` 子检查共享——真相的单一来源
- 每个来源的报告（gbrain 自 v0.18.0 起是多来源的）；永远不要静默审计错误的根

## 为什么存在这个

大脑页面在数月内堆积。智能体用格式错误的前言写入它们：
- 缺少关闭 `---`（实体检测器 bug）
- 会议页面中的非结构化 YAML（摄取 bug）
- Slug 不匹配（路径重命名未传播）
- 空字节（来自复制粘贴事故的二进制损坏）
- 标题中的嵌套双引号（`title: "Phil "Nick" Last"`）

没有守卫，这些会静默累积，直到 `gbrain sync` 窒息或搜索返回垃圾。守卫使失败在审计时可见且可平凡修复。

## 验证类

| 代码 | 含义 | 可自动修复？ |
|------|---------|---------------|
| `MISSING_OPEN` | 文件不以 `---` 开头 | 否（需要人工） |
| `MISSING_CLOSE` | 第一个标题之前没有关闭 `---` | 是 |
| `YAML_PARSE` | YAML 未能解析 | 有时（取决于原因） |
| `SLUG_MISMATCH` | 前言 `slug:` 与路径派生的 slug 不同 | 是（移除字段） |
| `NULL_BYTES` | 二进制损坏（`\x00`） | 是 |
| `NESTED_QUOTES` | `title: "outer "inner" outer"` 形状 | 是 |
| `EMPTY_FRONTMATTER` | 存在打开 + 关闭，但之间没有任何内容 | 否（需要人工） |

## 阶段

### 阶段1：审计

在所有注册来源（或一个带有 `--source <id>` 的来源）上运行只读扫描。

```bash
gbrain frontmatter audit --json
```

报告：
- 按错误代码分组的每个来源计数
- 每个来源最多 20 个受影响页面的样本
- 总计数
- 扫描时间戳

输出是 JSON；智能体解析 `errors_by_code` 和 `per_source` 以决定下一步。

### 阶段2：验证一个路径

验证单个文件或目录（不需要来源注册）：

```bash
gbrain frontmatter validate <path> --json
```

退出代码 0 = 干净；1 = 发现错误。在 CI 管道或预提交钩子中使用它。

### 阶段3：修复

发现问题时：

```bash
gbrain frontmatter validate <path> --fix
```

`--fix` 在变更每个修改的文件之前写入 `<file>.bak`。备份是安全合约——无论大脑是 git 仓库还是纯目录都有效。

`--dry-run` 在写入之前预览。在批量应用修复之前使用此选项。

### 阶段4：预提交钩子（可选）

对于是 git 仓库的大脑仓库，安装预提交钩子以首先阻止格式错误的页面被提交：

```bash
gbrain frontmatter install-hook [--source <id>]
```

钩子针对暂存的 `.md`/`.mdx` 文件运行 `gbrain frontmatter validate`。使用 `git commit --no-verify` 绕过。

## 触发词

当用户说这些中的任何一个时，路由到这里：
- "validate frontmatter"
- "check frontmatter"
- "fix frontmatter"
- "frontmatter audit"
- "brain lint"

## 输出规则

- 始终首先运行 `gbrain frontmatter audit --json`；永远不要假设大脑是干净的。
- 用普通语言向用户呈现计数；不要转储原始 JSON。
- 对于 `--fix` 操作：在运行之前说明将修改多少文件，然后确认。
- `SLUG_MISMATCH` 修复会移除前言 `slug:` 字段——gbrain 从路径派生 slug。当用户的标题被有意重命名时提到这一点。
- 永远不要在没有显式用户输入的情况下自动修复 `MISSING_OPEN` 或 `EMPTY_FRONTMATTER`——这些通常意味着人类作者开始了页面但没有完成。

## 链式集成

- `gbrain doctor` — `frontmatter_integrity` 子检查报告与 `audit` 相同的计数。
- `skills/maintain/SKILL.md` — 更广泛的大脑健康审计；如果怀疑其他类的问题，在此技能之后链式调用。
- `skills/lint/SKILL.md`（通过 `gbrain lint`）——用于技能文件 lint 的重叠规则；lint 输出中的 `frontmatter-*` 规则名称来自此技能的验证表面。

## 输出格式

审计摘要（简洁，智能体友好）：

```
前言审计 — 跨 1 个来源的 17 个问题

[default] /Users/me/brain
  17 个问题
    MISSING_CLOSE: 8
    NESTED_QUOTES: 5
    NULL_BYTES: 4
  样本：
    people/jane.md — MISSING_CLOSE
    companies/acme.md — NESTED_QUOTES
    (+ 12 更多)

使用以下命令修复：gbrain frontmatter validate /Users/me/brain --fix
```

JSON 信封（当传递 `--json` 时）：

```json
{
  "ok": false,
  "total": 17,
  "errors_by_code": { "MISSING_CLOSE": 8, "NESTED_QUOTES": 5, "NULL_BYTES": 4 },
  "per_source": [
    {
      "source_id": "default",
      "source_path": "/Users/me/brain",
      "total": 17,
      "errors_by_code": { "MISSING_CLOSE": 8, "NESTED_QUOTES": 5, "NULL_BYTES": 4 },
      "sample": [{ "path": "people/jane.md", "codes": ["MISSING_CLOSE"] }]
    }
  ],
  "scanned_at": "2026-04-25T22:30:00.000Z"
}
```

`gbrain frontmatter validate <path> --json` 返回类似的信封，基于每个文件结果而不是每个来源进行键控。

## 反模式

- **在没有用户输入的情况下自动修复 `MISSING_OPEN` 或 `EMPTY_FRONTMATTER`。** 这些通常意味着人类作者开始了页面但没有完成——在未完成的草稿周围静默插入 `---` 标记是错误的。
- **在没有首先读取审计的情况下使用 `--fix` 来"让医生变绿"。** SLUG_MISMATCH 情况被专门呈现以供人工审查，因为 gbrain 从路径派生 slug。不匹配通常意味着用户有意重命名了文件；仅当你确认重命名是故意的时，自动移除 slug 字段才是正确的结果。
- **跳过 `.bak` 备份。** `.bak` 是非 git 大脑仓库的安全合约。如果 `.bak` 文件在修复运行后累积，那是一个功能，而不是 bug——用户可以审查差异并在满意时删除备份。
- **在没有注册来源的大脑上运行 `audit`。** CLI 优雅地返回"no registered sources to audit"；但迁移会发出 `skipped: no_sources` 阶段结果。不要用手动路径遍历来掩盖这一点；正确的修复是通过 `gbrain sources add` 注册来源。
- **在非 git 大脑目录上安装预提交钩子。** install-hook 命令会用一行说明自动跳过它们。如果你看到"Skipped — not a git repo"并且无论如何都想要写入时的验证，请在定时任务计划上使用 `audit` 命令。
