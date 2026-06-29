import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const envKeys = Object.keys(process.env).filter(k => 
    k.includes('KV') || k.includes('REDIS') || k.includes('UPSTASH') || k.includes('DATABASE')
  );
  
  const envValues: Record<string, string> = {};
  for (const k of envKeys) {
    if (k === 'REDIS_URL') {
      envValues[k] = process.env[k] ? 'starts with: ' + process.env[k].substring(0, 10) : 'EMPTY';
    } else {
      envValues[k] = process.env[k] ? 'SET (length: ' + process.env[k].length + ')' : 'EMPTY';
    }
  }
  
  return NextResponse.json({
    keys: envKeys,
    values: envValues,
    vercel: process.env.VERCEL,
    env: process.env.VERCEL_ENV
  });
}
