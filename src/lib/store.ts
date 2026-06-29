import { kv, createClient } from '@vercel/kv';
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

// 判断是否配置了 Vercel KV
const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const useKV = !!kvUrl && !!kvToken;

let myKv = kv;
if (useKV && (process.env.UPSTASH_REDIS_REST_URL)) {
  myKv = createClient({
    url: kvUrl,
    token: kvToken
  });
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
  if (useKV) {
    try {
      const data = await myKv.get<AppData>(`mark:${syncCode}`);
      if (!data) return DEFAULT_DATA;
      return data;
    } catch (e) {
      console.error('KV get error:', e);
      return DEFAULT_DATA;
    }
  } else {
    // If we are on Vercel but KV is missing, it will use local, but local is ephemeral!
    return getLocal(syncCode);
  }
}

export async function setStore(syncCode: string, data: AppData): Promise<void> {
  if (useKV) {
    try {
      await myKv.set(`mark:${syncCode}`, data);
    } catch (e) {
      console.error('KV set error:', e);
    }
  } else {
    await setLocal(syncCode, data);
  }
}
