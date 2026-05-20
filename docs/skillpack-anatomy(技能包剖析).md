# Skillpack 剖析

第三方 gbrain skillpack 外观的规范单页参考。位于 `examples/skillpack-reference/` 的参考包是本文档描述的实时制品；克隆其树，你就有一个 10/10 的起始点。

## 树结构

```
my-skillpack/
├── skillpack.json                # 清单（cathedral 字段声明）
├── skills/
│   └── <skill-slug>/
│       ├── SKILL.md              # frontmatter + 正文，代理可读
│       └── routing-eval.jsonl    # >= 5 个意图固定触发 -> 技能
├── runbooks/
│   └── bootstrap.md              # 后脚手架显示（不是执行器）
├── test/
│   └── *.test.ts                 # bun:test 单元测试
├── e2e/
│   └── *.test.ts                 # 集成测试，受 DATABASE_URL 限制
├── evals/
│   └── *.judge.json              # LLM-judge 评估配置（每个 >= 3 个案例）
├── CHANGELOG.md                  # Keep-a-Changelog 形状
├── LICENSE                       # SPDX 匹配文本
├── README.md
└── .gitignore
```

`gbrain skillpack init <name>` 搭建此确切的树，预填充存根，这些存根在 `gbrain skillpack doctor . --quick` 上立即得分 10/10。用真实内容替换存根，在编辑之间运行 doctor，并且 `gbrain skillpack pack` 生成一个确定性的 `<name>-<version>.tgz`，准备好发布到注册表。

## 代理如何使用脚手架包

在 `gbrain skillpack scaffold <source>` 落地文件后：

1. 用户的代理在启动时或每条消息上遍历 `skills/*/SKILL.md` frontmatter 并读取每个包的 `triggers:` 数组。
2. 当用户措辞匹配触发时，代理从头到尾读取该 SKILL.md 正文作为上下文指令。
3. gbrain 在脚手架后**显示** `runbooks/bootstrap.md`，但**不**自动执行它。代理决定是否遍历这些步骤。这是 codex T1 供应链强化：自动遍历器会让恶意包在安装时突变用户的 brain，这就是 npm postinstall 攻击的发生方式。

## Doctor 如何对包评分

十个二进制维度。每个都由 `src/core/skillpack/rubric.ts` 中的纯函数检查，并返回 `{passed, detail, fix_hint}`。

Doctor 按顺序遍历它们，并打印分数 + 每维度状态 + 每次失败的粘贴就绪修复。

<!-- BEGIN auto-generated:rubric -->

### 核心维度（5 个；必须全部通过才能在任何层级发布）

| # | 名称 | 描述 | 自动修复 |
|---|------|-------------|--------------|
| 1 | `manifest_valid` | skillpack.json 通过 v1 模式验证器 | 否 |
| 2 | `skills_have_skill_md` | 每个列出的技能都有带有有效 frontmatter（名称、描述、触发）的 SKILL.md | 否 |
| 3 | `routing_evals_present` | 每个技能都有带有 >= 5 个意图的 routing-eval.jsonl | 是 |
| 4 | `skills_have_unique_triggers` | 此包中没有两个技能共享完全相同的触发短语（MECE） | 否 |
| 5 | `changelog_present_and_current` | CHANGELOG.md 存在并包含当前版本的条目 | 是 |

### 质量徽章（5 个；赚取以获得层级资格）

| # | 名称 | 描述 | 自动修复 |
|---|------|-------------|--------------|
| 6 | `unit_tests_present` | 包声明 unit_tests[] 并带有至少一个匹配测试文件 | 是 |
| 7 | `e2e_tests_present` | 包声明 e2e_tests[] 并带有至少一个匹配测试文件 | 是 |
| 8 | `llm_eval_present` | 包声明 llm_evals[] 并带有 >= 1 个包含 >= 3 个案例的文件 | 是 |
| 9 | `bootstrap_runbook_present` | 包声明 runbooks.bootstrap 并且文件非空 | 是 |
| 10 | `license_present` | LICENSE 文件存在于包根目录（信息性徽章） | 是 |

_从 `src/core/skillpack/rubric.ts` 通过 `bun run scripts/build-skillpack-anatomy.ts` 生成。_

<!-- END auto-generated:rubric -->

## 层级资格

| 层级 | 要求 |
|------|-------------|
| `endorsed` | 全部 5 个核心 + 全部 5 个徽章，加上注册表仓库中的 Garry 的 `endorsements.json` 覆盖 |
| `community` | 全部 5 个核心 + >= 3 个 5 个徽章。PR 合并时的默认层级。 |
| `experimental` | 全部 5 个核心 + < 3 个徽章 |
| `blocked` | 任何核心维度失败 |

## CLI 参考（第三方路径）

```bash
# 发布者侧
gbrain skillpack init my-pack         # 搭建树
gbrain skillpack doctor my-pack       # 查看分数 + 修复提示
gbrain skillpack doctor my-pack --fix --yes  # 自动搭建缺失的部分
gbrain skillpack pack my-pack         # 确定性 tarball + SHA-256

# 消费者侧
gbrain skillpack search <query>       # 浏览注册表
gbrain skillpack info <name>          # 显示完整包元数据
gbrain skillpack scaffold <source>    # owner/repo、https、./dir、./*.tgz
gbrain skillpack registry --url X     # 指向自定义注册表
```

## 另见

- `examples/skillpack-reference/` —— 实时 10/10 参考包
- `docs/designs/SKILLPACK_REGISTRY_V1_SPEC.md` —— 战略规范 + 决策
- `docs/guides/skillpacks-as-scaffolding.md` —— v0.36 脚手架/参考模型
