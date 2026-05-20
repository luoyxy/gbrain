---
name: skill-creator
version: 1.0.0
description: |
  按照GBrain一致性标准创建新技能。生成带frontmatter、
  Contract、Phases、Output Format和Anti-Patterns的SKILL.md。
  对照现有技能检查MECE。更新manifest和resolver。
triggers:
  - "创建技能"
  - "新技能"
  - "改进此技能"
tools:
  - search
  - list_pages
mutating: true
---

# 技能创建器

## 契约

本技能保证：
- 新技能遵循一致性标准（frontmatter + 必需部分）
- MECE检查：与现有技能的触发器无重叠
- manifest.json已更新
- RESOLVER.md已更新并包含路由条目
- 技能通过一致性测试（`bun test test/skills-conformance.test.ts`）

## 阶段

1. **识别缺口。** 缺少什么能力？什么用户意图没有技能？
2. **MECE检查。** 查看 `skills/manifest.json` 和 `skills/RESOLVER.md`。是否有现有技能已涵盖此内容？如果有，扩展它而不是创建新技能。
3. **创建SKILL.md。** 使用此模板：

```yaml
---
name: {技能名称}
version: 1.0.0
description: |
  {描述技能作用和何时使用的一段话。}
triggers:
  - "{触发短语1}"
  - "{触发短语2}"
tools:
  - {工具1}
  - {工具2}
mutating: {true|false}
---

# {技能标题}

## Contract
:{此技能保证什么 — 3-5个要点}

## Phases
:{编号的工作流步骤}

## Output Format
:{好的输出看起来像什么}

## Anti-Patterns
:{什么不应该做 — 3-5项}

## Tools Used
:{使用的GBrain操作，带描述}
```

4. **添加到manifest。** 使用名称、路径、描述更新 `skills/manifest.json`。
5. **添加到resolver。** 在 `skills/RESOLVER.md` 中使用适当类别中的路由条目更新。
6. **验证。** 运行 `bun test test/skills-conformance.test.ts` 以确认新技能通过。

## 输出格式

新的 `skills/{name}/SKILL.md` 文件 + 更新的manifest + 更新的resolver。

## 反模式

- 创建与现有技能重叠的技能（违反MECE）
- 跳过针对现有技能的MECE检查
- 创建frontmatter中没有触发器的技能
- 不更新manifest.json和RESOLVER.md
- 创建没有Anti-Patterns部分的技能
