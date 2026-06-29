import { NextResponse } from 'next/server';
import { processSyncAction } from '../sync/route';
import { getStore, setStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { actions } = data;

    if (!actions || !Array.isArray(actions)) {
      return NextResponse.json({ error: 'Invalid actions array' }, { status: 400 });
    }

    const syncCode = request.headers.get('x-sync-code') || 'default';
    const store = await getStore(syncCode);

    let processedCount = 0;
    for (const actionData of actions) {
      actionData.syncCode = syncCode;
      try {
        await processSyncAction(actionData, store);
        processedCount++;
      } catch (err) {
        console.error('Error processing offline sync action:', actionData, err);
      }
    }

    await setStore(syncCode, store);

    return NextResponse.json({ success: true, processedCount });
  } catch (error: any) {
    console.error('Error in batch sync:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
