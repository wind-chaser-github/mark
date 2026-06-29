const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({});
prisma.setting.findMany().then(res => {
  console.log('SUCCESS', res);
  process.exit(0);
}).catch(err => {
  console.error('FAILED', err);
  process.exit(1);
});
