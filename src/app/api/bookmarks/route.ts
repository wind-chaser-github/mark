import { NextResponse } from 'next/server';
import { getStore, setStore, Bookmark } from '@/lib/store';
import { extractMetadataViaAI } from '@/lib/ai';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const syncCode = request.headers.get('x-sync-code') || 'default';
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') || '';
  const categoryId = searchParams.get('categoryId');
  const tagId = searchParams.get('tagId'); // tagId is now just the tag name itself in our new model
  
  const store = await getStore(syncCode);
  
  let bookmarks = store.bookmarks;
  
  if (q) {
    const query = q.toLowerCase();
    bookmarks = bookmarks.filter(b => 
      (b.title && b.title.toLowerCase().includes(query)) ||
      (b.description && b.description.toLowerCase().includes(query)) ||
      b.url.toLowerCase().includes(query)
    );
  }
  
  if (categoryId) {
    bookmarks = bookmarks.filter(b => b.categoryId === categoryId);
  }
  
  if (tagId) {
    bookmarks = bookmarks.filter(b => b.tags.includes(tagId));
  }
  
  // Sort by createdAt desc
  bookmarks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  // Attach category object for frontend compatibility
  const enrichedBookmarks = bookmarks.map(b => ({
    ...b,
    category: store.categories.find(c => c.id === b.categoryId) || null,
    tags: b.tags.map(t => ({ id: t, name: t })) // map to object for frontend compatibility
  }));
  
  return NextResponse.json(enrichedBookmarks);
}

export async function POST(request: Request) {
  const syncCode = request.headers.get('x-sync-code') || 'default';
  try {
    const { url, rawTitle, rawDescription, favicon } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const store = await getStore(syncCode);

    const existing = store.bookmarks.find(b => b.url === url);
    if (existing) {
      return NextResponse.json({ error: 'Bookmark already exists', bookmark: existing }, { status: 409 });
    }

    // Call AI for categorization
    const metadata = await extractMetadataViaAI(url, rawTitle, rawDescription, syncCode);

    // Upsert Category
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

    // Create Bookmark with tags
    const newBookmark: Bookmark = {
      id: uuidv4(),
      url,
      title: metadata.title,
      description: metadata.description,
      rawHtml: null,
      favicon: favicon || null,
      categoryId: category.id,
      tags: metadata.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    store.bookmarks.push(newBookmark);
    await setStore(syncCode, store);

    // map for frontend
    const responseData = {
      ...newBookmark,
      category,
      tags: newBookmark.tags.map(t => ({ id: t, name: t }))
    };

    return NextResponse.json(responseData);
  } catch (error: any) {
    console.error('Error creating bookmark:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
