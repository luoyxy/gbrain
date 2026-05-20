# 为什么混合 + 图谱技术栈有效

仅凭向量搜索无法实现真正的个人知识查询效果。本文档解释了 gbrain 为何将四种策略叠加使用，以及它们如何产生复合效果。

## 四种策略协同工作

1. **向量搜索（pgvector 上的 HNSW）** — 语义相似度。捕获"谁在 YC 从事检索质量工作？"→ 提及"Garry Tan + 检索"的页面，即使用户从未输入"YC"。
2. **BM25 关键词** — 词法匹配。捕获名称、精确短语、代码标识符，以及用户记得字面标记的任何内容。在向量搜索漂移到主题邻近词的情况下仍然有效。
3. **倒数排名融合（RRF）** — 将向量和关键词排名合并，而不全局偏向其中一方。每种策略都有投票权。
4. **知识图谱遍历** — 沿类型化边遍历。通过遍历 `bob ── invested_in ──> company ── dated ──> Q1` 来捕获"Bob 本季度投资了什么？"。向量搜索无法看到因果链；图谱可以。

## 为什么单独使用每种策略都会失败

**仅向量搜索。** 返回与查询语义接近的块。遗漏任何未直接编码在嵌入中的事实关系。"Garry 投资组合中的公司"返回关于投资组合的文章，而非公司页面。

**仅关键词搜索（ripgrep 风格）。** 对措辞变化敏感。"谁从事检索工作？"会遗漏那些说"搜索排名"而非"检索"的页面。在同义词、近似匹配或释义方面表现糟糕。

**仅图谱搜索。** 擅长"Alice 的邻居"查询，但对任何尚未链接的内容视而不见。新页面在反向链接积累之前内容稀疏。

**混合搜索（向量 + 关键词 + RRF），无图谱。** 在"X 是什么？"类型查询上表现尚可。在"Y 与 X 的关系是什么？"上失败——这些是图谱查询，无论多少嵌入调优都无法恢复。

## 基准测试

BrainBench（语料库 + 测试工具位于同级 [gbrain-evals](https://github.com/garrytan/gbrain-evals) 仓库中）在 240 页 Opus 生成的高质量散文语料库上测量检索 P@5、R@5、MRR、nDCG@5。

| 策略 | P@5 | R@5 | 备注 |
|---|---|---|---|
| 仅 ripgrep BM25 | ~18 | ~75 | 仅词法基线 |
| 仅向量 RAG | ~18 | ~80 | 标准 RAG 实现 |
| gbrain 禁用图谱（混合 + RRF，无图谱遍历） | ~18 | ~85 | 仅混合 |
| **gbrain 默认（完整技术栈）** | **49.1** | **97.9** | 图谱 + 提取质量提升 |

**+31 P@5 分** 来自图谱 + 提取质量工作。图谱不是边缘功能；它是承重墙。

## 自动链接：为什么零 LLM 调用的边提取有效

每次 `put_page` 都会对 Markdown 正文运行 `extractEntityRefs`。它匹配：

- 标准 Markdown 链接：`[Garry Tan](wiki/people/garry-tan)`
- Obsidian 维基链接：`[[wiki/people/garry-tan|Garry Tan]]`
- 类型化链接块引用：`> **Convention:** see [path](path).`

三个正则表达式，零 LLM token，单个 SQL `addLinksBatch` 调用，使用 `INSERT ... SELECT FROM unnest(...) JOIN pages ON CONFLICT DO NOTHING RETURNING 1`。图谱在每次写入时以接近零的成本增长。在 17K 页面的 brain 上，完整图谱提取在几秒内完成。

启发式链接类型推断（`attended`、`works_at`、`invested_in`、`founded`、`advises`）从周围句子上下文触发——同样无需 LLM。希望获得更丰富类型的高级用户可以通过类型化链接块引用约定添加它们。

## ZeroEntropy 作为重排序器：60% 的 top-1 重新排序

v0.36.0.0 将 ZeroEntropy 的 `zerank-2` 作为默认重排序器（在 `balanced` 模式包中开启）。在跨 20 个查询的真实语料库基准测试中，zerank-2 在混合 + RRF + 图谱技术栈之后重新排序了 **60% 的 top-1 结果**。这就是核心数据。

机械原因：混合排名在每个策略上是局部最优的，但在全局上是次优的。交叉编码器重排序器以完整注意力共同读取查询 + 每个候选文档。它捕获了向量 + 关键词 + 图谱信号都同意某个文档但主题错误的情况。

成本：+150ms p50 延迟，约 $0.025/百万 token。使用 `gbrain config set search.reranker.enabled false` 禁用。对于在检索后执行下游 LLM 工作的智能体循环，延迟是不可察觉的。

## 来源感知排名

混合搜索在 SQL 层应用来源因子 CASE 表达式（位于 `src/core/search/sql-ranking.ts`）。精选内容如 `originals/`、`concepts/`、`writing/` 的排名高于批量内容如 `your-openclaw/chat/`、`daily/`、`media/x/`。硬排除前缀（`test/`、`archive/`、`attachments/`、`.raw/`）在检索时过滤，而非排名后过滤。

提升映射可通过 `GBRAIN_SOURCE_BOOST` 环境变量或每次调用的 `SearchOpts.exclude_slug_prefixes` 进行配置。时间查询（`detail: 'high'`）绕过提升，以便聊天页面在时间敏感的查找中重新浮现。

## 意图感知查询重写

`src/core/search/intent.ts` 将查询分类为 `entity`、`temporal`、`event` 或 `general`。每个分类通过不同的排名旋钮路由：

- **实体**查询（"谁在 X 工作？"）应用更高的图谱遍历权重。
- **时间**查询（"上周发生了什么？"）绕过来源提升，以便聊天/日常页面浮现。
- **事件**查询（"Acme AI A 轮融资"）使用时间线索引。
- **通用**查询命中标准混合技术栈。

分类器是确定性的（无 LLM 调用）。错误分类会优雅降级——没有它，混合技术栈仍然有效。

## 多查询扩展

对于 `detail: 'high'` 搜索，`src/core/search/expansion.ts` 运行 Haiku 级 LLM 调用以生成 2-3 个查询变体。每个变体通过完整的混合技术栈运行；结果通过 RRF 合并。捕获同义词遗漏而无召回损失。

扩展按模式包选择加入（`tokenmax` 默认开启；`balanced` + `conservative` 关闭）。在廉价层级中默认关闭，因为 LLM 调用增加了约 $0.001/查询和约 200ms——规模化后是真实的成本。

## 综合起来

`query` 操作的完整管道：

```
意图分类
       │
       ▼
扩展（如果启用）
       │
       ▼
混合搜索：
   ├── 向量（块嵌入上的 HNSW）
   ├── 关键词（通过 tsvector 的 BM25）
   ├── 来源感知重排名（SQL 中的 CASE）
   └── RRF 融合 → 前 30 名
       │
       ▼
图谱增强（从任何种子进行的类型化边遍历）
       │
       ▼
重排序器（zerank-2 交叉编码器，前 30 名 → 重新排序）
       │
       ▼
token 预算强制执行（按模式包）
       │
       ▼
去重（相同 slug，不同块 → 保留最佳）
       │
       ▼
结果
```

每个阶段都可以独立测试。每个阶段都是可替换的。整个管道的编排成本 < 1ms；延迟预算用于上游 HTTP 调用（嵌入、重排序）和索引扫描。

## 如何在你自己的 brain 上验证

```bash
# 运行公开的 LongMemEval 基准测试
gbrain eval longmemeval datasets/longmemeval_s.jsonl

# 捕获你自己的查询并针对检索变化进行重放
export GBRAIN_CONTRIBUTOR_MODE=1
# ... 正常使用 gbrain ...
gbrain eval export > before.ndjson
# ... 做一些更改 ...
gbrain eval replay --against before.ndjson

# 在标记的固定装置上进行 A/B 检索策略测试
gbrain eval --qrels labels.tsv --config balanced.json
```

方法论 + 指标词汇表位于 [`docs/eval/SEARCH_MODE_METHODOLOGY.md`](../eval/SEARCH_MODE_METHODOLOGY.md)。
