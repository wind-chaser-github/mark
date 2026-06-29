import { NextResponse } from 'next/server';
import { getStore, setStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const syncCode = request.headers.get('x-sync-code') || 'default';
  try {
    const { id } = await params;
    const { name, parentId } = await request.json();
    
    // Check if new parent is not self
    if (parentId && parentId === id) {
      return NextResponse.json({ error: 'Cannot be parent of itself' }, { status: 400 });
    }

    const store = await getStore(syncCode);
    
    const catIndex = store.categories.findIndex(c => c.id === id);
    if (catIndex === -1) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const category = store.categories[catIndex];
    if (name) category.name = name;
    if (parentId !== undefined) category.parentId = parentId;
    category.updatedAt = new Date().toISOString();

    store.categories[catIndex] = category;
    await setStore(syncCode, store);

    return NextResponse.json(category);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const syncCode = request.headers.get('x-sync-code') || 'default';
  try {
    const { id } = await params;
    const store = await getStore(syncCode);

    const catIndex = store.categories.findIndex(c => c.id === id);
    if (catIndex === -1) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // 1. Move all bookmarks in this category to "未分类"
    let uncategorized = store.categories.find(c => c.name === '未分类');
    
    if (uncategorized && uncategorized.id !== id) {
      store.bookmarks.forEach(b => {
        if (b.categoryId === id) {
          b.categoryId = uncategorized!.id;
          b.updatedAt = new Date().toISOString();
        }
      });
      
      // Also update children to point to parent or root
      const parentIdOfDeleted = store.categories[catIndex].parentId;
      store.categories.forEach(c => {
        if (c.parentId === id) {
          c.parentId = parentIdOfDeleted;
          c.updatedAt = new Date().toISOString();
        }
      });
    }

    // 2. Remove category
    store.categories.splice(catIndex, 1);
    
    await setStore(syncCode, store);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
