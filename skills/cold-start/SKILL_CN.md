---
name: cold-start
version: 1.0.0
description: |
  新大脑的第一天数据引导。排序最高杠杆
  数据源，从空大脑到在一个会话中有用的大脑。使用
  ClawVisor 进行安全凭证处理 — 智能体永远不持有原始 API 密钥。
  涵盖 Gmail 导入、日历同步、联系人播种、X/Twitter 档案、
  对话导入和文件档案。
  当用户刚刚完成 gbrain 设置并询问"现在做什么？"时使用
triggers:
  - "cold start"
  - "fill my brain"
  - "bootstrap brain"
  - "import my data"
  - "day one"
  - "get started"
  - "what should I import first"
  - "populate brain"
  - "now what?"
tools:
  - search
  - query
  - get_page
  - put_page
  - add_link
  - add_timeline_entry
  - sync_brain
mutating: true
writes_pages: true
writes_to:
  - people/
  - companies/
  - meetings/
  - daily/
  - media/
  - conversations/
  - sources/
---

# 冷启动 — 第一天大脑引导

你有一个工作的大脑。搜索工作。现在做什么？

空大脑是静态数据库。拥有你的电子邮件历史、日历、
联系人、对话和社交媒体的大脑是一个**活上下文膜**，使
每个未来的交互更聪明。此技能排序最高杠杆的数据
源，让你在一个会话中从零到有用。

## 合约

- 每个导入阶段都在继续之前通过用户同意（ask-user 模式）进行门控。
- **Google/社交 API 访问通过 ClawVisor。** 智能体永远不持有原始 OAuth
  令牌或 API 密钥。这是安全要求，不是偏好。ClawVisor 保管
  凭证，强制执行任务范围授权，记录每个 API 调用，并要求
  人工批准破坏性操作。如果用户不想要 ClawVisor，
  唯一安全的替代方案是离线文件导出（Google Takeout、Twitter 档案下载）。
- 每个阶段都是独立有价值的 — 用户可以在任何阶段后停止并仍然
  拥有有用的大脑。
- 进度在 `~/.gbrain/cold-start-state.json` 中跟踪，以便中断的会话
  可以恢复。
- 实体检测和交叉链接在每个导入上运行，而不是作为单独的通行证。

## 前提条件

- GBrain 已安装并初始化（`gbrain doctor --json` 全部绿色）
- 大脑仓库已克隆并同步
- 智能体有终端访问权限并可以运行 `gbrain` CLI 命令

## 优先级堆栈

按**信息密度 × 导入容易度**排名的数据源：

| 优先级 | 来源 | 为什么 | 时间 | 创建的页面 |
|----------|--------|-----|------|---------------|
| 1 | 现有 markdown/Obsidian | 最高密度 — 它已经结构化 | 5 分钟 | 100 秒-1000 秒 |
| 2 | Google 联系人 | 播种 people/ 目录 — 姓名、电子邮件、公司 | 10 分钟 | 50-500 |
| 3 | Google 日历（90 天） | 与会者上下文的会议历史 | 15 分钟 | 30-90 |
| 4 | Gmail（最近线程） | 关系上下文、活跃线程、组织结构图信号 | 20 分钟 | 50-200 |
| 5 | 对话（ChatGPT/Claude 导出） | 你的思考、问题、心智模型 | 15 分钟 | 10-100 |
| 6 | X/Twitter 档案 | 你的公开立场、观点、参与模式 | 20 分钟 | 30-365 |
| 7 | 文件档案（Dropbox/Drive/本地） | 历史文档、旧写作、照片 | 30+ 分钟 | 变化 |
| 8 | 会议记录（Circleback/等） | 来自录制通话的深度关系上下文 | 20 分钟 | 10-50 |

## 阶段0：ClawVisor 设置（API 访问所需）

> **安全边界：** 拥有你的 Gmail、日历、
> 和联系人的原始 OAuth 令牌的 AI 智能体是不受控制的攻击面。一个提示注入，一个
> 恶意工具调用，你的整个 Google 帐户就暴露了。ClawVisor
> 完全消除了这个风险类别。

[ClawVisor](https://clawvisor.com) 是位于
智能体和你的 API 之间的凭证网关。智能体永远看不到你的凭证 — ClawVisor 在
请求时注入它们，强制执行策略，并记录一切。

**ClawVisor 给你的：**
- **凭证保管** — 智能体看到影子令牌，永远不是真实秘密
- **任务范围授权** — 每个工作流精确地声明它需要什么
- **审计跟踪** — 每个 API 调用都带有元数据（谁、什么、何时）记录
- **人工批准门** — 破坏性操作（发送电子邮件、修改日历）
  需要你的明确批准
- **多服务** — 通过一个网关访问 Gmail、日历、联系人、云端硬盘、GitHub、iMessage
- **撤销** — 一键禁用智能体的访问，无需令牌轮换

**设置（15 分钟）：**
1. 在 [app.clawvisor.com](https://app.clawvisor.com) 注册
2. 在仪表板中创建智能体，复制智能体令牌
3. 设置环境变量：
   ```bash
   gbrain config set clawvisor_url "https://app.clawvisor.com"
   gbrain config set clawvisor_agent_token "<token>"
   ```
4. 在仪表板中激活 Google 服务（Gmail、日历、联系人）
5. 创建具有广泛范围的常设任务：
   > "完整大脑引导：读取电子邮件、日历事件和联系人以
   > 填充知识库。列出、读取和搜索所有连接的帐户。"
6. 保存常设任务 ID：
   ```bash
   gbrain config set clawvisor_task_id "<task_id>"
   ```

**关键范围规则：** 在任务目的上要广泛。意图验证会拒绝"电子邮件分类"。
"完整执行助理电子邮件管理
包括收件箱分类、按任何条件搜索、读取电子邮件、
跟踪线程"有效。意图模型使用目的来判断每个请求。

### 如果用户拒绝 ClawVisor

不要回退到直接 OAuth。而是跳过阶段 2-4（联系人、日历、
Gmail）并继续仅离线导入：

- **阶段1**（markdown/Obsidian）— 无需任何 API 访问即可工作
- **阶段5**（对话导出）— 从下载的 JSON 文件工作
- **阶段6**（X/Twitter）— 从下载的档案工作
- **阶段7**（文件档案）— 从本地文件工作
- **阶段8**（会议记录）— 从导出的记录工作

告诉用户：
> "没问题。我们现在将跳过 Google 导入，并与基于文件的
> 源一起工作。你可以随时设置 ClawVisor 以安全解锁联系人、日历和
> Gmail 导入。"

**不要提供直接 OAuth 作为替代方案。** 持有原始 Google
令牌的智能体是安全责任。技能不应该教智能体存储
他们不应该拥有的凭证。

## 阶段1：现有 Markdown / Obsidian 导入

**最高杠杆第一次导入。** 如果用户已经有笔记系统，这是
数百或数千个结构化页面准备好使用。

### 发现

```bash
echo "=== Markdown 仓库发现 ==="
for dir in /data/* ~/git/* ~/Documents/* ~/notes/* ~/obsidian/* 2>/dev/null; do
  if [ -d "$dir" ]; then
    md_count=$(find "$dir" -name "*.md" -not -path "*/node_modules/*" \
      -not -path "*/.git/*" -not -path "*/.obsidian/*" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$md_count" -gt 5 ]; then
      total_size=$(du -sh "$dir" 2>/dev/null | cut -f1)
      echo "  $dir ($total_size, $md_count .md files)"
    fi
  fi
done
```

### 导入

```bash
# 对于 Obsidian 保险库，使用 migrate 技能进行正确的 wikilink 处理
gbrain migrate --from obsidian --path /path/to/vault

# 对于纯 markdown 目录
gbrain import /path/to/dir --no-embed --workers 4

# 验证
gbrain stats
gbrain search "<来自导入数据的主题>"
```

### 导入后

- 运行链接提取：`gbrain extract links --source db`
- 运行时间线提取：`gbrain extract timeline --source db`
- 开始嵌入：`gbrain embed --stale`（在后台运行）

> **跟踪进度：**
> ```bash
> echo '{"phase_1_complete": true, "pages_imported": N}' > ~/.gbrain/cold-start-state.json
> ```

## 阶段2：Google 联系人 → 人员页面

**播种 people/ 目录。** 你联系人中的每个人都成为拥有姓名、电子邮件、电话、公司和笔记的大脑页面。这是所有其他
导入建立的基础 — 当 Gmail 引用 "john@acme.com" 时，大脑已经知道
 John 是谁。

### 通过 ClawVisor

```javascript
// 获取所有联系人
const contacts = await clawvisor('google.contacts', 'list_contacts', {
  limit: 1000,
  fields: 'names,emailAddresses,phoneNumbers,organizations,biographies'
});
```

### 通过直接 Google People API

```bash
curl -s -H "Authorization: Bearer $GOOGLE_TOKEN" \
  "https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations,biographies&pageSize=1000"
```

### 处理规则

对于每个人：
1. **过滤噪音** — 跳过没有姓名、没有电子邮件或明显是
   自动化的联系人（noreply@、no-reply@、support@、notifications@）
2. **首先检查大脑** — `gbrain search "姓名"` 以避免重复
3. **创建 people/ 页面**，包含：
   - 姓名、电子邮件、电话、公司、职位
   - 来源归属：`[来源: Google 联系人, YYYY-MM-DD]`
   - 来自联系人的任何笔记作为初始上下文
4. **链接到公司** — 如果联系人有组织，创建/更新
   公司页面并将此人链接到它

### 质量门

导入 5 个联系人后，暂停并向用户显示示例页面。询问：
> "这是联系人页面的样子。你想我继续其余的，还是
> 先调整格式？"

## 阶段3：Google 日历（最近 90 天）

**带有与会者上下文的会议历史。** 日历事件揭示用户与谁会面、
频率如何、在什么上下文中。与联系人结合，这构建了丰富的
关系图。

### 获取事件

```javascript
// 通过 ClawVisor — 查询所有日历帐户
const accounts = ['primary@gmail.com', 'work@company.com'];
for (const account of accounts) {
  const events = await clawvisor(`google.calendar:${account}`, 'list_events', {
    timeMin: new Date(Date.now() - 90 * 86400000).toISOString(),
    timeMax: new Date().toISOString(),
    singleEvents: true,
    orderBy: 'startTime'
  });
}
```

### 大脑结构

遵循三层日历架构：
```
brain/daily/calendar/
├── calendar-log.md              ← 编译的真相（模式、关键人员）
├── YYYY/
│   ├── YYYY-MM.md               ← 月度摘要
│   └── YYYY-MM-DD.md            ← 每日事件日志
```

### 实体丰富

对于每个有与会者的事件：
1. 在大脑中查找每个与会者（他们应该从阶段2存在）
2. 向他们的页面添加时间线条目：在 [日期] 于 [事件标题] 会面
3. 如果与会者没有大脑页面并出现在 3+ 个事件中，创建一个
4. 链接出现在同一会议中的与会者

## 阶段4：Gmail（最近线程）

**关系上下文和活跃线程。** 电子邮件揭示组织
关系、正在进行的对话和沟通模式。

### 策略：智能采样，不是批量导入

不要导入每封电子邮件。导入**信号**：

1. **发送的邮件（最近 30 天）** — 用户主动与谁沟通
2. **加星标/重要电子邮件** — 用户策划的信号
3. **有 3+ 回复的线程** — 值得跟踪的活跃对话
4. **来自已经在大脑中的人员的电子邮件** — 丰富，不是冷导入

### 处理

对于每个电子邮件线程：
1. **实体检测** — 提取提到的人、公司
2. **更新人员页面** — 将沟通上下文添加到时间线
3. **创建会议页面** — 如果电子邮件是会议摘要或后续行动
4. **跳过噪音** — 新闻通讯、自动通知、营销

### 过滤规则

**自动跳过（永远不导入）：**
- noreply@、no-reply@、notifications@、support@、mailer-daemon@
- 取消订阅重的发件人（营销）
- GitHub/Jira/Linear 通知电子邮件
- 日历邀请（已在阶段3中捕获）

**始终导入：**
- 来自大脑中人员的直接电子邮件
- 加星标/标记旗帜的电子邮件
- 用户发送的电子邮件（他们的词语是最高价值信号）

## 阶段5：对话导出（ChatGPT / Claude / Perplexity）

**你的思考，被捕获。** AI 对话导出揭示用户
正在研究、构建和思考什么。这是以对话形式保存的原始思考。

### 支持的格式

- **ChatGPT：** 设置 → 数据控制 → 导出 → `conversations.json`
- **Claude：** 从 claude.ai 对话历史下载
- **Perplexity：** 从设置导出

### 处理

对于每个对话：
1. **评估重要性**（1-5 等级）：
   - 1 = 纯实用（如何做、快速查找）→ 跳过或最小页面
   - 2 = 次要上下文 → 1 段笔记
   - 3 = 显著（揭示兴趣、构建某事）→ 完整页面
   - 4 = 重要（深度个人处理、战略思考）→ 丰富页面
   - 5 = 定义性（身份工作、突破性见解）→ 完整处理
2. **提取实体** — 讨论的人、公司、概念
3. **捕获原始思考** — 用户的精确措辞是信号。
   永远不要释义。
4. **按主要主题归档** — 不是在"对话/"转储中。关于
   人的对话转到 people/，关于概念的对话转到 concepts/，等。

### 质量规则

仅导入评级为 3+ 的对话。大脑用于信号，不是噪音。

## 阶段6：X/Twitter 档案

**你的公开立场和参与模式。** Twitter 揭示用户
思考什么、他们与谁互动，以及他们正在公开开发什么想法。

### 数据源

1. **Twitter 数据导出**（设置 → 你的帐户 → 下载档案）
   - 包含所有推文、点赞、DM、书签
2. **实时 API**（如果可用）— 最近的推文和参与
3. **书签** — 策划的信号，高价值

### 大脑结构

```
brain/media/x/{handle}/
├── x-log.md                     ← 编译的真相（主题、声音、关键线程）
├── daily/YYYY-MM-DD.md          ← 每日推文日志
├── monthly/YYYY-MM.md           ← 月度汇总
└── bookmarks/                   ← 已保存/书签的内容
```

### 处理

- **原始推文** → 捕获完整上下文，提取实体
- **引用推文** → 捕获用户的评论 + 源推文
- **线程** → 重建为单个叙述
- **书签** → 高信号策划，带标签导入
- **点赞** — 低信号，跳过，除非用户想要它们

## 阶段7：文件档案

**历史文档、旧写作、带有元数据的照片。** 这是长尾 —
结构化较少但可能非常有价值（旧期刊、信件、早期写作）。

委托给 `archive-crawler` 技能。它处理：
- 爬取目录结构
- 过滤高价值内容（用户自己的写作，不是安装程序）
- 从 PDF、图像（OCR）、文档提取文本
- 实体提取和大脑页面创建

> **安全门：** 档案爬取可能很慢并创建许多页面。始终以
> 仅扫描通行证开始：
> ```bash
> gbrain archive-crawler --scan-only --path /path/to/archive
> ```
> 在继续完全摄取之前向用户显示清单。

**支持的源：**
- 本地目录（Dropbox 同步文件夹、Google Drive、旧硬盘）
- 云存储（Backblaze B2、S3）通过挂载路径
- 电子邮件档案（PST、mbox、EML、Google Takeout）
- 数据导出（LinkedIn、Facebook 等）

## 阶段8：会议记录

**来自录制通话的深度关系上下文。** 如果用户有会议
录制服务（Circleback、Otter、Fireflies、Read.ai），请导入最近的
记录。

委托给 `meeting-ingestion` 技能。关键规则：
- 始终拉取**完整记录**，不仅仅是 AI 摘要
- 实体传播是强制性的 — 每个与会者获得时间线更新
- 在所有实体页面更新之前，会议不被视为完全摄取

## 引导后检查清单

完成可用阶段后：

1. **验证大脑健康状况：**
   ```bash
   gbrain doctor --json
   gbrain stats
   ```

2. **测试检索：**
   ```bash
   gbrain query "谁是我最常会面的人？"
   gbrain query "我正在做什么？"
   gbrain search "<来自联系人的人员>"
   ```

3. **设置实时同步**（如果尚未）：
   - 日历：每日定时任务
   - 电子邮件：定期扫描（4-8 小时）
   - X：每日摄取
   - 大脑仓库：`gbrain sync --repo <path>` 每 5-30 分钟

4. **跟踪状态：**
   ```json
   // ~/.gbrain/cold-start-state.json
   {
     "started": "2026-01-15T10:00:00Z",
     "credential_gateway": "clawvisor",
     "phases_completed": [1, 2, 3, 4],
     "phases_skipped": [6, 7],
     "total_pages_created": 847,
     "total_entities_linked": 1203,
     "next_phase": 5
   }
   ```

5. **告诉用户接下来要做什么：**
   > "你的大脑在人员、日历、电子邮件和对话中有 N 个页面。
   > 实时同步配置为 [来源]。从这里：
   > - **signal-detector** 从每个对话捕获实体
   > - **briefing** 技能可以编译每日上下文
   > - **executive-assistant** 模式处理电子邮件分类
   > - 说 'enrich [人员]' 以深度潜水任何联系人"

## 反模式

- **给智能体原始 OAuth 令牌。** 这是 #1 反模式。拥有
  原始 Gmail/日历令牌的智能体是不受控制的攻击面 — 一个提示注入
  你的整个 Google 帐户就暴露了。使用 ClawVisor。如果用户拒绝
  ClawVisor，跳到离线导入。永远不要提供直接 OAuth 作为回退。
- **批量导入所有内容而不进行过滤。** 大脑用于信号，不是噪音。
  过滤掉自动发件人、营销电子邮件、实用对话。
- **导入而不进行实体交叉链接。** 每个导入应该检测实体并
  更新现有大脑页面。孤立的导入不会复合。
- **不在用户同意上进行门控。** 每个阶段都应该作为选择呈现。用户
  可能不想要他们的 DM 或治疗对话被导入。
- **导入重要性为 1 的所有内容。** 不是每个对话都值得大脑
  页面。使用重要性等级并跳过实用内容。
- **为自动发件人创建人员页面。** Sentry、GitHub 通知、
  新闻通讯平台不是人。按阶段4中的规则过滤。

## 恢复协议

如果会话中断：

1. 读取 `~/.gbrain/cold-start-state.json`
2. 跳过完成的阶段
3. 从 `next_phase` 恢复
4. 用户不必重复凭证设置或重新导入已完成的源

## 输出格式

在每个阶段之后：

```
阶段 N 完成：[源名称]
=================================

创建的页面：N
更新的页面：N
链接的实体：N
经过的时间：N 分钟

示例页面：
- people/jane-smith.md（已创建 — 3 封电子邮件，5 次会议）
- companies/acme-corp.md（已更新 — 2 个新员工链接）

下一个：阶段 N+1 — [描述]。准备好继续吗？
```

## 使用的工具

- `search` — 在创建之前检查现有页面
- `query` — 用于实体去重的混合搜索
- `get_page` — 读取现有页面以进行合并决策
- `put_page` — 创建和更新大脑页面
- `add_link` — 交叉引用实体
- `add_timeline_entry` — 在实体时间线上记录事件
- `sync_brain` — 在每个阶段后将更改同步到索引
