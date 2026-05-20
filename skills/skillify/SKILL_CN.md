---
name: skillify
version: 1.1.0
description: |
  元技能。将任何原始功能转变为适当技能化、已测试、
  可解析的代理能力单元。跨模态评估是推荐的
  阶段3质量门：来自不同提供商的3个前沿模型审查
  输出，你迭代到质量，然后编写锁定
  已验证良好行为的测试。
triggers:
  - "skillify this"
  - "skillify"
  - "is this a skill?"
  - "make this proper"
  - "add tests and evals for this"
  - "check skill completeness"
tools:
  - exec
  - read
  - write
mutating: true
---

# Skillify — 元技能

> **与 `/cross-modal-review` 的关系：** 该技能是手动中期流程
> "第二意见"门（一个模型在提交前审查工作产品）。此
> 技能的阶段3下方使用 `gbrain eval cross-modal` — 三个
> 不同提供商的前沿模型在记录之前对
> 维度列表进行评分和迭代 *在* 测试固化行为之前。使用 `/cross-modal-review`
> 进行临时第二意见；在skillifying功能时使用此处的阶段3。

## 契约

当所有11个检查表项目通过时，功能即"适当技能化"。项目3
（跨模态评估）在v1.1.0中是信息性的 — 它不
门控skillpack-check审计，但缺少或陈旧收据会被呈现，以便
用户知道门控的状态。

## 检查表

```
□ 1.  SKILL.md           — 带frontmatter + contract + phases的技能文件
□ 2.  代码               — 确定性脚本（如适用）
□ 3.  跨模态评估   — 来自3个提供商的3个前沿模型；信息性
□ 4.  单元测试         — 覆盖确定性逻辑的每个分支
□ 5.  集成测试  — 练习实时端点
□ 6.  LLM评估          — LLM涉及步骤的质量/正确性案例
□ 7.  解析器触发器   — skills/RESOLVER.md中带真实用户触发短语的条目
□ 8.  解析器评估      — 测试触发路由到此技能
□ 9.  检查可解析   — DRY + MECE审计，无孤立项
□ 10. E2E测试           — 冒烟测试：触发器 → 副作用
□ 11. Brain归档       — 如果它写入页面，brain/RESOLVER.md中的条目
```

## 阶段0：这应该是技能吗？

在skillifying之前，检查：
- 这将被调用2次以上吗？（一次性工作 ≠ 技能）
- 是否有 >20行逻辑？（琐碎助手不需要完整基础设施）
- 是否有用户实际会说的明确触发短语？

如果三者都是否，那就是脚本，不是技能。继续。

## 阶段1：审计

```
功能：[名称]
代码：[路径]
缺少的项目：[检查11个中的每个]
```

## 阶段2：编写SKILL.md + 代码（项目1-2）

### SKILL.md frontmatter模板（复制粘贴）：

```yaml
---
name: my-skill
version: 1.0.0
description: |
  一段话。它做什么，何时使用它。
triggers:
  - "用户实际说的触发短语"
  - "另一个真实触发器"
tools:
  - exec
  - read
  - write
mutating: false  # 如果写入brain/磁盘则为true
---
```

正文必须包括：**Contract**（它保证什么）、**Phases**（逐步）、**Output Format**（它产生什么）。

将确定性代码提取到 `scripts/*.ts`。

## 阶段3：跨模态评估（项目3）— 质量门

### 为什么这在测试之前

测试锁定行为。如果行为是平庸的，测试锁定平庸。
跨模态评估**首先**证明质量栏，然后测试固化它。

### 步骤1：选择代表性输入

选择锻炼技能最困难记录用例的输入。如果
不确定：使用SKILL.md中的主要触发示例，或来自
过去7天内存文件的最复杂
真实世界输入。

### 步骤2：运行技能，捕获输出

在代表性输入上运行技能。**输出文件**是要
评估的内容。

### 步骤3：运行评估门

```bash
gbrain eval cross-modal \
  --task "这个技能应该完成什么" \
  --output skills/<slug>/SKILL.md
```

命令并行运行来自3个不同提供商的3个前沿模型，
在5个记录维度上针对TASK评分OUTPUT，并在`~/.gbrain/.gbrain/eval-receipts/<slug>-<sha8>.json`下写入
收据（sha-8将收据绑定到当前SKILL.md内容 — 在
编辑后重新运行写入新收据）。

**默认模型**（通过`--slot-a-model`、`--slot-b-model`、
`--slot-c-model`覆盖每个插槽）：

| 插槽 | 默认 | 提供商 |
|------|---------|----------|
| A | `openai:gpt-4o` | OpenAI |
| B | `anthropic:claude-opus-4-7` | Anthropic |
| C | `google:gemini-1.5-pro` | Google |

**这些必须来自不同提供商的前沿模型。** 使用单个
提供商的系列或预算模型会破坏目的 — 不同系列
有较少相关的盲点。当新模型
一代发布时刷新列表。

**通过标准（两者都必须为true）：**

1. 每个维度的均值跨成功模型 ≥ 7。
2. 没有单个模型在任何维度上得分 < 5（下限）。

**不确定：** 3个模型中有少于2个返回可解析分数。
收据仍被写入（取证）但门控不具有权威性。
退出代码2；CI包装器应将此视为"未干净运行"，而不是
"失败的质量门"。

### 步骤4：循环直到通过（≤3个循环）

```
循环 1：
  评估 → 分数 + 前10个改进
  IF 通过：→ 完成，编写测试
  ELSE：
    将前10个改进应用到实际文件
    日志：应用了哪些改进，改变了什么

循环 2：
  重新评估FIXED输出（相同的3个模型，相同的维度）
  比较：每个维度的之前/之后分数（跟踪增量）
  IF 通过：→ 完成，编写测试
  ELSE：应用剩余的改进 + 新的改进

循环 3（最终）：
  重新评估
  IF 通过：→ 发布
  ELSE：→ 发布时带KNOWN_GAPS部分列出：
    - 哪些维度仍低于7
    - 哪些改进无法解决
    - 为什么（例如，"需要架构更改"）
```

### 循环 + 成本保护

- 在TTY中默认`--cycles 3`，在非TTY中默认`--cycles 1`（限制脚本
  批量支出在CI循环中）。
- 命令在每个运行之前从小的定价
  常量打印估计的最大成本每循环。实际成本随提示大小变化；将
  估计视为默认`--max-tokens 4000`的上限。
- `--budget-usd N` 硬上限是v0.27.x后续TODO。

### 提供商配置

模型通过gbrain AI网关解析。使用以下命令配置一次：

```bash
gbrain providers test    # 查看配置了什么
gbrain config            # 设置密钥
```

或设置环境变量：`OPENAI_API_KEY`、`ANTHROPIC_API_KEY`、
`GOOGLE_GENERATIVE_AI_API_KEY`、`TOGETHER_API_KEY`等。网关从
`~/.gbrain/config.json`加上`process.env`读取。

### 成本预期

3个循环 × 3个模型 = 每次运行最多9个前沿调用。使用Opus级别 +
GPT-4o级别 + Gemini-1.5-Pro，预期每次完整运行在默认情况下
为1-3美元：`--max-tokens 4000`。收据包括每次调用的模型标识符，以便
你可以追溯审计。

### 跳过跨模态评估当：

- 输出 < 200个token（琐碎 — 不值得9个API调用）。
- 技能是单个API调用的薄包装器（一个循环就足够了）。

## 阶段4：测试（项目4-6）

**现在**评估已证明质量，编写锁定它的测试：

**单元测试** — 确定性逻辑的每个分支。模拟外部调用。
**集成测试** — 命中真实端点。捕获模拟隐藏的错误。
**LLM评估** — LLM步骤的质量/正确性。比跨模态评估轻 — 测试特定行为。

## 阶段5：解析器 + 检查可解析（项目7-9）

1. 使用用户实际键入的触发短语添加到skills/RESOLVER.md
2. 解析器评估：提供触发器，断言正确路由
3. 检查可解析：
   - 从skills/RESOLVER.md可到达技能（不是孤立的）
   - 与其他技能无MECE重叠
   - 无DRY违反（共享逻辑在lib/中，不是复制粘贴的）
   - 无歧义触发路由

## 阶段6：E2E + Brain归档（项目10-11）

- E2E冒烟：从触发器到副作用的完整管道
- Brain归档：如果技能写入brain页面，则添加到brain/RESOLVER.md

## 阶段7：验证

```bash
bun test test/<skill>.test.ts                    # 单元测试
gbrain skillify check skills/<slug>/scripts/<slug>.mjs --json | \
  jq '.[] | .items[] | select(.name | contains("Cross-modal"))'
ls ~/.gbrain/.gbrain/eval-receipts/              # 收据已着陆
gbrain check-resolvable --json | jq .ok          # 解析器干净
```

## 工作示例：Skillifying "summarize-pr" 功能

```
阶段0：是 — 每周调用，50+行，明确触发器"summarize this PR"
阶段1：审计 → SKILL.md缺少，无测试，无解析器条目。得分：1/11
阶段2：编写SKILL.md + 提取脚本到scripts/summarize-pr.ts
阶段3：跨模态评估循环1 →
  GPT-4o：goal=6, depth=5, specificity=4 → "misses file-level diffs"
  Opus 4.7：goal=7, depth=6, specificity=5 → "no test plan in summary"
  Gemini 1.5 Pro：goal=6, depth=5, specificity=5 → "template feels generic"
  聚合：goal=6.3 失败，depth=5.3 失败
  顶部改进：添加文件级更改，包括测试计划，使用PR上下文
  → 应用修复 → 循环2：goal=8, depth=7.5, specificity=7 → 通过
阶段4：编写12个单元测试锁定改进的行为
阶段5：添加"summarize this PR"触发器到skills/RESOLVER.md
阶段6：E2E测试：提供真实PR URL → 验证brain页面已创建
阶段7：全部绿色。得分：11/11
```

## 质量门

直到以下情况才**适当技能化**：

- 所有必需项目通过（1-2、4-10；仅当适用时为11）。
- 跨模态评估（项目3）有当前收据**或**明确放弃
  理由（项目3是信息性的；不阻塞，但缺少
  收据在审计中可见）。
- 所有测试通过（单元 + 集成 + LLM评估）。
- 解析器条目存在，带真实触发短语。
- 检查可解析显示无孤立项、重叠或DRY违反。
- 如适用，brain归档。

## 输出格式

Skillify为每个技能生成三个持久工件：

1. **磁盘上的技能树。** `skills/<slug>/SKILL.md`、`scripts/<slug>.mjs`、
   `routing-eval.jsonl`，加上`test/<slug>.test.ts`骨架。由
   `gbrain skillify scaffold <name>`生成，并由人类/代理完善为
   真实实现。
2. **跨模态评估收据**
   在`~/.gbrain/.gbrain/eval-receipts/<slug>-<sha8>.json`。sha-8将
   收据绑定到当前`SKILL.md`内容。`gbrain skillify check`
   将状态（`found` / `stale` / `missing`）呈现为信息性。
3. **来自`gbrain skillify check`的审计结论**：`properly skilled` |
   `close — create: <missing items>` | `needs skillify — run /skillify on
   <target>`。得分是`<passed>/<total>`。必需项目门控结论；
   项目11（跨模态评估）是信息性的，从不阻塞PASS。

JSON输出（`gbrain skillify check --json`）包括相同字段加上
每项详细字符串，因此代理可以在结构化信封上
路由，而无需解析散文。

## 反模式

- ❌ 在跨模态评估之前编写测试（锁定平庸）
- ❌ 使用预算模型进行评估（C学生给A学生评分）
- ❌ 对所有3个插槽使用单个提供商的系列（相关盲点）
- ❌ 跳过评估"因为输出看起来很好"（你的判断不是3个模型）
- ❌ 没有修复循环的评估（虚荣指标）
- ❌ 没有SKILL.md的代码（对解析器不可见）
- ❌ 重新实现生产代码的测试（掩盖真实错误）
- ❌ 带内部行话的解析器条目（必须反映真实用户语言）
- ❌ 两个技能做同样的事情（合并或杀死一个）
- ❌ 对琐碎输出运行跨模态评估（< 200个token，不值得9个API调用）
