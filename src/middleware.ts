import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || process.env.ACCESS_PASSWORD || 'default-secret-key-123';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 放行公共资源
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname === '/login' ||
    pathname === '/api/auth/login'
  ) {
    return NextResponse.next();
  }

  const tokenCookie = request.cookies.get('auth-token')?.value;
  const authHeader = request.headers.get('authorization');
  let syncCode = 'default';
  let isAuthenticated = false;

  // 1. 如果有 Bearer Token (给浏览器插件等 API 请求使用)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const tokenStr = authHeader.split(' ')[1];
    if (tokenStr && tokenStr.trim() !== '') {
      syncCode = tokenStr;
      isAuthenticated = true;
    }
  }

  // 2. 如果 Cookie 存在，验证 JWT
  if (!isAuthenticated && tokenCookie) {
    try {
      const secret = new TextEncoder().encode(JWT_SECRET);
      const { payload } = await jwtVerify(tokenCookie, secret);
      if (payload && payload.syncCode) {
        syncCode = payload.syncCode as string;
        isAuthenticated = true;
      }
    } catch (e) {
      isAuthenticated = false;
    }
  }

  // 对于没有 Token 的用户，是否强制跳转登录页？
  // 如果是多租户系统，必须要验证身份。
  if (!isAuthenticated) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 将 syncCode 注入到 Headers 透传给 API
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-sync-code', syncCode);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|api/auth/login).*)']
};
