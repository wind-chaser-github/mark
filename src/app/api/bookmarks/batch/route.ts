import { NextResponse } from 'next/server';
import { getStore, setStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const syncCode = request.headers.get('x-sync-code') || 'default';
  try {
    const { action, ids, categoryId, tags } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
    }
    
    const store = await getStore(syncCode);

    if (action === 'DELETE') {
      store.bookmarks = store.bookmarks.filter(b => !ids.includes(b.id));
      await setStore(syncCode, store);
      return NextResponse.json({ success: true, message: `Deleted ${ids.length} bookmarks` });
    }

    if (action === 'MOVE') {
      if (!categoryId) {
        return NextResponse.json({ error: 'categoryId required for MOVE' }, { status: 400 });
      }
      store.bookmarks.forEach(b => {
        if (ids.includes(b.id)) {
          b.categoryId = categoryId;
          b.updatedAt = new Date().toISOString();
        }
      });
      await setStore(syncCode, store);
      return NextResponse.json({ success: true, message: `Moved ${ids.length} bookmarks` });
    }

    if (action === 'TAG') {
      if (!Array.isArray(tags)) {
        return NextResponse.json({ error: 'tags array required for TAG action' }, { status: 400 });
      }
      store.bookmarks.forEach(b => {
        if (ids.includes(b.id)) {
          // Merge tags, avoid duplicates
          const newTags = new Set([...b.tags, ...tags]);
          b.tags = Array.from(newTags);
          b.updatedAt = new Date().toISOString();
        }
      });
      await setStore(syncCode, store);
      return NextResponse.json({ success: true, message: `Tagged ${ids.length} bookmarks` });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Batch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
