import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractMetadataViaAI } from '@/lib/ai';
import { parseNetscapeBookmarks } from '@/lib/bookmarkParser';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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

    // For an MVP, we process them sequentially or in batches. 
    // WARNING: Processing too many with AI sequentially might hit rate limits or take too long.
    // To prevent Vercel 10s timeout, we should ideally put this in a queue. 
    // For now, we'll process the first 10 for demonstration if there are many, 
    // or just process them without AI if there are too many.
    const limit = Math.min(parsedBookmarks.length, 20); // Cap at 20 for initial test

    for (let i = 0; i < limit; i++) {
      const item = parsedBookmarks[i];
      
      const existing = await prisma.bookmark.findUnique({ where: { url: item.url } });
      if (existing) {
        skipped++;
        continue;
      }

      // We can use AI to classify, or fallback to folder names if AI fails
      const metadata = await extractMetadataViaAI(item.url, item.title, '');
      const categoryName = metadata.category !== '未分类' 
        ? metadata.category 
        : (item.folders.length > 0 ? item.folders[0] : '未分类');

      const category = await prisma.category.upsert({
        where: { name: categoryName },
        update: {},
        create: { name: categoryName }
      });

      const tags = Array.from(new Set([...metadata.tags, ...item.folders.slice(1)]));

      await prisma.bookmark.create({
        data: {
          url: item.url,
          title: item.title || metadata.title,
          description: metadata.description,
          categoryId: category.id,
          createdAt: item.addDate ? new Date(item.addDate * 1000) : new Date(),
          tags: {
            connectOrCreate: tags.map(tag => ({
              where: { name: tag },
              create: { name: tag }
            }))
          }
        }
      });
      
      imported++;
    }

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
