# 评估计划：闭卷、开卷与 RAG 对比

**日期**：2026-05-11
**状态**：草稿
**作者**：@garrytan

## 背景

GBrain 正从“我感觉更聪明了”转向严格的可衡量智能。

目前存在一个评估黑色区域：我们知道 GBrain 在作者特定设置上运行良好，但缺乏：
1.  **可重复性**——他人的 Milvus 设置能否复现？
2.  **泛化性**——它在不同知识库上的表现如何？
3.  **进步能见度**——我们如何知道 v0.38 比 v0.36 更智能？

本文件概述了为 GBrain 构建生产级 RAG 评估套件的计划。

## 目标

1.  **建立基线**：测量当前检索 + 生成质量（闭卷 vs. 开卷）。
2.  **组件化**：将评估分解为独立的、可测试的阶段（检索、上下文合成、生成）。
3.  **持续回归检测**：在 CI 中阻断降低质量的 PR。
4.  **下游代理优化**：为 OpenClaw/Codex 等提供调优信号。

## 范围

### 包含
- **检索评估**：召回率@K、MRR、噪声比。
- **端到端 E2E 质量**：答案忠实度、相关性、简洁性（LLM-as-Judge）。
- **成本 + 延迟**：每个查询的 token、延迟（P50/P95）、嵌入成本。
- **数据集**：
  - 内部：从 `~/.gbrain` 捕获的真实查询（带人工评分）。
  - 公共：LongMemEval、Qasper、自定义金融/代币数据集。

### 不包含（V1）
- 多模态（图像/图表检索）。
- 非英语评估（中文由社区单独处理）。
- 实时在线学习评估（仅离线快照）。

## 架构

### 1. 数据集层
```
evals/
├── datasets/
│   ├── longmemeval_v1.jsonl      # 公共基准
│   ├── token_economics_v1.jsonl  # 内部（代币经济学）
│   └── captured_2026_05.ndjson  # gbrain capture 命令导出
├── rubrics/
│   ├── faithfulness_v1.json      # LLM Judge 提示词
│   └── conciseness_v1.json
└── golden/
    └── token_economics_answers.jsonl # 专家标注的参考答案
```

### 2. 评估运行器 (`src/eval/runner.ts`)
- **模式**：
  - `closed-book`：直接提问 LLM（无检索）。
  - `open-book`：将整个知识库作为上下文（上限 100k tokens）。
  - `rag`：标准 GBrain 检索 + 生成。
- **指标收集**：
  - 检索：召回率@5、MRR。
  - 生成：忠实度（1-5）、相关性（1-5）、GPT-4o 作为 Judge。
  - 成本：总 tokens、延迟（毫秒）。

### 3. CI 集成
- **门禁**：PR 合并前必须运行 `gbrain eval run --dataset longmemeval_v1 --mode rag`。
- **回归阻断**：如果 `faithfulness` 下降 > 0.3 分（5分制），或 `cost_per_query` 增加 > 20%，则阻断。
- **报告**：GitHub Actions 工件中的 Markdown 表格 + 带有趋势线的 JSON 历史记录。

## 实施计划

### 阶段 1：数据集构建（第 1-2 周）
- [ ] 编写 `gbrain eval export --since 30d --output eval_capture.ndjson`。
- [ ] 注释 100 个查询（作者 + 1 名外部人员）。
- [ ] 转换 LongMemEval 数据集（公共可用）。
- [ ] 构建 `rubrics/faithfulness_v1.json`（LLM Judge 提示词）。

### 阶段 2：运行器原型（第 3 周）
- [ ] 实现 `src/eval/runner.ts`（支持 3 种模式）。
- [ ] 集成 `llm-judge` 进行自动评分（回退到本地模型以降低 API 成本）。
- [ ] 输出原始结果到 `evals/results/2026_05_11_baseline.json`。

### 阶段 3：CI 集成（第 4 周）
- [ ] 添加 `.github/workflows/eval-gate.yml`。
- [ ] 在 `bun test` 旁添加 `bun run eval:ci`。
- [ ] 构建 `gbrain eval compare --baseline v0.36 --candidate v0.37`。

### 阶段 4：下游优化（第 5-6 周）
- [ ] 向 OpenClaw 发送评估分数（通过 webhook/cron）。
- [ ] 调整 chunk_size、top_k、reranker 模型。
- [ ] 发布 `EVAL_BENCH.md`（公开基准结果）。

## 风险 + 缓解措施

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| LLM Judge 存在偏见 | 中 | 使用多个 Judge（GPT-4o + Claude）取平均 |
| 捕获数据存在隐私问题 | 高 | 仅使用合成/公开数据，或匿名化字段 |
| 评估速度慢（> 5 分钟） | 中 | 对 PR 运行采样（10% 查询），全量夜间运行 |
| 成本过高（LLM API） | 中 | 使用本地 Judge（Ollama），限制 API 调用 |

## 成功标准

- **V1（2026-06-01）**：在 3 个数据集上运行评估，发布基线分数。
- **V2（2026-07-01）**：CI 门禁生效，阻断回归。
- **V3（2026-09-01）**：下游代理（OpenClaw）根据 GBrain 评估分数自动调整其 RAG 参数。

## 参考

- [Evaluation benchmark methodology](https://github.com/vectara/hallucination-evaluation)
- [LongMemEval paper](https://arxiv.org/abs/2301.10175)
- [RAGAS framework](https://github.com/explodinggradients/ragas)
- [GBrain Evals directory](./evals/)

---

*本文件是 GBrain 文档集的一部分。欢迎贡献！*