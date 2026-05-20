# GBrain v0：原生Postgres个人知识大脑

> **历史设计文档。** 这是PGLite落地前的原始v0规范。几个前瞻性部分——最显著的是SQLite引擎计划——已被PGLite（通过WASM嵌入的Postgres）取代，它使用与Postgres相同的SQL方言，并且消除了对单独的FTS5/sqlite-vss转换层的需求。此处保留用于历史背景；有关当前的引擎架构，请参见[`ENGINES.md`](ENGINES.md)，有关实际实现历史，请参见[`CHANGELOG.md`](../CHANGELOG.md)。

## 这是什么

GBrain是一个编译智能系统。不是笔记应用。不是"与你的笔记聊天"。

每个页面都是一份情报评估。分隔线上方：编译真相（你当前的最佳理解，当证据变化时重写）。分隔线下方：时间线（仅追加的证据轨迹）。AI代理维护大脑。MCP客户端查询它。智能存在于丰富的markdown技能中，而不是应用代码中。

核心洞察：大规模个人知识是一个智能问题，而不是存储问题。

## 为什么存在

一个包含7,471个文件/2.3GB的markdown维基正在让git窒息。对于维基类使用，Git在~5K文件后无法扩展。编译真相+时间线模型（Karpathy风格的知识页面）是正确的，但它需要在其下有真正的数据库。

已经有一个生产级RAG系统（Ruby on Rails，Postgres + pgvector），具有3层分块、带RRF的混合搜索、多查询扩展和4层去重。GBrain将这些经过验证的模式移植到一个独立的Bun + TypeScript工具中。

## 知识模型

```
+--------------------------------------------------+
|  Page: concepts/do-things-that-dont-scale         |
|                                                   |
|  --- front matter (YAML) ---                       |
|  type: concept                                    |
|  tags: [startups, growth, pg-essay]               |
|                                                   |
|  === COMPILED TRUTH ===                           |
|  当前最佳理解。                      |
|  根据新证据重写。                       |
|  这是"我们现在知道什么"部分。          |
|                                                   |
|  ---                                              |
|                                                   |
|  === TIMELINE ===                                 |
|  仅追加的证据轨迹。                      |
|  - 2013-07-01: 发布在paulgraham.com        |
|  - 2024-11-15: 在批次启动演讲中引用   |
|  永不编辑，仅追加。                     |
+--------------------------------------------------+
          |                    |
          v                    v
  [语义分块]     [递归分块]
  (为编译真相     (为时间线提供
   提供最佳质量)   可预测的格式)
          |                    |
          v                    v
  [嵌入: text-embedding-3-large, 1536维]
          |
          v
  [HNSW索引 + tsvector + pg_trgm]
          |
          v
  [混合搜索: 向量 + 关键词 + RRF融合]
```

## 架构决策

### v0技术栈

| 层级 | 选择 | 原因 |
|-------|--------|-----|
| 数据库 | Postgres + pgvector | 经过验证的RAG模式，生产测试。世界级的混合搜索。 |
| 托管 | Supabase Pro ($25/月) | 零运维。托管的Postgres、pgvector、连接池。8GB存储。 |
| 运行时 | Bun + TypeScript | 与GStack生态系统一致。快速。编译为单个二进制文件。 |
| 嵌入 | OpenAI text-embedding-3-large | 1536维（通过dimensions API从3072降低）。约$0.13/1M tokens。 |
| LLM（分块/扩展） | Claude Haiku | 用于主题边界检测和查询扩展的最便宜的模型。 |
| 后台任务 | Trigger.dev | 无服务器。嵌入回填、过期检测、孤立审计、标签一致性。 |
| 分发 | npm包 + 编译二进制 + MCP服务器 | 用于OpenClaw的库，用于人类的CLI，用于代理的MCP。 |

### 我们的选择及原因

**选择Postgres而非SQLite。** 我们在Postgres上运行了3年以上的经过验证的RAG模式。tsvector用于全文搜索，pgvector HNSW用于语义搜索，pg_trgm用于模糊slug匹配。将这些移植到SQLite意味着从头重新实现搜索。SQLite是面向轻量级开源用户的未来可插拔引擎（参见`docs/ENGINES.md`）。

**选择Supabase而非自托管。** 零维护。大脑应该是AI代理使用的基础设施，而不是你要管理的东西。免费层有pgvector但只有500MB（不足以容纳7K+带嵌入的页面，需要约750MB）。Pro层$25/月提供8GB。v1中没有Docker，没有自托管Postgres。

**完整移植而非最小可行。** 模式已得到验证。移植是机械的。发布完整的3层分块+混合搜索+4层去重意味着从第一天起就拥有世界级的RAG。"我们稍后会添加"意味着稍后重建一切。

**库优先分发。** gbrain是一个npm包。OpenClaw将其作为依赖项安装（`bun add gbrain`），直接导入引擎。零开销函数调用，共享连接池，TypeScript类型。CLI和MCP服务器是同一引擎的薄包装。

**基于触发器的tsvector（不是生成列）。** 要在全文搜索中包含timeline_entries内容，tsvector需要跨多个表。生成列不能进行跨表引用。pages + timeline_entries上的触发器更新search_vector。

**导入期间自动嵌入。** 没有单独的嵌入步骤。`gbrain import`在一次传递中分块和嵌入。进度条显示状态。为想要延迟的用户提供`--no-embed`标志。`embedded_at`列启用`gbrain embed --stale`进行回填。

## 分发模型

```
+-------------------+     +-------------------+     +-------------------+
|   npm包     |     |  编译二进制  |     |   MCP服务器      |
|   (库)       |     |  (CLI)            |     |   (stdio)         |
+-------------------+     +-------------------+     +-------------------+
|                   |     |                   |     |                   |
| bun add gbrain    |     | GitHub Releases   |     | gbrain serve      |
| import { Postgres |     | npx gbrain        |     | 在 mcp.json       |
|   Engine }        |     |                   |     |  中配置          |
+-------------------+     +-------------------+     +-------------------+
         |                         |                         |
         v                         v                         v
  [BrainEngine    [BrainEngine    [BrainEngine
   接口]          引擎]           服务器]
```

package.json导出：
- 库：`src/core/index.ts`（BrainEngine接口，PostgresEngine，类型）
- CLI二进制：`src/cli.ts`

## 首次体验

### 路径1：OpenClaw用户（主要）

OpenClaw是使用gbrain作为其知识后端的AI编排器。这是最常见的安装路径。

```bash
# 1. 作为ClawHub技能安装gbrain
clawhub install gbrain

# 2. 技能在首次使用时运行引导式设置：
#    - 检测Supabase CLI是否可用
#    - 如果是：自动配置新的Supabase项目
#    - 如果否：提示输入连接URL
#    - 运行模式迁移
#    - 扫描markdown仓库并导入用户的内容
#    - 显示实时实体/边缘提取动画
#    - 大脑准备就绪

# 3. 从OpenClaw，大脑工具现在可用：
#    "从你的大脑搜索[主题]"
#    "摄取我今天会议的笔记"
#    "大脑中有多少页面？"
```

幕后，`clawhub install gbrain`：
1. 安装`gbrain` npm包
2. 提供SKILL.md文件（摄取、查询、维护、丰富、简报、迁移）
3. 向编排器注册大脑工具
4. 在首次使用时运行`gbrain init --supabase`（引导式向导）

### 路径2：CLI用户（独立）

```bash
# 1. 安装
npm install -g gbrain
# 或：从GitHub Releases下载二进制文件

# 2. 使用Supabase初始化
gbrain init --supabase
# 引导式向导：
#   尝试1：Supabase CLI自动配置（npx supabase）
#   尝试2：如果CLI未安装或未登录，回退到：
#          "输入你的Supabase连接URL："
#   然后：运行模式迁移，验证pgvector扩展
#   然后：验证数据库已准备好导入
#   输出："大脑准备就绪。运行：gbrain import <你的仓库>""

# 3. 导入你的数据
gbrain import /path/to/markdown/wiki/
# 进度条：7,471个文件，自动分块，自动嵌入
# ~30秒用于文本导入，~10-15分钟用于嵌入

# 4. 查询
gbrain query "PG对不扩展的事情说什么？"
```

### 路径3：MCP用户（Claude Code，Cursor）

```json
// ~/.config/claude/mcp.json
{
  "mcpServers": {
    "gbrain": {
      "command": "gbrain",
      "args": ["serve"]
    }
  }
}
```

然后在Claude Code中："搜索我大脑中关于机器人技术的人"

### 初始化向导详细信息

`gbrain init --supabase`运行以下步骤：

```
步骤1：数据库设置
  ├── 检查Supabase CLI（npx supabase --version）
  │   ├── 找到 + 已登录 → 自动创建项目
  │   │   ├── 通过supabase CLI创建项目
  │   │   ├── 等待项目准备就绪
  │   │   └── 提取连接字符串
  │   ├── 找到 + 未登录 →
  │   │   └── 错误："找到Supabase CLI但未登录。"
  │   │         原因："你需要先认证。"
  │   │         修复："运行：npx supabase login"
  │   └── 未找到 → 回退到手动
  │       └── 提示："输入你的Supabase连接URL："
  │
步骤2：模式迁移
  ├── 连接到数据库
  ├── CREATE EXTENSION IF NOT EXISTS vector
  ├── CREATE EXTENSION IF NOT EXISTS pg_trgm
  ├── 运行src/schema.sql（所有表、索引、触发器）
  └── 验证：测试插入 + 向量查询

步骤3：配置
  ├── 写入 ~/.gbrain/config.json（0600权限）
  │   { "database_url": "...", "service_role_key": "..." }
  └── 验证连接

步骤4：木柴导入
  ├── 导入10篇捆绑的PG文章作为演示数据
  ├── 分块 + 嵌入每篇文章
  ├── 显示实时实体/边缘提取动画：
  │   "正在提取实体... Paul Graham（人物），Y Combinator（公司）..."
  │   "正在创建链接... Paul Graham → Y Combinator（创办）..."
  └── 输出："大脑准备就绪。已导入10个页面。"

步骤5：首次查询
  └── "尝试：gbrain query 'PG对不扩展的事情说什么？'"
```

每个错误都遵循样式指南：问题 + 原因 + 修复 + 文档链接。

## CLI命令

```
gbrain init [--supabase|--url <conn>]     # 创建大脑
gbrain get <slug>                          # 读取页面
gbrain put <slug> [< file.md]             # 写入/更新页面
gbrain search <query>                      # 关键词搜索（tsvector）
gbrain query <question>                    # 混合搜索（RRF + 扩展）
gbrain ingest <file> [--type ...]         # 摄取源文档
gbrain link <from> <to> [--type <type>]   # 创建类型化链接
gbrain unlink <from> <to>                 # 移除链接
gbrain graph <slug> [--depth 5]           # 遍历链接图（递归CTE）
gbrain backlinks <slug>                    # 入站链接
gbrain tags <slug>                         # 列出标签
gbrain tag <slug> <tag>                    # 添加标签
gbrain untag <slug> <tag>                  # 移除标签
gbrain timeline [<slug>]                   # 查看时间线
gbrain timeline-add <slug> <date> <text>  # 添加时间线条目
gbrain list [--type] [--tag] [--limit]    # 带过滤器的列表
gbrain stats                               # 大脑统计
gbrain health                              # 大脑健康仪表板
gbrain import <dir> [--no-embed]          # 从markdown目录导入
gbrain export [--dir ./export/]           # 导出到markdown（往返）
gbrain embed [<slug>|--all|--stale]       # 生成/刷新嵌入
gbrain serve                               # MCP服务器（stdio）
gbrain call <tool> '<json>'               # 原始工具调用
gbrain upgrade                             # 自我更新（npm，二进制，ClawHub）
gbrain version                             # 版本信息
gbrain config [get|set] <key> [value]     # 大脑配置
```

CLI和MCP公开相同的操作。漂移测试断言两个接口的所有操作的相同结果。

## 数据库模式

Postgres + pgvector中的9个表：

```
+------------------+     +-------------------+     +------------------+
|     pages        |---->|  content_chunks   |     |     links        |
|------------------|     |-------------------|     |------------------|
| id (PK)          |     | id (PK)           |     | id (PK)          |
| slug (UNIQUE)    |     | page_id (FK)      |     | from_page_id(FK) |
| type             |     | chunk_index       |     | to_page_id(FK)   |
| title            |     | chunk_text        |     | link_type        |
| compiled_truth   |     | chunk_source      |     | context          |
| timeline         |     | embedding (1536)  |     +------------------+
| frontmatter(JSONB)|    | model             |     
| search_vector    |    | token_count       |     +------------------+
| created_at       |    | embedded_at       |     |   tags         |
+------------------+    +-------------------+     |------------------|
       |                                            | id (PK)          |
       +----> +--------------------+               | page_id (FK)     |
       |       | timeline_entries   |               | tag              |
       |       |--------------------|               +------------------+
       |       | id (PK)            |
       |       | page_id (FK)       |
       |       | date               |
       |       | source             |
       |       | summary            |
       |       | detail (markdown)  |
       |       +--------------------+
       |
       +----> +--------------------+
               | raw_data        |
               |--------------------|
               | id (PK)            |
               | page_id (FK)       |
               | source             |
               | data (JSONB)       |
               +--------------------+

       +----> +--------------------+
               |   page_versions  |
               |--------------------|
               | id (PK)          |
               | page_id (FK)     |
               | compiled_truth   |
               | frontmatter      |
               | snapshot_at      |
               +--------------------+

       +----> +--------------------+
               |    config        |
               |--------------------|
               | key (PK)         |
               | value            |
               +--------------------+
```

索引：
- `pages.slug`：UNIQUE约束（隐式B树）
- `pages.type`：B树
- `pages.search_vector`：GIN（全文搜索）
- `pages.frontmatter`：GIN（JSONB查询）
- `pages.title`：GIN，带有pg_trgm（模糊slug解析）
- `content_chunks.embedding`：HNSW，带有余弦操作（向量搜索）
- `content_chunks.page_id`：B树
- `links.from_page_id`，`links.to_page_id`：B树
- `tags.tag`，`tags.page_id`：B树
- `timeline_entries.page_id`，`timeline_entries.date`：B树

## 搜索架构

```
查询："何时应该忽略传统智慧？"
           |
           v
+---------------------+
| 多查询扩展|
| (Claude Haiku)       |
| "反向思维"
| "逆 crowd"
+---------------------+
     |   |   |
     v   v   v
  [嵌入所有3个查询]
     |   |   |
     v   v   v
+--------+----+--------+
| 向量 |    |  关键词|
| 搜索 |    |  搜索 |
| (HNSW  |    | (tsv + |
| 余弦)|    |  ts_rank)|
+--------+----+--------+
     |   |   |
     v   v   v
  [RRF融合：分数 = sum(1/(60 + 排名))]
           |
           v
  [4层去重]
  (1. 按来源   |
   2. 余弦 > 0.85 |
   3. 类型上限 60% |
   4. 每页最大值)
           |
           v
  [过时警报]
  (编译真相     |
   比最新的     |
   时间线条目     |
   旧)
           |
           v
  [结果]
```

## 分块策略

| 策略 | 输入 | 算法 | 何时使用 |
|----------|-------|-----------|-------------|
| 递归 | 任何文本 | 5级分隔符层次结构（段落 > 行 > 句子 > 子句 > 空白）。300词块，50词重叠。 | 时间线（可预测的格式），批量导入 |
| 语义 | 质量文本 | 嵌入每个句子，Savitzky-Golay过滤器用于主题边界，余弦相似度最小值。回退到递归。 | 编译真相（智能评估） |
| LLM引导 | 高价值文本 | 预分割为128词候选，Claude Haiku在滑动窗口中找到主题偏移。每个窗口3次重试。 | 通过`--chunker llm`显式请求 |

调度：编译真相获取语义分块器。时间线获取递归分块器。通过`--chunker`标志或frontmatter中的`chunk_strategy`覆盖。

## 技能（富markdown，无代码）

每个技能都是一个markdown文件，AI代理（Claude Code，OpenClaw）读取并遵循。技能包含工作流、启发式和质量的规则。二进制文件中没有技能逻辑。

| 技能 | 它做什么 |
|-------|-------------|
| `skills/ingest/SKILL.md` | 摄取会议、文档、文章。更新编译真相，追加时间线，创建链接。 |
| `skills/query/SKILL.md` | 3层搜索（FTS + 向量 + 结构化）。用引用综合答案。 |
| `skills/maintain/SKILL.md` | 查找矛盾、过时信息、孤立页面、死链接、标签不一致。 |
| `skills/enrich/SKILL.md` | 从外部API丰富（Crustdata，Happenstance，Exa）。存储原始数据，提炼到编译真相。 |
| `skills/briefing/SKILL.md` | 每日简报：带有上下文的会议、活跃交易、开放线索。 |
| `skills/migrate/SKILL.md` | 从Obsidian、Notion、Logseq、纯markdown、CSV、JSON、Roam通用迁移。 |

## CEO范围扩展（v0中接受）

1. **带有漂移测试的CLI/MCP奇偶校验。** 两个接口都是引擎的薄包装。测试断言相同的输出。
2. **智能slug解析。** 通过pg_trgm进行模糊匹配以进行读取。写入需要精确的slug。`gbrain get "dont scale"`解析为`concepts/do-things-that-dont-scale`。
3. **大脑健康仪表板。** `gbrain health`显示页面计数、嵌入覆盖、过时页面、孤立页面、死链接。
4. **标准化时间线。** 仅`timeline_entries`表（无TEXT列）。`detail`字段支持markdown。
5. **页面版本控制。** `page_versions`表存储完整快照（compiled_truth + frontmatter + 链接）。`gbrain history`，`gbrain diff`，`gbrain revert`命令。还原重新分块并重新嵌入。
6. **类型化链接 + 图遍历。** `link_type`列（knows，invested_in，works_at，等）。`gbrain graph`使用递归CTE，最大深度（默认5，可通过`--depth`配置）。
7. **Trigger.dev数据清理作业。** 每日嵌入回填、每周过时检测 + 孤立审计 + 标签一致性。
8. **过时警报注释。** 搜索结果标记编译真相比最新时间线条目旧的页面。
9. **摄取时时间线合并。** 在所有提到的实体中创建相同的事件。

## 安全模型（v0）

单用户，仅本地：
- `~/.gbrain/config.json`中的Supabase服务角色密钥（0600权限）
- MCP stdio传输本质上是本地的（客户端生成`gbrain serve`作为子进程）
- v0中没有多用户，没有RLS，没有OAuth

多用户路径（未来）：Supabase RLS + 每用户API密钥

## 升级机制

`gbrain upgrade`检测安装方法并相应地更新：

| 路径 | 如何 |
|------|-----|
| npm | `bun update gbrain`（或npm等效项） |
| 编译二进制 | 将新二进制文件下载到临时目录，原子重命名交换，执行新进程 |
| ClawHub | `clawhub update gbrain` |

版本检查：将本地版本与最新的GitHub release标签进行比较。

## 存储和成本估算

### 存储（7,471个页面约750MB）

| 组件 | 大小 |
|-----------|------|
| 页面文本（compiled_truth + 时间线） | ~150MB |
| JSONB frontmatter | ~20MB |
| tsvector + GIN索引 | ~50MB |
| 内容块（~22K，文本） | ~80MB |
| 嵌入（22K x 1536浮点数 x 4字节） | ~134MB |
| HNSW索引开销（~2x嵌入） | ~270MB |
| 链接、标签、时间线、raw_data、版本 | ~50MB |
| **总计** | **~750MB** |

Supabase免费层（500MB）不适合。Supabase Pro（$25/月，8GB）是起点。

### 嵌入成本（初始导入约$4-5）

| 步骤 | 成本 |
|------|------|
| 语义分块器句子嵌入（~374K句子） | ~$1 |
| 块嵌入（~22K块） | ~$0.30 |
| 查询扩展（每查询，~3个嵌入） | 可忽略 |
| **初始导入总计** | **~$4-5** |

预算替代方案：`gbrain import --chunker recursive`跳过句子级嵌入，然后`gbrain embed --rechunk --chunker semantic`稍后升级。

## 无服务器操作栈

```
+------------------+     +-------------------+     +------------------+
|    Supabase      |     |    Vercel         |     |   Trigger.dev    |
|------------------|     |-------------------|     |------------------|
|  (Postgres +     |     |  (web/API,        |     |  (后台     |
|   pgvector)      |     |   optional)       |     |   jobs)          |
+------------------+     +-------------------+     +------------------+
| 数据库连接池  |     | 未来web UI     |     | 嵌入回填   |
| pgvector HNSW    |     | API端点     |     | 过时检测  |
| tsvector FTS     |     | Edge函数    |     | 孤立审计     |
| pg_trgm模糊    |     |                   |     | 标签一致性  |
+------------------+     +-------------------+     +------------------+
```

CLI直接连接到Supabase Postgres。Trigger.dev和Vercel用于异步/计划工作。没有它们，CLI也能工作。

## 验证清单

1. `gbrain import /data/brain/`无损迁移所有7,471个文件
2. `gbrain export`往返到语义相同的markdown
3. `gbrain query "PG对不扩展的事情说什么？"`返回相关的混合搜索结果
4. `gbrain serve`启动MCP服务器，Claude Code可连接
5. 所有3个分块器通过测试装置产生正确的输出
6. `gbrain init --supabase`端到端工作
7. `bun test`通过所有测试
8. `clawhub install gbrain`安装技能并运行引导式设置
9. `bun add gbrain` + `import { PostgresEngine } from 'gbrain'`在外部项目中工作
10. 漂移测试通过：CLI和MCP产生相同的结果
11. `gbrain health`输出准确的大脑健康指标
12. 迁移技能成功导入Obsidian保管库

## 未来计划

有关可插拔引擎架构和未来后端计划，请参见`docs/ENGINES.md`。

### v1候选（从v0推迟）

- **`gbrain ask`自然语言CLI别名。** 简单添加。P1 TODO。
- **智能编译器。** 将每个事实视为具有来源跨度、实体链接、有效性窗口、置信度和矛盾状态的一级主张。"什么改变了，为什么，以及什么证据会再次翻转它？"来自Codex review。建立在编译真相模型之上。
- **通过Trigger.dev的主动技能。** 特定于应用程序的简报、会议准备。属于OpenClaw，而不是通用大脑基础设施。
- **多用户访问。** Supabase RLS + 每用户API密钥。v0是单用户的。
- **SQLite引擎。** 在v1之前被PGLite（通过WASM嵌入的Postgres）取代。有关当前的引擎架构，请参见[`ENGINES.md`](ENGINES.md)。
- **用于自托管Postgres的Docker Compose。** 社区PR欢迎。
- **Web UI。** 用于浏览大脑页面的可选Vercel托管仪表板。

### 接口抽象原则

所有操作都通过`BrainEngine`。引擎接口是契约。Postgres特定的功能（tsvector，pgvector HNSW，pg_trgm，递归CTE）是`PostgresEngine`内部的实现细节。接口公开能力，而不是SQL。

这意味着：
- SQLite引擎可以使用FTS5而不是tsvector来实现`searchKeyword`
- SQLite引擎可以使用sqlite-vss而不是pgvector来实现`searchVector`
- 未来的DuckDB引擎可以处理重度分析工作负载
- CLI、MCP服务器和库消费者永远不会知道下面运行哪个引擎

有关完整的接口规范，请参见[`ENGINES.md`](ENGINES.md)。（原始的SQLite引擎计划被PGLite取代；契约优先的`BrainEngine`接口使该交换干净。）

## Review历史

| Review | 运行 | 状态 | 关键发现 |
|--------|------|--------|-------------|
| `/office-hours` | 1 | APPROVED | 构建器模式。选择了完整移植方法。 |
| `/plan-ceo-review` | 1 | CLEAR | 11个提议，10个接受，1个推迟。SCOPE EXPANSION模式。 |
| `/codex-review` | 1 | issues_found | 24个点被质疑，3个接受（模糊slug，还原规范，tsvector）。 |
| `/plan-eng-review` | 2 | CLEAR | 3个问题（升级路径，导入保护栏，初始化向导），0个关键差距。 |
| `/plan-devex-review` | 1 | CLEAR | DX评分从5/10提高到7/10。TTHW 25分钟降至90秒。冠军层。 |
