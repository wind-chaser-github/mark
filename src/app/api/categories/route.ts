import { NextResponse } from 'next/server';
import { getStore, setStore, Category } from '@/lib/store';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const syncCode = request.headers.get('x-sync-code') || 'default';
  try {
    const store = await getStore(syncCode);
    
    // Fetch all categories
    const allCategories = store.categories.map(c => {
      // Calculate bookmarks count
      const count = store.bookmarks.filter(b => b.categoryId === c.id).length;
      return { ...c, _count: { bookmarks: count } };
    }).sort((a, b) => a.name.localeCompare(b.name));

    // Build tree
    const categoryMap = new Map();
    const roots: any[] = [];

    allCategories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    allCategories.forEach(cat => {
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          parent.children.push(categoryMap.get(cat.id));
        } else {
          // If parent is missing for some reason, treat as root
          roots.push(categoryMap.get(cat.id));
        }
      } else {
        roots.push(categoryMap.get(cat.id));
      }
    });

    // Compute tags (since we store tags in bookmarks array now)
    const tagMap = new Map<string, number>();
    store.bookmarks.forEach(b => {
      b.tags.forEach(t => {
        tagMap.set(t, (tagMap.get(t) || 0) + 1);
      });
    });

    const sortedTags = Array.from(tagMap.entries())
      .map(([name, count]) => ({ id: name, name, _count: { bookmarks: count } }))
      .sort((a, b) => b._count.bookmarks - a._count.bookmarks)
      .slice(0, 20);

    // Also return flat categories for dropdowns
    return NextResponse.json({ categories: roots, flatCategories: allCategories, tags: sortedTags });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const syncCode = request.headers.get('x-sync-code') || 'default';
  try {
    const { name, parentId } = await request.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const store = await getStore(syncCode);
    
    const newCat: Category = {
      id: uuidv4(),
      name,
      parentId: parentId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    store.categories.push(newCat);
    await setStore(syncCode, store);

    return NextResponse.json(newCat);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
