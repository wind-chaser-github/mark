import { NextResponse } from 'next/server';
import { getStore, setStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const syncCode = request.headers.get('x-sync-code') || 'default';
  try {
    const store = await getStore(syncCode);
    return NextResponse.json(store.settings || {});
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const syncCode = request.headers.get('x-sync-code') || 'default';
  try {
    const config = await request.json();
    const store = await getStore(syncCode);
    
    if (!store.settings) {
      store.settings = {};
    }
    
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string') {
        store.settings[key] = value;
      }
    }
    
    await setStore(syncCode, store);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
