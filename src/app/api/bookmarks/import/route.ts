import { NextResponse } from 'next/server';
import { getStore, setStore, Bookmark, Category } from '@/lib/store';
import { extractMetadataViaAI } from '@/lib/ai';
import { parseNetscapeBookmarks } from '@/lib/bookmarkParser';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const syncCode = request.headers.get('x-sync-code') || 'default';
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const html = await file.text();
    const parsedBookmarks = parseNetscapeBookmarks(html);
    
    let imported = 0;
    let skipped = 0;

    const store = await getStore(syncCode);

    const limit = Math.min(parsedBookmarks.length, 20); 

    for (let i = 0; i < limit; i++) {
      const item = parsedBookmarks[i];
      
      const existing = store.bookmarks.find(b => b.url === item.url);
      if (existing) {
        skipped++;
        continue;
      }

      const categoryName = item.folders.length > 0 ? item.folders[item.folders.length - 1] : '未分类';

      // We still need to ensure the full folder path is created if needed, similar to sync route.
      // But for simplicity in HTML import, creating just the deepest folder as a flat category works for now,
      // or we can recreate the tree. Let's just create the tree if we have folders.
      let categoryId: string | null = null;
      if (item.folders && item.folders.length > 0) {
        const validFolders = item.folders.filter((f: string) => f !== 'Bookmarks Bar' && f !== '书签栏' && f !== 'Other Bookmarks' && f !== '其他书签');
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

      const tags = Array.from(new Set(item.folders.slice(1))); // Just use subfolders as tags if wanted

      const newBookmark: Bookmark = {
        id: uuidv4(),
        url: item.url,
        title: item.title || item.url,
        description: null,
        categoryId: categoryId,
        createdAt: item.addDate ? new Date(item.addDate * 1000).toISOString() : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: tags,
        rawHtml: null,
        favicon: null
      };

      store.bookmarks.push(newBookmark);
      imported++;
    }

    await setStore(syncCode, store);

    return NextResponse.json({ 
      success: true, 
      imported, 
      skipped, 
      totalProcessed: limit, 
      totalFound: parsedBookmarks.length 
    });
  } catch (error: any) {
    console.error('Import error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
