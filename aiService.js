const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com'
});

const SYSTEM_PROMPT = `你是一个严格的JSON生成器。请根据用户提供的PDF页面文本，生成一个层次化的思维导图结构JSON。

## 核心要求
- 输出必须是纯粹的、可直接被JSON.parse()解析的JSON对象
- 绝对不要添加任何额外说明、注释、代码块标记或其他非JSON内容
- 输出内容必须以{开头，以}结尾，中间是完整的JSON结构

## 输入格式
你将收到一系列文本块，每个块以"[PAGE_{页码}]"开头。请仅依据这些文本进行分析。

## JSON结构规范
每个节点必须包含且仅包含以下三个字段：
- \`title\`: (字符串) 节点标题
- \`source_pages\`: (数组) **仅叶子节点包含此字段**，表示此节点核心内容所对应的原始页码，例如 [1] 或 [2, 3]。非叶子节点（有子节点的节点）必须省略此字段或设为空数组[]
- \`children\`: (数组) 子节点列表，若无子节点则为空数组 []

## 结构层次要求
- 根节点的\`title\`应为文档的整体主题或名称，\`source_pages\`通常为空数组[]
- 构建3-4层的逻辑结构：中心主题 -> 核心章节 -> 具体小节 -> 关键知识点
- 将具体的、不可再分的知识点作为"叶子节点"（\`children\`为空数组）
- **只有叶子节点才包含\`source_pages\`字段**，非叶子节点（有子节点的节点）必须省略\`source_pages\`字段
- 确保需要引用原文截图的知识点都作为叶子节点

## 特殊情况处理
### 图片重复问题处理规则（强制要求）
当你发现自己在为多个叶子节点添加相同的\`source_pages\`（即引用相同的页面/图片）时，必须立即将这些叶子节点合并！

**强制合并条件（满足任一条件即需合并）：**
1. 多个叶子节点属于同一父节点，且都引用相同的页面编号
2. 多个叶子节点在逻辑上是并列的分类关系（如"企业园区网络"、"校园网络"等）
3. 多个叶子节点描述的是同一概念的不同方面，但引用相同的源页面

**合并方法（必须执行）：**
- **将多个引用相同页面的叶子节点合并成一个叶子节点**
- 新的合并节点**必须包含\`source_pages\`字段**（关联原页面）
- 新的合并节点的标题应该概括所有被合并节点的内容
- 确保合并后的结构逻辑清晰，避免重复图片

**合并示例（强制要求）：**
**合并前（错误，会导致图片重复）：**
{
  "title": "园区网络分类",
  "children": [
    {"title": "企业园区网络", "source_pages": [5], "children": []},
    {"title": "校园网络", "source_pages": [5], "children": []},
    {"title": "政务园区网络", "source_pages": [5], "children": []},
    {"title": "商业园区网络", "source_pages": [5], "children": []}
  ]
}

**合并后（正确，避免图片重复）：**
{
  "title": "园区网络分类",
  "children": [
    {
      "title": "园区网络类型概述",
      "source_pages": [5],
      "children": []
    }
  ]
}

**图片关联规则（必须遵守）：**
- 合并分类节点时，**必须将多个叶子节点合并成一个叶子节点**
- 新的合并节点**必须包含\`source_pages\`字段**，关联原页面
- 每个页面编号**在整个知识树中只能被关联一次**
- 如果多个叶子节点引用同一页面，必须合并成一个节点

**关键要点（必须遵守）：**
- 只有叶子节点（没有子节点的节点）才能包含\`source_pages\`字段
- 任何有子节点的父节点都**绝对不能**包含\`source_pages\`字段
- 这是避免图片重复的核心规则，必须严格执行

## 重要提醒
- 你的输出将直接用于程序解析，任何非JSON内容都会导致程序崩溃
- 不要使用Markdown代码块标记（如\`\`\`json）
- 不要添加任何解释性文字
- 确保JSON格式完全正确，包括引号、逗号、括号等

## 输出示例
{
  "title": "机器学习导论",
  "children": [
    {
      "title": "什么是机器学习",
      "children": [
        {
          "title": "定义与核心思想",
          "source_pages": [2],
          "children": []
        },
        {
          "title": "典型应用举例",
          "source_pages": [3, 4],
          "children": []
        }
      ]
    }
  ]
}`;

async function generateKnowledgeTree(pagesData) {
    try {
        // 处理所有页面，不限制数量
        const textBlocks = pagesData.map(page => {
            return `[PAGE_${page.page_num}]\n${page.text}`;
        }).join('\n\n');

        const response = await openai.chat.completions.create({
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: textBlocks }
            ],
            temperature: 0.3
        });

        const content = response.choices[0].message.content.trim();
        
        // 记录原始响应内容用于调试
        console.log('AI原始响应内容:', content.substring(0, 200) + '...');
        
        // 多层级清理非JSON内容
        let cleanedContent = content
            // 移除Markdown代码块标记
            .replace(/```json\n?/g, '').replace(/\n?```/g, '')
            // 移除可能的XML标签
            .replace(/<[^>]*>/g, '')
            // 移除常见的非JSON前缀
            .replace(/^(json|JSON|输出|result|response):?\s*/i, '')
            .trim();
        
        // 如果内容不以{开头，尝试提取JSON部分
        if (!cleanedContent.startsWith('{')) {
            const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanedContent = jsonMatch[0];
            } else {
                // 如果仍然找不到JSON，尝试从第一个{开始
                const startIndex = cleanedContent.indexOf('{');
                if (startIndex !== -1) {
                    cleanedContent = cleanedContent.substring(startIndex);
                }
            }
        }
        
        // 确保内容以{开头，以}结尾
        if (!cleanedContent.startsWith('{')) {
            cleanedContent = '{' + cleanedContent;
        }
        if (!cleanedContent.endsWith('}')) {
            cleanedContent = cleanedContent + '}';
        }
        
        console.log('清理后的内容:', cleanedContent.substring(0, 200) + '...');
        
        try {
            const knowledgeTree = JSON.parse(cleanedContent);
            console.log('JSON解析成功，根节点标题:', knowledgeTree.title);
            return knowledgeTree;
        } catch (parseError) {
            console.error('JSON解析失败，错误信息:', parseError.message);
            console.error('解析失败的内容:', cleanedContent);
            
            // 尝试修复常见的JSON格式错误
            try {
                // 修复可能的引号问题
                let fixedContent = cleanedContent
                    .replace(/'/g, '"')
                    .replace(/([\w]+):/g, '"$1":')
                    .replace(/,\s*}/g, '}')
                    .replace(/,\s*]/g, ']');
                
                const knowledgeTree = JSON.parse(fixedContent);
                console.log('修复后JSON解析成功，根节点标题:', knowledgeTree.title);
                return knowledgeTree;
            } catch (fixError) {
                console.error('修复后JSON解析仍然失败:', fixError.message);
                throw new Error(`AI返回的内容无法解析为有效JSON: ${fixError.message}`);
            }
        }
    } catch (error) {
        console.error('DeepSeek API error:', error);
        throw new Error(`Failed to generate knowledge tree: ${error.message}`);
    }
}

module.exports = { generateKnowledgeTree };