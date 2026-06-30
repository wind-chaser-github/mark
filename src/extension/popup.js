// Removed hardcoded API_URL

async function saveBookmark(tab, btn, statusEl, config) {
  try {
    let rawDescription = '';
    let favicon = '';

    // Ask content script for deep data if possible
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: "extract_metadata" });
      if (response) {
        rawDescription = (response.metaDescription || '') + '\n' + (response.mainText || '');
        favicon = response.favicon || '';
      }
    } catch (e) {
      console.warn('Could not inject content script for deep data:', e);
    }

    const res = await fetch(`${config.syncUrl}/api/bookmarks`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.accessPassword}`
      },
      body: JSON.stringify({
        url: tab.url,
        rawTitle: tab.title,
        rawDescription: rawDescription.substring(0, 1000),
        favicon: favicon
      })
    });
    const data = await res.json();
    if (res.ok) {
      if (statusEl) {
        statusEl.textContent = '🎉 收录成功！';
        statusEl.className = 'status success';
      }
      if (btn) btn.textContent = '已收录';
      return true;
    } else {
      if (statusEl) {
        statusEl.textContent = '❌ ' + (data.error || '失败');
        statusEl.className = 'status error';
      }
      if (btn) {
        btn.textContent = '重试';
        btn.disabled = false;
      }
      return false;
    }
  } catch (error) {
    if (statusEl) {
      statusEl.textContent = '❌ 服务未运行或发生错误';
      statusEl.className = 'status error';
    }
    if (btn) {
      btn.textContent = '重试';
      btn.disabled = false;
    }
    return false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('save-btn');
  if (btn) {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = '解析中...';
      const statusEl = document.getElementById('status');
      statusEl.textContent = '';
      statusEl.className = 'status loading';
      
      const config = await new Promise(r => chrome.storage.local.get({ syncUrl: 'http://localhost:3999', accessPassword: '' }, r));
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url && tab.url.startsWith('http')) {
        await saveBookmark(tab, btn, statusEl, config);
      } else {
        statusEl.textContent = '❌ 无法在此页面使用';
        statusEl.className = 'status error';
        btn.textContent = '无法收录';
      }
    });
  }
  const organizeBtn = document.getElementById('organize-btn');
  if (organizeBtn) {
    organizeBtn.addEventListener('click', async () => {
      const config = await new Promise(r => chrome.storage.local.get({
        apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo'
      }, r));
      
      const statusEl = document.getElementById('status');
      organizeBtn.disabled = true;
      statusEl.textContent = '读取散落书签中...';
      statusEl.className = 'status loading';
      
      try {
        const tree = await chrome.bookmarks.getTree();
        // 查找书签栏(id='1') 和其他书签(id='2')下的直接子节点
        const unorganized = [];
        const rootNodes = tree[0].children || [];
        for (const root of rootNodes) {
          if (root.children) {
            for (const child of root.children) {
              if (child.url) { // 是书签而不是文件夹
                unorganized.push(child);
              }
            }
          }
        }
        
        if (unorganized.length === 0) {
          statusEl.textContent = '🎉 没有需要整理的散落书签';
          statusEl.className = 'status success';
          organizeBtn.disabled = false;
          return;
        }
        
        let parsed = {};
        
        if (config.apiKey) {
          statusEl.textContent = `交由 AI 分类中 (${unorganized.length} 个)...`;
          const prompt = `你是一个智能书签分类助手。这里有一批杂乱的书签，请根据它们的标题和 URL 进行分类。
要求：
1. 返回一个 JSON，键为书签的 ID，值为你为其分配的分类名称（如：工具、开发、设计、阅读等）。
2. 分类名称尽量精简、普适。
书签列表：
${unorganized.map(b => `ID: ${b.id} | Title: ${b.title} | URL: ${b.url}`).join('\n')}`;
          
          const res = await fetch(`${config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
              model: config.model,
              messages: [{ role: 'user', content: prompt }],
              response_format: { type: "json_object" },
              temperature: 0.1
            })
          });
          if (!res.ok) throw new Error('AI 服务请求失败');
          const data = await res.json();
          parsed = JSON.parse(data.choices[0].message.content);
        } else {
          statusEl.textContent = `使用内置规则分类中 (${unorganized.length} 个)...`;
          // Local rule-based categorizer
          const rules = [
            { keywords: ['github', 'gitlab', 'npm', 'react', 'vue', 'python', 'javascript', 'typescript', 'developer', '编程', '代码', '开发', '程序员', '算法', 'leetcode', 'api'], category: '技术与开发' },
            { keywords: ['figma', 'dribbble', 'behance', 'pinterest', '设计', '素材', '字体', 'color', 'ui/ux', '插画'], category: '设计与创意' },
            { keywords: ['youtube', 'bilibili', 'netflix', 'youku', 'iqiyi', '视频', '影视', '电影', 'music', '网易云', '音乐', 'podcast', '播客'], category: '影音与娱乐' },
            { keywords: ['medium', 'zhihu', '知乎', 'news', '新闻', 'blog', '博客', '文章', '简书', '阅读'], category: '阅读与资讯' },
            { keywords: ['twitter', 'weibo', '微博', 'reddit', 'v2ex', '论坛', '贴吧', 'facebook', 'instagram', '社交'], category: '社交与社区' },
            { keywords: ['google', 'baidu', 'bing', 'search', '搜索', '翻译', 'translate', '工具', 'tool', 'json', '计算器', '在线'], category: '效率与工具' },
            { keywords: ['taobao', '淘宝', 'jd', '京东', '购物', 'buy', 'amazon', '拼多多', '闲鱼'], category: '购物与消费' },
            { keywords: ['wiki', 'baike', '百科', '教程', 'tutorial', 'learn', '学习', '课', 'course'], category: '知识与学习' }
          ];
          for (const b of unorganized) {
            const combined = `${b.title || ''} ${b.url || ''}`.toLowerCase();
            let catName = '其他未分类';
            for (const rule of rules) {
              if (rule.keywords.some(k => combined.includes(k))) {
                catName = rule.category;
                break;
              }
            }
            parsed[b.id] = catName;
          }
        }
        
        statusEl.textContent = '正在重新组织书签树...';
        const bookmarksBarId = '1';
        
        for (const [bookmarkId, categoryName] of Object.entries(parsed)) {
          let barChildren = await chrome.bookmarks.getChildren(bookmarksBarId);
          let targetFolder = barChildren.find(c => !c.url && c.title === categoryName);
          
          if (!targetFolder) {
            targetFolder = await chrome.bookmarks.create({ parentId: bookmarksBarId, title: categoryName });
          }
          await chrome.bookmarks.move(bookmarkId, { parentId: targetFolder.id });
        }
        
        statusEl.textContent = '🎉 原生书签整理完成！';
        statusEl.className = 'status success';
        organizeBtn.disabled = false;
      } catch (e) {
        console.error(e);
        statusEl.textContent = '❌ 整理出错，请检查配置或网络';
        statusEl.className = 'status error';
        organizeBtn.disabled = false;
      }
    });
  }

  const importBtn = document.getElementById('import-btn');
  if (importBtn) {
    importBtn.addEventListener('click', async () => {
      if (!chrome.bookmarks) {
        alert("插件没有书签权限！请刷新插件配置。");
        return;
      }
      
      const statusEl = document.getElementById('status');
      const progressContainer = document.getElementById('import-progress');
      const progressBar = document.getElementById('import-bar');
      const saveBtn = document.getElementById('save-btn');
      
      importBtn.disabled = true;
      saveBtn.disabled = true;
      statusEl.textContent = '读取书签中...';
      statusEl.className = 'status loading';
      progressContainer.style.display = 'block';
      progressBar.style.width = '0%';
      
      try {
        const tree = await chrome.bookmarks.getTree();
        const bookmarks = [];
        
        // Traverse tree to get all bookmarks with URLs
        function traverse(node, folderPath = []) {
          // If it's a folder (has children) and has a title, add to path
          // Ignore root empty title nodes
          let currentPath = [...folderPath];
          if (node.children && node.title) {
            currentPath.push(node.title);
          }
          
          if (node.url && node.url.startsWith('http')) {
            bookmarks.push({
              url: node.url,
              title: node.title,
              dateAdded: node.dateAdded,
              folders: currentPath
            });
          }
          
          if (node.children) {
            node.children.forEach(child => traverse(child, currentPath));
          }
        }
        traverse(tree[0]);
        
        if (bookmarks.length === 0) {
          statusEl.textContent = '❌ 没有找到任何书签';
          statusEl.className = 'status error';
          importBtn.disabled = false;
          saveBtn.disabled = false;
          return;
        }

        statusEl.textContent = `开始导入 ${bookmarks.length} 个书签...`;
        
        // Batch into chunks of 100
        const batchSize = 100;
        let imported = 0;
        
        for (let i = 0; i < bookmarks.length; i += batchSize) {
          const batch = bookmarks.slice(i, i + batchSize);
          
          const config = await new Promise(r => chrome.storage.local.get({ syncUrl: 'http://localhost:3999', accessPassword: '' }, r));
          try {
            const res = await fetch(`${config.syncUrl}/api/bookmarks/bulk-import`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.accessPassword}`
              },
              body: JSON.stringify({ bookmarks: batch })
            });
            if (!res.ok) throw new Error('API Error');
            
            imported += batch.length;
            progressBar.style.width = `${(imported / bookmarks.length) * 100}%`;
            statusEl.textContent = `正在导入: ${imported} / ${bookmarks.length}`;
          } catch (e) {
            console.error('Batch error', e);
          }
        }
        
        statusEl.textContent = `🎉 成功发送 ${bookmarks.length} 个书签到后台！`;
        statusEl.className = 'status success';
        importBtn.textContent = '导入完成';
      } catch (e) {
        console.error(e);
        statusEl.textContent = '❌ 导入出错，请重试';
        statusEl.className = 'status error';
        importBtn.disabled = false;
      }
      
      saveBtn.disabled = false;
      setTimeout(() => {
        progressContainer.style.display = 'none';
      }, 3000);
    });
  }
});

  const pullBtn = document.getElementById('pull-btn');
  if (pullBtn) {
    pullBtn.addEventListener('click', async () => {
      if (!chrome.bookmarks) {
        alert("插件没有书签权限！请刷新插件配置。");
        return;
      }
      
      const statusEl = document.getElementById('status');
      pullBtn.disabled = true;
      statusEl.textContent = '正在从云端拉取书签...';
      statusEl.className = 'status loading';
      
      try {
        const config = await new Promise(r => chrome.storage.local.get({ syncUrl: 'http://localhost:3999', accessPassword: '' }, r));
        const res = await fetch(`${config.syncUrl}/api/bookmarks`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${config.accessPassword}` }
        });
        if (!res.ok) throw new Error('网络请求失败');
        const remoteBookmarks = await res.json();
        
        statusEl.textContent = '比对本地书签树...';
        
        // Build map of local bookmarks by URL
        const localMap = new Map();
        const tree = await chrome.bookmarks.getTree();
        
        function traverseLocal(node) {
          if (node.url) {
            localMap.set(node.url, node);
          }
          if (node.children) {
            node.children.forEach(traverseLocal);
          }
        }
        traverseLocal(tree[0]);
        
        // We'll put new bookmarks in the standard 'Other Bookmarks' (id: '2') if we can't recreate the folder path easily, 
        // or we try to recreate folder path. For simplicity and stability, we recreate the folder under Bookmarks Bar (id: '1').
        const barId = '1'; 
        let addedCount = 0;
        let updatedCount = 0;

        // Fetch categories to recreate full hierarchy
        const catRes = await fetch(`${config.syncUrl}/api/categories`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${config.accessPassword}` }
        });
        let catMap = new Map();
        if (catRes.ok) {
          const categoriesData = await catRes.json();
          const flatCategories = categoriesData.flatCategories || [];
          flatCategories.forEach(c => catMap.set(c.id, c));
        }

        function getCategoryPath(catId) {
          const path = [];
          let currentId = catId;
          while (currentId) {
            const cat = catMap.get(currentId);
            if (!cat) break;
            path.unshift(cat.name);
            currentId = cat.parentId;
          }
          return path;
        }

        // Folder cache to avoid recreating
        const folderCache = {};
        
        async function getOrCreateFolder(folderPathArray) {
          let currentParentId = barId;
          let pathKey = '';
          for (const folderName of folderPathArray) {
            if (!folderName) continue;
            pathKey += '/' + folderName;
            if (folderCache[pathKey]) {
              currentParentId = folderCache[pathKey];
              continue;
            }
            
            const children = await chrome.bookmarks.getChildren(currentParentId);
            let found = children.find(c => !c.url && c.title === folderName);
            if (!found) {
              found = await chrome.bookmarks.create({ parentId: currentParentId, title: folderName });
            }
            currentParentId = found.id;
            folderCache[pathKey] = found.id;
          }
          return currentParentId;
        }

        // Pre-create all category folders so even empty ones sync
        for (const cat of catMap.values()) {
          const pathArray = ['MarkAI同步', ...getCategoryPath(cat.id)];
          await getOrCreateFolder(pathArray);
        }

        for (const rb of remoteBookmarks) {
          if (!rb.url) continue;
          
          if (!localMap.has(rb.url)) {
            // Needs to be created
            let targetFolderId = barId;
            if (rb.categoryId && catMap.has(rb.categoryId)) {
              const pathArray = ['MarkAI同步', ...getCategoryPath(rb.categoryId)];
              targetFolderId = await getOrCreateFolder(pathArray);
            } else {
              targetFolderId = await getOrCreateFolder(['MarkAI同步', '未分类']);
            }
            await chrome.bookmarks.create({
              parentId: targetFolderId,
              title: rb.title || rb.url,
              url: rb.url
            });
            addedCount++;
          } else {
            // Exists locally, check if we need to update title
            const localNode = localMap.get(rb.url);
            if (rb.title && rb.title !== localNode.title && rb.title !== rb.url) {
              await chrome.bookmarks.update(localNode.id, { title: rb.title });
              updatedCount++;
            }
          }
        }
        
        statusEl.textContent = `🎉 拉取完成！新增: ${addedCount}, 更新: ${updatedCount}`;
        statusEl.className = 'status success';
      } catch (e) {
        console.error(e);
        statusEl.textContent = '❌ 拉取失败: ' + e.message;
        statusEl.className = 'status error';
      }
      
      pullBtn.disabled = false;
    });
  }
