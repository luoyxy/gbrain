---
name: testing
version: 1.1.0
description: |
  技能验证框架加上每日测试套件健康状况和回归
  智能。验证技能一致性（frontmatter、manifest覆盖、
  解析器覆盖）。按分层阶段（单元/
  评估/集成/系统健康状况）运行项目测试套件，分类失败，并生成
  具有回归意识的报告。
triggers:
  - "validate skills"
  - "test skills"
  - "skill health check"
  - "run conformance tests"
  - "run the tests"
  - "how are the tests"
  - "what's broken"
  - "daily test run"
tools:
  - search
  - list_pages
mutating: false
---

# 测试技能 — 验证 + 每日健康状况和回归智能

> **约定：** 参见 [conventions/quality.md](../conventions/quality.md] 了解
> test-before-bulk模式；本技能在整个项目的
> 自己的测试套件中强制执行它。

## 两种模式

本技能有两种相关但不同的模式：

1. **技能一致性验证** — gbrain自己的一致性栏
   （原始1.0范围）。验证每个技能都有带有
   frontmatter的SKILL.md，每个引用都存在，manifest + 解析器覆盖
   往返。

2. **项目测试套件健康状况（v0.25.1扩展）** — 运行
   项目的分层测试套件并生成回归分类的
   报告。由每日cron、容器重启引导和使用
   "测试怎么样"提示。

通过触发器选择模式。

## 模式1：技能一致性验证

### 契约

此模式保证：

- 每个技能目录都有`SKILL.md`文件
- 每个`SKILL.md`都有有效的YAML frontmatter（`name`、`description`）
- 每个`SKILL.md`都有`test/skills-conformance.test.ts`要求的
  必需部分
- `skills/manifest.json`列出每个技能目录
- `skills/RESOLVER.md`引用manifest中的每个技能
- `openclaw.plugin.json` `skills[]`与两者往返
- 无MECE违反（跨技能的重复触发器）

### 阶段

1. **遍历技能目录。** 列出包含`SKILL.md`的所有子目录。
2. **验证frontmatter。** 解析YAML，检查必需字段。
3. **验证部分。** 检查必需标题。
4. **检查manifest。** 每个技能目录必须在`manifest.json`中。
5. **检查解析器。** 每个manifest技能必须有RESOLVER行。
6. **检查往返。** RESOLVER触发器 ↔ frontmatter触发器。
7. **报告结果。**

### 自动化

```bash
bun test test/skills-conformance.test.ts test/resolver.test.ts
```

CI门控检查是package.json `test`脚本。

### 输出格式

```
技能验证报告
========================
找到的技能：        N
一致性：         N/N 通过
Manifest覆盖：   N/N
解析器覆盖：   N/N
往返：          N/N
MECE违反：     N

问题：
- <skill>: <issue>
```

## 模式2：项目测试套件健康状况（v0.25.1）

### 何时使用

- 每日测试cron触发
- 用户询问"运行测试"/"测试怎么样"/"什么坏了"
- 重大代码更改后（通常通过cross-modal-review）
- 容器重启后（引导）
- 当某些东西看起来不对，你想验证系统健康状况时

### 测试层级

| 层级 | 运行内容 | 墙时 | 门控 |
|------|--------------|-----------|-------|
| **单元** | `bun test`（确定性，零外部调用） | <2秒 | 每次提交 |
| **评估** | LLM判断或质量评估 | ~60秒 | 每日 |
| **集成** | 针对真实Postgres的E2E测试 | ~5分钟 | 预发布 + 每晚 |
| **系统健康状况** | 磁盘/内存/CPU/服务活跃度 | <10秒 | 每日 |

### 每日运行协议

当cron触发（或用户询问）时，执行**所有**这些：

#### 1. 运行单元测试

```bash
bun test 2>&1
```

解析：总共通过、总共失败、总共跳过、文件级结果。

#### 2. 运行评估（如果项目有评估配置）

```bash
# 适应项目的评估配置
bun test --filter eval 2>&1
```

解析：相同格式。注意任何 flakes（由于API
超时而非代码错误而失败的测试）。

#### 3. 运行系统健康状况检查

- 磁盘/内存/CPU
- gbrain：`gbrain doctor --fast --json`
- 数据库连接（如适用）
- 关键文件存在（CLAUDE.md、AGENTS.md等）

#### 4. Git差异分析（关键 — 回归智能）

```bash
# 自上次测试运行以来发生了什么变化？
git log --oneline --since="24 hours ago"
```

对于每个失败的测试：

1. 检查测试本身是否最近被修改（测试更改，不是
   回归）。
2. 检查它测试的代码是否最近被修改（可能的
   回归）。
3. 检查它是否是已知的flake（API超时、服务关闭）。
4. 检查依赖是否更新（gbrain、bun等）。

#### 5. 分类每个失败

| 分类 | 标记 | 操作 |
|---------------|--------|--------|
| **REGRESSION** — 代码更改，测试中断 | 🔴 | 用破坏它的提交标记 |
| **STALE** — 测试期望旧行为；代码正确 | 🟡 | 修复测试，而不是代码 |
| **FLAKE** — API超时、服务关闭、LLM方差 | ⚠️ | 注意，不要惊慌；重试一次 |
| **NEW** — 测试刚刚添加但尚未通过 | 🟢 | 检查是否有意 |
| **INFRA** — 容器重启擦除状态 | 🛠️ | 运行引导，重新测试 |

#### 6. 报告格式

```
🧪 每日测试 — YYYY-MM-DD

单元：   X/Y 通过（Z 跳过）
评估：  X/Y 通过
系统：[健康状况摘要]

回归：
  🔴 <测试名称>：被提交 <sha> "<提交消息>" 破坏

过时测试：
  🟡 <测试名称>：期望X但代码现在执行Y（提交 <sha>）

波动：
  ⚠️ <测试名称>：超时（重试通过）

✅ 全部清除（如适用）
```

#### 7. 自动修复协议

**要自动修复：**

- 重命名后测试期望旧文件路径 → 更新测试
- 测试期望旧版本字符串 → 更新
- 测试期望有意删除的文件 → 删除测试
- 导入路径因文件移动而中断 → 修复导入

**不要自动修复：**

- 测试期望行为A但代码现在执行B → 首先询问。也许
  测试是正确的，代码有错误。
- 安全测试失败 → 始终上报，绝不自动修复。
- 测试被跳过并带有TODO → 在不理解原因的情况下不要取消跳过。

当不确定时：检查更改代码的提交消息，检查
是否有相关的PR或对话，如果仍不清楚，询问用户。

### 状态（回归历史）

在`~/.gbrain/test-state.json`中跟踪结果以进行趋势跟踪：

```json
{
  "lastRun": "2026-04-16T13:37:00Z",
  "unit": { "passed": 1262, "failed": 31, "skipped": 8 },
  "evals": { "passed": 17, "failed": 0 },
  "system": { "doctor": "ok", "gbrain": "0.25.1" },
  "failureHistory": [
    { "test": "<name>", "since": "2026-04-14", "classification": "stale" }
  ]
}
```

这启用：

- 趋势跟踪（我们变得更好还是更糟？）
- 波动检测（同一测试间歇性失败）
- 回归速度（更改后我们破坏事物的速度有多快？）

## 反模式

- ❌ 添加新技能后跳过一致性验证
- ❌ 添加到`manifest.json`而不添加到RESOLVER.md
- ❌ 将每个红色测试视为回归。首先分类；许多是
  过时的或不稳定的。
- ❌ 在不理解为什么被跳过的情况下自动取消跳过测试
- ❌ 自动"修复"安全测试失败
- ❌ 在未实际运行系统健康状况检查的情况下报告"全部清除"

## 契约

本技能保证：

- 路由匹配frontmatter中的规范触发器。
- 输出写入`writes_to:`下列出的目录（如适用）。
- 遵循引用的约定（`quality.md`、`brain-first.md`、`_brain-filing-rules.md`）。
- 保留隐私契约：无真实姓名、无特定于fork的文件系统路径字面量、无上游fork引用。

完整行为契约在上述正文部分中记录；此部分存在用于一致性测试。

## 输出格式

技能的输出形状在上述正文部分中内联记录（参见"输出"、"brain页面格式"或等效项）。此处的字面部分标题存在用于一致性测试（`test/skills-conformance.test.ts`）。
