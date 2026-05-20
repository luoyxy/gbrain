# 个人 AI 的家酿：包管理器宣言

**日期**：2026-03
**状态**：概念验证
**作者**：@garrytan

## 问题

管理个人 AI 基础设施（向量数据库、嵌入模型、LLM 端点、技能包）比管理 macOS 上的 Unix 工具（感谢 Homebrew！）要混乱得多。

目前：
- 你需要手动编辑 `gbrain.yml`。
- 嵌入模型分散在 `~/.cache` 和 `~/Library/Application Support` 中。
- 没有“标准路径”来放置技能包。
- 更新意味着 `git pull` + 祈祷。

## 提案：GBrain 包管理器（gbpm）

受 Homebrew 启发，但针对个人 AI 定制：

### 核心概念

1.  **包（Package）** = 可分发单元（技能包、嵌入模型、LLM 适配器）。
2.  **酒桶（Keg）** = 本地安装目录（`~/.gbrain/cellar/`）。
3.  **配方（Formula）** = 包的声明式描述（`package.yaml`）。
4.  **倒酒（Pour）** = 安装/更新/依赖解析。

### 命令设计

```bash
# 安装技能包
gbrain pour install rag-eval --version 1.2.3

# 更新所有包
gbrain pour upgrade

# 切换版本（类似 brew switch）
gbrain pour switch embedding-model --to bge-m3-v2026

# 列出已安装的内容
gbrain pour list

# 诊断（类似 brew doctor）
gbrain pour doctor
```

### 包结构

```
~/.gbrain/cellar/
├── rag-eval/
│   ├── 1.2.3/
│   │   ├── skill.md
│   │   ├── eval_capture.ndjson
│   │   └── DEPENDENCIES.md
│   └── CURRENT -> 1.2.3/   # 符号链接
├── embedding-model/
│   ├── bge-m3-v2025/
│   └── bge-m3-v2026/
└── llm-adapter/
    └── openai-v2/
```

### 依赖解析

使用 Homebrew 的 `ruby` DSL 风格，但使用 YAML：

```yaml
# skills/rag-eval/package.yaml
name: rag-eval
version: 1.2.3
dependencies:
  - embedding-model >= bge-m3-v2025
  - llm-adapter == openai-v2
conflicts:
  - legacy-eval < 1.0
post_install: |
  gbrain eval export --output ~/.gbrain/cellar/rag-eval/1.2.3/baseline.ndjson
```

### 与 GBrain 集成

- `gbrain init` 将 `~/.gbrain/cellar/` 设置为技能包根目录。
- `gbrain skill-load` 从 `cellar/CURRENT/` 读取。
- `gbrain upgrade`（v0.38+）使用 `gbrain pour upgrade` 更新技能包。

## 为什么不是现有的包管理器？

- **Homebrew**：针对 macOS 二进制文件和 Unix 工具。不处理向量数据库或 LLM 权重。
- **npm/pip**：针对代码库，而非“AI 资产”（嵌入、技能、评估）。
- **OCI 镜像（Docker）**：太重；我们想要快速、本地优先的“倒酒”。

## 实施计划

### 阶段 1：原型（v0.38）
- [ ] 实现 `gbrain pour install <skillpack>`（从 GitHub 或本地路径获取）。
- [ ] 构建依赖解析器（使用 Z3 或简单的拓扑排序）。
- [ ] 编写 `package.yaml` 规范（参见 `SKILLPACK_REGISTRY_V1_SPEC.md`）。

### 阶段 2：注册表（v0.39）
- [ ] 启动 `github.com/garrytan/gbrain-packages`（类似 `homebrew/core`）。
- [ ] 接受 PR 以添加新技能包。
- [ ] 实现 `gbrain pour search <query>`（全文 + 向量搜索）。

### 阶段 3：生态系统（v0.40）
- [ ] 为其他代理（OpenClaw、Codex）提供“GBrain 包”。
- [ ] 构建“一键部署”技能包（例如 `gbrain pour install ceo-diligence-suite`）。

## 风险

- **范围蔓延**：不要重新实现 apt/rpm。保持专注（AI 资产）。
- **信任**：谁可以将包上传到注册表？需要签名 + 审核。
- **存储**：嵌入模型很大（数 GB）。需要垃圾回收（`gbrain pour cleanup`）。

## 成功标准

- 用户可以在 < 2 分钟内 `gbrain pour install <skillpack>`。
- 技能包作者可以 `gbrain pour publish`（无需 Rust/Go 知识）。
- 代理（OpenClaw）可以查询 GBrain 包注册表以找到最佳技能。

---

*“家酿赋予 Unix 力量；GBrain 包管理器将赋予个人 AI 力量。”*