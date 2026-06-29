import { getStore } from './store';

export interface AIMetadata {
  title: string;
  description: string;
  category: string;
  tags: string[];
}

export async function extractMetadataViaAI(url: string, rawTitle: string, rawDescription: string = '', syncCode: string = 'default'): Promise<AIMetadata> {
  const store = await getStore(syncCode);
  const config = store.settings || {};

  const apiKey = config['OPENAI_API_KEY'] || process.env.OPENAI_API_KEY;
  const baseUrl = config['OPENAI_BASE_URL'] || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const model = config['OPENAI_MODEL'] || process.env.OPENAI_MODEL || 'gpt-3.5-turbo';

  const defaultResult: AIMetadata = {
    title: rawTitle || url,
    description: rawDescription || 'No description available',
    category: '未分类',
    tags: []
  };

  if (!apiKey) {
    console.warn('OPENAI_API_KEY is not set. Using fallback metadata.');
    return defaultResult;
  }

  try {
    const existingCategories = store.categories;
    const categoryNames = existingCategories.map(c => c.name).filter(c => c !== '未分类').join(', ');

    const prompt = `
    你是一个智能的网页书签分类助手。请根据以下网页信息提取元数据：
    URL: ${url}
    Title: ${rawTitle}
    Description: ${rawDescription}
    
    分类规则（非常重要）：
    1. 请必须返回一个最贴切的【中文】主分类名称。
    2. 优先从以下已有的分类中选择一个放入：[${categoryNames}]。但是，**如果已有分类都不合适，千万不要强行放入！**
    3. 如果已有分类都不合适，请【自行创建一个新的大类】。新建的分类必须是宏观的、普适的领域（例如：人工智能、前端开发、效率工具、影音娱乐、新闻资讯），绝对不要使用过于具体或奇怪的词。
    4. 提取 1 到 3 个精准的中文标签。
    5. 提炼一段简短的中文摘要。
    
    请严格以 JSON 格式返回：
    {
      "title": "清理后的精简标题",
      "description": "简短的一句话摘要",
      "category": "主分类名称",
      "tags": ["标签1", "标签2"]
    }
    `;

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1
      })
    });

    if (!response.ok) {
      console.error('AI API error:', await response.text());
      return defaultResult;
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const parsed = JSON.parse(content);

    return {
      title: parsed.title || defaultResult.title,
      description: parsed.description || defaultResult.description,
      category: parsed.category || defaultResult.category,
      tags: parsed.tags || []
    };
  } catch (error) {
    console.error('Failed to extract metadata via AI:', error);
    return defaultResult;
  }
}
