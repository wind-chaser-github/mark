const getConfig = () => {
  const browserAPI = globalThis.browser || globalThis.chrome;
  return new Promise(resolve => {
    browserAPI.storage.local.get({
      syncUrl: 'http://localhost:3999',
      accessPassword: ''
    }, resolve);
  });
};

const browserAPI = globalThis.browser || globalThis.chrome;

browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'BOOKMARK_API') {
    if (!browserAPI.bookmarks) {
      sendResponse({ error: 'No bookmarks API in background' });
      return true;
    }
    const { method, args } = request;
    // Call the bookmarks API
    const apiCall = browserAPI.bookmarks[method](...args);
    if (apiCall && typeof apiCall.then === 'function') {
      apiCall.then(result => sendResponse({ result })).catch(err => sendResponse({ error: err.message }));
    } else {
      // Some APIs might use callbacks if they are older chrome APIs, but promises are standard in MV3
      sendResponse({ error: 'Unsupported API call format' });
    }
    return true; // Keeps the message channel open for async response
  }
});
const getOfflineQueue = () => {
  return new Promise(resolve => {
    browserAPI.storage.local.get({ offlineQueue: [] }, (res) => resolve(res.offlineQueue));
  });
};

const saveToOfflineQueue = async (actionItem) => {
  const queue = await getOfflineQueue();
  queue.push({ ...actionItem, timestamp: Date.now() });
  browserAPI.storage.local.set({ offlineQueue: queue });
};

const processOfflineQueue = async () => {
  const config = await getConfig();
  const queue = await getOfflineQueue();
  if (queue.length === 0) return;
  
  try {
    const res = await fetch(`${config.syncUrl}/api/bookmarks/sync-batch`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.accessPassword}`
      },
      body: JSON.stringify({ actions: queue })
    });
    
    if (res.ok) {
      browserAPI.storage.local.set({ offlineQueue: [] });
      console.log(`[Mark.AI] Synced ${queue.length} offline actions to server.`);
    }
  } catch (e) {
    // 依然离线，什么都不做
  }
};

browserAPI.alarms.create("sync-offline-queue", { periodInMinutes: 5 });
browserAPI.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sync-offline-queue") {
    processOfflineQueue();
  }
});

browserAPI.commands.onCommand.addListener(async (command) => {
  if (command === 'save-bookmark') {
    let [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.startsWith('http')) {
      browserAPI.tabs.sendMessage(tab.id, { action: "show_toast", message: "正在收藏...", type: "loading" }).catch(() => {});

      let rawDescription = '';
      let favicon = '';
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action: "extract_metadata" });
        if (response) {
          rawDescription = (response.metaDescription || '') + '\n' + (response.mainText || '');
          favicon = response.favicon || '';
        }
      } catch (e) {}

      const config = await getConfig();
      const actionData = {
        action: 'create_with_meta',
        url: tab.url,
        title: tab.title,
        rawDescription: rawDescription.substring(0, 1000),
        favicon: favicon
      };

      try {
        const res = await fetch(`${config.syncUrl}/api/bookmarks/sync`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.accessPassword}`
          },
          body: JSON.stringify(actionData)
        });
        
        if (res.ok) {
          chrome.tabs.sendMessage(tab.id, { action: "show_toast", message: "🎉 书签已收藏！", type: "success" }).catch(() => {});
          processOfflineQueue(); 
        } else {
          throw new Error('Server error');
        }
      } catch (error) {
        await saveToOfflineQueue(actionData);
        chrome.tabs.sendMessage(tab.id, { action: "show_toast", message: "⚠️ 服务未连通，已存入离线缓存", type: "success" }).catch(() => {});
      }
    }
  }
});

browserAPI.bookmarks.onCreated.addListener(async (id, bookmark) => {
  if (bookmark.url && bookmark.url.startsWith('http')) {
    let folderPath = [];
    let currentParentId = bookmark.parentId;
    while (currentParentId) {
      const parentNodes = await browserAPI.bookmarks.get(currentParentId);
      if (parentNodes && parentNodes.length > 0) {
        const parent = parentNodes[0];
        if (!parent.parentId) break;
        folderPath.unshift(parent.title);
        currentParentId = parent.parentId;
      } else { break; }
    }

    const actionData = {
      action: 'create',
      url: bookmark.url,
      title: bookmark.title,
      dateAdded: bookmark.dateAdded,
      folders: folderPath
    };
    
    const config = await getConfig();
    try {
      const res = await fetch(`${config.syncUrl}/api/bookmarks/sync`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.accessPassword}`
        },
        body: JSON.stringify(actionData)
      });
      if (res.ok) processOfflineQueue();
      else throw new Error('Server Error');
    } catch (e) {
      await saveToOfflineQueue(actionData);
    }
  }
});

browserAPI.bookmarks.onRemoved.addListener(async (id, removeInfo) => {
  const actionData = {
    action: 'delete',
    url: removeInfo.node.url,
    title: removeInfo.node.title
  };
  if (!actionData.url) return;
  
  const config = await getConfig();
  try {
    const res = await fetch(`${config.syncUrl}/api/bookmarks/sync`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.accessPassword}`
      },
      body: JSON.stringify(actionData)
    });
    if (res.ok) processOfflineQueue();
    else throw new Error();
  } catch (e) {
    await saveToOfflineQueue(actionData);
  }
});

browserAPI.bookmarks.onMoved.addListener(async (id, moveInfo) => {
  const nodes = await browserAPI.bookmarks.get(id);
  const bookmark = nodes[0];
  if (!bookmark || !bookmark.url) return;

  let folderPath = [];
  let currentParentId = moveInfo.parentId;
  while (currentParentId) {
    const parentNodes = await browserAPI.bookmarks.get(currentParentId);
    if (parentNodes && parentNodes.length > 0) {
      const parent = parentNodes[0];
      if (!parent.parentId) break;
      folderPath.unshift(parent.title);
      currentParentId = parent.parentId;
    } else { break; }
  }

  const actionData = {
    action: 'move',
    url: bookmark.url,
    folders: folderPath
  };
  
  const config = await getConfig();
  try {
    const res = await fetch(`${config.syncUrl}/api/bookmarks/sync`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.accessPassword}`
      },
      body: JSON.stringify(actionData)
    });
    if (res.ok) processOfflineQueue();
    else throw new Error();
  } catch (e) {
    await saveToOfflineQueue(actionData);
  }
});

browserAPI.bookmarks.onChanged.addListener(async (id, changeInfo) => {
  const actionData = {
    action: 'update',
    url: changeInfo.url,
    title: changeInfo.title,
    updatedAt: new Date().toISOString()
  };
  
  const config = await getConfig();
  try {
    const res = await fetch(`${config.syncUrl}/api/bookmarks/sync`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.accessPassword}`
      },
      body: JSON.stringify(actionData)
    });
    if (res.ok) processOfflineQueue();
    else throw new Error();
  } catch (e) {
    await saveToOfflineQueue(actionData);
  }
});
