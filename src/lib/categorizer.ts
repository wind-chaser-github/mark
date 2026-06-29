export function autoCategorize(title: string, url: string): string | null {
  const t = (title || '').toLowerCase();
  const u = (url || '').toLowerCase();
  const combined = `${t} ${u}`;

  const rules: { keywords: string[], category: string }[] = [
    { keywords: ['github', 'gitlab', 'npm', 'react', 'vue', 'python', 'javascript', 'typescript', 'developer', '编程', '代码', '开发', '程序员', '算法', 'leetcode', 'api'], category: '技术与开发' },
    { keywords: ['figma', 'dribbble', 'behance', 'pinterest', '设计', '素材', '字体', 'color', 'ui/ux', '插画'], category: '设计与创意' },
    { keywords: ['youtube', 'bilibili', 'netflix', 'youku', 'iqiyi', '视频', '影视', '电影', 'music', '网易云', '音乐', 'podcast', '播客'], category: '影音与娱乐' },
    { keywords: ['medium', 'zhihu', '知乎', 'news', '新闻', 'blog', '博客', '文章', '简书', '阅读'], category: '阅读与资讯' },
    { keywords: ['twitter', 'weibo', '微博', 'reddit', 'v2ex', '论坛', '贴吧', 'facebook', 'instagram', '社交'], category: '社交与社区' },
    { keywords: ['google', 'baidu', 'bing', 'search', '搜索', '翻译', 'translate', '工具', 'tool', 'json', '计算器', '在线'], category: '效率与工具' },
    { keywords: ['taobao', '淘宝', 'jd', '京东', '购物', 'buy', 'amazon', '拼多多', '闲鱼'], category: '购物与消费' },
    { keywords: ['wiki', 'baike', '百科', '教程', 'tutorial', 'learn', '学习', '课', 'course'], category: '知识与学习' }
  ];

  for (const rule of rules) {
    if (rule.keywords.some(keyword => combined.includes(keyword))) {
      return rule.category;
    }
  }

  return null;
}
