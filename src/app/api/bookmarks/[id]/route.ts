import { NextResponse } from 'next/server';
import { getStore, setStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const syncCode = request.headers.get('x-sync-code') || 'default';
  try {
    const { id } = await params;
    
    const store = await getStore(syncCode);
    const initialLength = store.bookmarks.length;
    store.bookmarks = store.bookmarks.filter(b => b.id !== id);
    
    if (store.bookmarks.length === initialLength) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await setStore(syncCode, store);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting bookmark:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const syncCode = request.headers.get('x-sync-code') || 'default';
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, categoryId, tags } = body;

    const store = await getStore(syncCode);
    const bookmarkIndex = store.bookmarks.findIndex(b => b.id === id);
    
    if (bookmarkIndex === -1) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const bookmark = store.bookmarks[bookmarkIndex];

    if (title !== undefined) bookmark.title = title;
    if (description !== undefined) bookmark.description = description;
    
    if (categoryId !== undefined) {
      bookmark.categoryId = categoryId ? categoryId : null;
    }

    if (tags && Array.isArray(tags)) {
      bookmark.tags = tags;
    }
    
    bookmark.updatedAt = new Date().toISOString();
    store.bookmarks[bookmarkIndex] = bookmark;
    
    await setStore(syncCode, store);

    // format for frontend
    const responseData = {
      ...bookmark,
      category: store.categories.find(c => c.id === bookmark.categoryId) || null,
      tags: bookmark.tags.map(t => ({ id: t, name: t }))
    };

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Error updating bookmark:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
