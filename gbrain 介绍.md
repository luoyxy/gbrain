我来帮你分析这个 GitHub 仓库。
下面是 `garrytan/gbrain` 这个仓库的深入分析。

## 一句话概括

**GBrain** 是一个给 AI 智能体（AI Agent）打造的"大脑"系统——一套面向生产的**记忆 + 知识图谱 + 混合检索**基础设施，让本来"很聪明但很健忘"的 AI 智能体拥有可以持续积累、自动连接、自我进化的长期记忆。

作者是 **Garry Tan**（Y Combinator 总裁兼 CEO），项目仅用 12 天就在他自己的 OpenClaw / Hermes 部署中跑到了生产规模：17,888 个页面、4,383 个人物、723 家公司、21 个 cron 任务在自主运行。

仓库现在大约 **17.7k stars / 2.4k forks**，License 是 MIT，主语言 TypeScript（98%），用 Bun 运行。

---

## 核心理念

> "在你睡觉时，智能体摄取会议、邮件、推文、电话；丰富每一个人和公司；自动修复引用、整合记忆。早上你醒来时，你的智能体比昨晚更聪明。"

设计哲学：**thin harness, fat skills（薄外壳 + 厚技能）**，**markdown 即配方**。

---

## 主要功能模块

| 模块 | 说明 |
|---|---|
| **自动连线知识图谱** | 写入页面时自动抽取实体并生成 `attended / works_at / invested_in / founded / advises` 等类型化边，**零 LLM 调用**，纯模式匹配 |
| **混合检索 Hybrid Search** | pgvector + HNSW 向量召回 + BM25 关键词 + 倒数排名融合 (RRF) + 来源加权 + 查询改写；P@5 49.1%、R@5 97.9%，比纯向量 RAG 高 +31.4 P@5 |
| **ZeroEntropy 默认嵌入栈** (v0.36.2.0) | zembed-1（1280 维 Matryoshka）+ zerank-2 重排；比 OpenAI 快 2.2×、便宜 2.6× |
| **自动驾驶 doctor** (v0.36.4.0) | `gbrain doctor --remediate --yes --target-score 90 --max-usd 5` 自动按依赖顺序修复，带成本上限 |
| **时间轨迹 + 创始人评分卡** (v0.35.7) | 在页面 `## Facts` 块声明 `mrr=50000, arr=2000000`，自动生成按时间轴的索赔准确度、一致性、增长方向、风险信号 |
| **Minions 任务队列** | BullMQ 形态、Postgres 原生；支持持久化子智能体、shell 任务审计、级联超时、速率限制租约 |
| **43 个内置技能 (Skills)** | 路由表在 `skills/RESOLVER.md`，覆盖摄取、丰富、查询、引用修复、cron、报告、语音、迁移等 |
| **评估框架** | LongMemEval 公共基准 + 三厂商前沿模型交叉验证 + 矛盾检测 |

---

## 技术栈

- **语言/运行时**: TypeScript + Bun
- **数据库**:
  - 默认 **PGLite**（Postgres 17 WASM，2 秒就绪，零配置）
  - 生产规模 → Postgres + pgvector（Supabase 或自建）
- **向量索引**: pgvector HNSW
- **嵌入/重排**: ZeroEntropy（默认）/ OpenAI / Voyage 可切换
- **协议**: **MCP (Model Context Protocol)**，同时支持 stdio 和 HTTP + OAuth 2.1
- **集成**: Twilio、OpenAI Realtime、Gemini、Azure、MiniMax、Ollama、llama.cpp、LiteLLM

---

## 目录结构（要点）

```
gbrain/
├── src/                    # 源码，含 core/engine.ts 的 BrainEngine 接口（约 47 个操作）
├── skills/                 # 43 个技能 + RESOLVER.md 路由
├── recipes/                # markdown 形式的集成"配方"
├── examples/skillpack-reference/
├── docs/                   # 架构 / 集成 / MCP / 评估 / 设计理念
├── evals/                  # 评估测试
├── admin/                  # /admin 管理后台
├── templates/  scripts/  test/
├── gbrain.yml              # 主配置
├── openclaw.plugin.json    # OpenClaw 插件配置
├── llms.txt / llms-full.txt
├── docker-compose.ci.yml / docker-compose.test.yml
└── CLAUDE.md / AGENTS.md / INSTALL_FOR_AGENTS.md
```

---

## 使用方式

### 1. 智能体平台插件（OpenClaw / Hermes）
```bash
gbrain init --pglite
gbrain skillpack scaffold --all
```

### 2. CLI 独立使用
```bash
bun install -g github:garrytan/gbrain
gbrain init --pglite           # 2 秒就绪，无需 Docker
gbrain doctor                  # 健康检查
gbrain search "who works at acme AI?"
gbrain graph-query people/garry-tan --depth 2
```

### 3. 作为 MCP 服务器
```bash
gbrain serve            # stdio，给 Claude Desktop / Cursor
gbrain serve --http     # HTTP + OAuth 2.1，附带 /admin 后台
```
兼容 Claude Desktop、Claude Code、Cursor、Windsurf、ChatGPT、Perplexity、Cowork 等任意 MCP 客户端。

---

## 架构亮点

1. **双引擎统一契约**：`src/core/engine.ts` 定义 `BrainEngine` 接口（约 47 个操作），PGLite 和 Postgres 两套实现共用一份契约；CLI 和 MCP 都从单一源生成。
2. **大脑仓库 = 唯一真理源**：知识存在 Git 仓库（markdown 文件），Postgres 只是检索副本，可重建。
3. **双正交组织轴**：`brain`（数据库）⊥ `source`（仓库），用 `.gbrain-source` 文件 + 6 层优先级链做路由。
4. **图为什么重要**：向量返回"语义接近"的，图返回"事实关联"的；只有两者结合的混合检索才同时具备 high precision + high recall。

---

## 核心工作循环

```
信号 → 检索 → 响应 → 写入 → 自动连线 → 同步
(每条消息) (大脑优先) (上下文增强) (页面+时间线) (类型边+反链) (cron 保鲜)
```

---

## 总结

GBrain 不是一个简单的"RAG 库"，而是 **AI 智能体的长期记忆操作系统**：
- 对**个人/小团队**：30 分钟就能搭一个会持续成长、能自动整理你所有会议邮件电话的个人智能体大脑。
- 对**工程师/创业者**：是一个非常优秀的 reference 实现——演示了如何把 **markdown 仓库 + Postgres + pgvector + MCP + 任务队列** 拼成一个生产可用的智能体后端。
- **最大特色**：来自 YC 总裁本人每天高强度使用的实战打磨，没有"玩具感"，很多设计（doctor 自动驾驶、创始人评分卡、混合检索基准）都体现出明确的生产意识。

如果你想自己跑一遍，最低门槛只要一条命令：`gbrain init --pglite`，2 秒后就能拿到一个能用的 MCP 大脑服务。