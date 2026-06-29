import { put, list } from '@vercel/blob';
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

// 判断是否配置了 Vercel Blob
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

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
  if (useBlob) {
    try {
      const targetPath = `mark-data-${syncCode}.json`;
      const { blobs } = await list({ prefix: targetPath });
      const targetBlob = blobs.find(b => b.pathname === targetPath);
      
      if (targetBlob) {
        const response = await fetch(targetBlob.url);
        const data = await response.json();
        return data as AppData;
      }
      return DEFAULT_DATA;
    } catch (e) {
      console.error('Blob get error:', e);
      return DEFAULT_DATA;
    }
  } else {
    return getLocal(syncCode);
  }
}

export async function setStore(syncCode: string, data: AppData): Promise<void> {
  if (useBlob) {
    try {
      const targetPath = `mark-data-${syncCode}.json`;
      await put(targetPath, JSON.stringify(data), {
        access: 'public',
        addRandomSuffix: false
      });
    } catch (e) {
      console.error('Blob set error:', e);
    }
  } else {
    await setLocal(syncCode, data);
  }
}
