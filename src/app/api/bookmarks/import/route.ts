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

      const metadata = await extractMetadataViaAI(item.url, item.title, '', syncCode);
      const categoryName = metadata.category !== '未分类' 
        ? metadata.category 
        : (item.folders.length > 0 ? item.folders[0] : '未分类');

      let category = store.categories.find(c => c.name === categoryName);
      if (!category) {
        category = {
          id: uuidv4(),
          name: categoryName,
          parentId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        store.categories.push(category);
      }

      const tags = Array.from(new Set([...metadata.tags, ...item.folders.slice(1)]));

      const newBookmark: Bookmark = {
        id: uuidv4(),
        url: item.url,
        title: item.title || metadata.title,
        description: metadata.description,
        categoryId: category.id,
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
