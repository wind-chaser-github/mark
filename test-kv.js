require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@vercel/kv');

const kv = createClient({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

async function run() {
  const keys = await kv.keys('*');
  console.log('Keys in KV:', keys);
  for (const key of keys) {
    if (key.startsWith('mark:')) {
      const data = await kv.get(key);
      console.log(`Key ${key}: ${data.bookmarks ? data.bookmarks.length : 0} bookmarks`);
    }
  }
}
run();
