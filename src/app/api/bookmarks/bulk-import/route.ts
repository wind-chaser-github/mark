import { NextResponse } from 'next/server';
import { getStore, setStore, Category, Bookmark } from '@/lib/store';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const syncCode = request.headers.get('x-sync-code') || 'default';
  try {
    const { bookmarks } = await request.json();
    
    if (!Array.isArray(bookmarks) || bookmarks.length === 0) {
      return NextResponse.json({ error: 'Valid bookmarks array is required' }, { status: 400 });
    }

    const store = await getStore(syncCode);

    // Ensure "未分类" category exists
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

    let importedCount = 0;
    
    for (const bm of bookmarks) {
      if (!bm.url) continue;
      
      const existing = store.bookmarks.find(b => b.url === bm.url);
      if (!existing) {
        let categoryId = defaultCat.id;
        
        // If it came from a browser folder structure, preserve it!
        if (bm.folders && Array.isArray(bm.folders) && bm.folders.length > 0) {
          const validFolders = bm.folders.filter((f: string) => f !== 'Bookmarks Bar' && f !== '书签栏' && f !== 'Other Bookmarks' && f !== '其他书签');
          
          if (validFolders.length > 0) {
            let currentParentId: string | null = null;
            let lastCatId = defaultCat.id;
            
            // Create nested folder structure
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
        }
        
        const newBookmark: Bookmark = {
          id: uuidv4(),
          url: bm.url,
          title: bm.title || bm.url,
          categoryId: categoryId,
          tags: [],
          description: categoryId === defaultCat.id ? '__PENDING_AI__' : null,
          rawHtml: null,
          favicon: null, // Depending on the import format
          createdAt: bm.dateAdded ? new Date(bm.dateAdded).toISOString() : new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        store.bookmarks.push(newBookmark);
        importedCount++;
      }
    }

    await setStore(syncCode, store);

    return NextResponse.json({ 
      success: true, 
      message: `Successfully imported ${importedCount} bookmarks.`,
      importedCount
    });
  } catch (error: any) {
    console.error('Error importing bookmarks:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
