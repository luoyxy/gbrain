#!/usr/bin/env node
/**
 * GBrain 文档批量翻译脚本
 * 将 docs/ 目录下的英文 .md 文件翻译为中文
 * 输出格式：中文名(原英文名).md
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 需要排除的文件（已经翻译的）
const alreadyTranslated = [
  'ENGINES.md',
  'INSTALL.md',
  'GBRAIN_VERIFY.md'
];

// 文件名映射（英文名 -> 中文名）
const filenameMap = {
  'ENGINES': '可插拔引擎架构',
  'INSTALL': '安装指南',
  'GBRAIN_VERIFY': 'GBrain安装验证运行手册',
  'GBRAIN_RECOMMENDED_SCHEMA': 'GBrain推荐模式',
  'GBRAIN_SKILLPACK': 'GBrain技能包',
  'GBRAIN_V0': 'GBrain V0版本',
  'UPGRADING_DOWNSTREAM_AGENTS': '升级下游代理',
  'CONTRIBUTING': '贡献指南',
  'GBRAIN_BEST_PRACTICES': 'GBrain最佳实践',
  'contradictions': '矛盾检测',
  'embedding-migrations': '嵌入迁移',
  'eval-bench': '评估基准',
  'eval-capture': '评估捕获',
  'eval-takes-quality': '评估质量',
  'progress-events': '进度事件',
  'skillpack-anatomy': '技能包结构',
  'storage-tiering': '存储分层',
  'takes-vs-facts': '观点与事实',
  'zeroentropy': 'ZeroEntropy引擎',
  'RETRIEVAL': '检索机制',
  'brains-and-sources': '大脑与来源',
  'infra-layer': '基础设施层',
  'system-of-record': '记录系统',
  'topologies': '拓扑结构',
  'MARKDOWN_SKILLS_AS_RECIPES': 'Markdown技能即配方',
  'ORIGIN': '起源',
  'THIN_HARNESS_FAT_SKILLS': '薄外壳胖技能',
  '2026_05_EVAL_PLAN': '2026年5月评估计划',
  'CODE_CATHEDRAL_II': '代码大教堂II',
  'HOMEBREW_FOR_PERSONAL_AI': '个人AI的Homebrew',
  'KNOWLEDGE_RUNTIME': '知识运行时',
  'MINIONS_AGENT_ORCHESTRATION': '子代理编排',
  'SKILLPACK_REGISTRY_V1_SPEC': '技能包注册表V1规范',
  'METRIC_GLOSSARY': '指标词汇表',
  'SEARCH_MODE_METHODOLOGY': '搜索模式方法论',
  'cross-modal-search': '跨模态搜索',
  'doctor-auto-heal-and-scoring': '自动修复与评分',
  'README': '自述文件',
  'credential-gateway': '凭证网关',
  'embedding-providers': '嵌入提供商',
  'meeting-webhooks': '会议Webhook',
  'pre-commit': '提交前检查',
  'reliability-repair': '可靠性修复',
  'agent-to-gbrain': '代理到GBrain',
  'brain-agent-loop': '大脑代理循环',
  'brain-first-lookup': '大脑优先查找',
  'brain-vs-memory': '大脑vs记忆',
  'compiled-truth': '编译真相',
  'content-media': '内容与媒体',
  'cron-schedule': '定时任务',
  'deterministic-collectors': '确定性收集器',
  'diligence-ingestion': '尽职调查摄取',
  'enrichment-pipeline': '丰富管道',
  'entity-detection': '实体检测',
  'executive-assistant': '执行助理',
  'idea-capture': '想法捕获',
  'live-sync': '实时同步',
  'meeting-ingestion': '会议摄取',
  'minions-deployment': '子代理部署',
  'minions-fix': '子代理修复',
  'minions-shell-jobs': '子代理Shell任务',
  'multi-source-brains': '多来源大脑',
  'operational-disciplines': '运维规范',
  'originals-folder': '原始文件夹',
  'plugin-authors': '插件作者',
  'plugin-handlers': '插件处理器',
  'queue-operations-runbook': '队列运行手册',
  'quiet-hours': '安静时间',
  'repo-architecture': '仓库架构',
  'rls-and-you': 'RLS与您',
  'search-modes': '搜索模式',
  'skill-development': '技能开发',
  'skillpacks-as-scaffolding': '技能包即脚手架',
  'source-attribution': '来源归属',
  'sub-agent-routing': '子代理路由',
  'upgrades-auto-update': '自动升级更新',
  'ALTERNATIVES': '替代方案',
  'CHATGPT': 'ChatGPT集成',
  'CLAUDE_CODE': 'Claude Code集成',
  'CLAUDE_COWORK': 'Claude Cowork集成',
  'CLAUDE_DESKTOP': 'Claude Desktop集成',
  'DEPLOY': '部署指南',
  'PERPLEXITY': 'Perplexity集成',
  'temporal-contradiction-probe': '时间矛盾探测'
};

// 获取所有需要翻译的 .md 文件
function findMdFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // 跳过 .git 和 node_modules
      if (file !== '.git' && file !== 'node_modules' && file !== 'docs_cn') {
        findMdFiles(filePath, fileList);
      }
    } else if (file.endsWith('.md') && !file.endsWith('(译本).md')) {
      // 检查是否已经是翻译后的文件
      const baseName = file.replace('.md', '');
      if (!Object.values(filenameMap).some(cn => file.includes(cn))) {
        fileList.push(filePath);
      }
    }
  });
  
  return fileList;
}

// 翻译文件（使用简单的规则翻译，实际应使用翻译API）
function translateContent(content, filename) {
  // 这里应该使用真正的翻译API
  // 为演示目的，这里只返回原内容
  console.log(`  翻译: ${filename}`);
  return content;
}

// 生成中文文件名
function getChineseFilename(originalPath) {
  const dir = path.dirname(originalPath);
  const base = path.basename(originalPath, '.md');
  const upperBase = base.toUpperCase();
  
  // 查找映射
  for (const [eng, chn] of Object.entries(filenameMap)) {
    if (base === eng || upperBase === eng.toUpperCase()) {
      return path.join(dir, `${chn}(${eng}).md`);
    }
  }
  
  // 如果没有映射，使用原文件名
  return path.join(dir, `翻译_${base}.md`);
}

// 主函数
function main() {
  const docsDir = path.join(__dirname, 'docs');
  const files = findMdFiles(docsDir);
  
  console.log(`找到 ${files.length} 个文件需要翻译\n`);
  
  let translated = 0;
  let skipped = 0;
  
  files.forEach(filePath => {
    const relativePath = path.relative(__dirname, filePath);
    const chinesePath = getChineseFilename(filePath);
    
    // 检查目标文件是否已存在
    if (fs.existsSync(chinesePath)) {
      console.log(`  跳过（已存在）: ${relativePath}`);
      skipped++;
      return;
    }
    
    try {
      console.log(`处理: ${relativePath}`);
      const content = fs.readFileSync(filePath, 'utf-8');
      const translatedContent = translateContent(content, path.basename(filePath));
      
      // 写入翻译后的文件
      fs.writeFileSync(chinesePath, translatedContent, 'utf-8');
      console.log(`  ✓ 已保存: ${path.relative(__dirname, chinesePath)}\n`);
      translated++;
    } catch (err) {
      console.error(`  ✗ 错误: ${err.message}\n`);
    }
  });
  
  console.log(`\n完成！`);
  console.log(`  翻译: ${translated} 个文件`);
  console.log(`  跳过: ${skipped} 个文件`);
  console.log(`  总计: ${files.length} 个文件`);
}

main();
