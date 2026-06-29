import { NextResponse } from 'next/server';
import { getStore, setStore, Category } from '@/lib/store';
import { extractMetadataViaAI } from '@/lib/ai';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const syncCode = request.headers.get('x-sync-code') || 'default';
  try {
    const store = await getStore(syncCode);

    // 1. Find one pending bookmark
    const pendingBookmarkIndex = store.bookmarks.findIndex(b => b.description === '__PENDING_AI__');

    if (pendingBookmarkIndex === -1) {
      return NextResponse.json({ message: 'No pending bookmarks' });
    }
    
    const pendingBookmark = store.bookmarks[pendingBookmarkIndex];
    console.log(`[AI Worker] Processing bookmark: ${pendingBookmark.url}`);

    // 2. Call AI
    const metadata = await extractMetadataViaAI(pendingBookmark.url, pendingBookmark.title || '', '', syncCode);

    // 3. Upsert Category
    let category = store.categories.find(c => c.name === metadata.category);
    if (!category) {
      category = {
        id: uuidv4(),
        name: metadata.category,
        parentId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      store.categories.push(category);
    }

    // 4. Update Bookmark
    pendingBookmark.title = metadata.title;
    pendingBookmark.description = metadata.description;
    pendingBookmark.categoryId = category.id;
    pendingBookmark.tags = metadata.tags || [];
    pendingBookmark.updatedAt = new Date().toISOString();
    
    store.bookmarks[pendingBookmarkIndex] = pendingBookmark;
    
    await setStore(syncCode, store);

    return NextResponse.json({ success: true, processedUrl: pendingBookmark.url });
  } catch (error: any) {
    console.error('Error in AI job:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
