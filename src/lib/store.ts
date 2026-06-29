import { kv, createClient } from '@vercel/kv';
import Redis from 'ioredis';
import fs from 'fs';
import path from 'path';

export interface Bookmark {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  rawHtml: string | null;
  favicon: string | null;
  categoryId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppData {
  bookmarks: Bookmark[];
  categories: Category[];
  settings: Record<string, string>;
}

const DEFAULT_DATA: AppData = {
  bookmarks: [],
  categories: [
    {
      id: 'default-uncategorized',
      name: '未分类',
      parentId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ],
  settings: {}
};

const LOCAL_FILE_PATH = path.join(process.cwd(), '.data.json');

const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const useVercelKV = !!kvUrl && !!kvToken;

const rawRedisUrl = process.env.REDIS_URL;
const useRawRedis = !!rawRedisUrl && rawRedisUrl.startsWith('redis');

let myKv = kv;
if (useVercelKV && process.env.UPSTASH_REDIS_REST_URL) {
  myKv = createClient({
    url: kvUrl,
    token: kvToken
  });
}

let redisClient: Redis | null = null;
if (useRawRedis && rawRedisUrl) {
  redisClient = new Redis(rawRedisUrl);
}

// 从本地文件系统读取
async function getLocal(syncCode: string): Promise<AppData> {
  try {
    if (!fs.existsSync(LOCAL_FILE_PATH)) {
      return DEFAULT_DATA;
    }
    const raw = fs.readFileSync(LOCAL_FILE_PATH, 'utf-8');
    const store = JSON.parse(raw);
    return store[syncCode] || DEFAULT_DATA;
  } catch (e) {
    console.error('Failed to read local store', e);
    return DEFAULT_DATA;
  }
}

// 写入本地文件系统
async function setLocal(syncCode: string, data: AppData): Promise<void> {
  try {
    let store: any = {};
    if (fs.existsSync(LOCAL_FILE_PATH)) {
      const raw = fs.readFileSync(LOCAL_FILE_PATH, 'utf-8');
      store = JSON.parse(raw);
    }
    store[syncCode] = data;
    fs.writeFileSync(LOCAL_FILE_PATH, JSON.stringify(store, null, 2));
  } catch (e) {
    console.error('Failed to write local store', e);
  }
}

export async function getStore(syncCode: string): Promise<AppData> {
  if (useRawRedis && redisClient) {
    try {
      const dataStr = await redisClient.get(`mark:${syncCode}`);
      if (!dataStr) return DEFAULT_DATA;
      return JSON.parse(dataStr) as AppData;
    } catch (e) {
      console.error('Redis get error:', e);
      return DEFAULT_DATA;
    }
  } else if (useVercelKV) {
    try {
      const data = await myKv.get<AppData>(`mark:${syncCode}`);
      if (!data) return DEFAULT_DATA;
      return data;
    } catch (e) {
      console.error('KV get error:', e);
      return DEFAULT_DATA;
    }
  } else {
    return getLocal(syncCode);
  }
}

export async function setStore(syncCode: string, data: AppData): Promise<void> {
  if (useRawRedis && redisClient) {
    try {
      await redisClient.set(`mark:${syncCode}`, JSON.stringify(data));
    } catch (e) {
      console.error('Redis set error:', e);
    }
  } else if (useVercelKV) {
    try {
      await myKv.set(`mark:${syncCode}`, data);
    } catch (e) {
      console.error('KV set error:', e);
    }
  } else {
    await setLocal(syncCode, data);
  }
}
