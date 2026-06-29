import { NextResponse } from 'next/server';
import { getStore, setStore, Category, Bookmark, AppData } from '@/lib/store';
import { extractMetadataViaAI } from '@/lib/ai';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const syncCode = request.headers.get('x-sync-code') || 'default';
    data.syncCode = syncCode;
    
    const store = await getStore(syncCode);
    await processSyncAction(data, store);
    await setStore(syncCode, store);
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in sync:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function processSyncAction(actionData: any, store: AppData) {
  const { action, url, title, rawDescription, favicon, folders } = actionData;

  if (action === 'delete') {
    store.bookmarks = store.bookmarks.filter(b => b.url !== url);
    return;
  }

  // Handle category / folders resolution
  let categoryId: string | null = null;
  if (folders && folders.length > 0) {
    const validFolders = folders.filter((f: string) => f !== 'Bookmarks Bar' && f !== '书签栏' && f !== 'Other Bookmarks' && f !== '其他书签');
    let currentParentId: string | null = null;
    let lastCatId: string | null = null;
    
    for (const folderName of validFolders) {
      let cat = store.categories.find(c => c.name === folderName && c.parentId === currentParentId);
      if (!cat) {
        cat = {
          id: uuidv4(),
          name: folderName,
          parentId: currentParentId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        store.categories.push(cat);
      }
      currentParentId = cat.id;
      lastCatId = cat.id;
    }
    categoryId = lastCatId;
  }

  if (!categoryId) {
    let defaultCat = store.categories.find(c => c.name === '未分类');
    if (!defaultCat) {
      defaultCat = {
        id: 'default-uncategorized',
        name: '未分类',
        parentId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      store.categories.push(defaultCat);
    }
    categoryId = defaultCat.id;
  }

  if (action === 'move') {
    store.bookmarks.forEach(b => {
      if (b.url === url) {
        b.categoryId = categoryId;
        b.updatedAt = new Date().toISOString();
      }
    });
    return;
  }

  if (action === 'create' || action === 'create_with_meta') {
    let bookmarkTitle = title || url;
    let bookmarkDesc = null;
    let finalCategoryId = categoryId;
    let tagsData: string[] = [];

    if (action === 'create_with_meta') {
      const metadata = await extractMetadataViaAI(url, title, rawDescription, actionData.syncCode);
      bookmarkTitle = metadata.title;
      bookmarkDesc = metadata.description;
      tagsData = metadata.tags || [];
      // WE DO NOT OVERRIDE categoryId. It strictly follows the browser's original folder.
    } else {
      // mark as pending AI if it fell into 未分类
      const defaultCat = store.categories.find(c => c.name === '未分类');
      if (categoryId === defaultCat?.id) {
        bookmarkDesc = '__PENDING_AI__';
      }
    }

    const existingIndex = store.bookmarks.findIndex(b => b.url === url);
    if (existingIndex === -1) {
      store.bookmarks.push({
        id: uuidv4(),
        url,
        title: bookmarkTitle,
        description: bookmarkDesc,
        rawHtml: null,
        favicon: favicon || null,
        categoryId: finalCategoryId,
        tags: tagsData,
        createdAt: actionData.dateAdded ? new Date(actionData.dateAdded).toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } else if (action === 'create_with_meta') {
      store.bookmarks[existingIndex].title = bookmarkTitle;
      store.bookmarks[existingIndex].description = bookmarkDesc;
      store.bookmarks[existingIndex].favicon = favicon || null;
      store.bookmarks[existingIndex].categoryId = finalCategoryId;
      store.bookmarks[existingIndex].tags = tagsData;
      store.bookmarks[existingIndex].updatedAt = new Date().toISOString();
    }
  }
}
