import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';

const ACCESS_PASSWORD = process.env.ACCESS_PASSWORD;
const JWT_SECRET = process.env.JWT_SECRET || process.env.ACCESS_PASSWORD || 'default-secret-key-123';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: '密码不能为空' }, { status: 400 });
    }

    const secret = new TextEncoder().encode(JWT_SECRET);
    const alg = 'HS256';

    const token = await new SignJWT({ auth: true, syncCode: password })
      .setProtectedHeader({ alg })
      .setIssuedAt()
      .setExpirationTime('30d') // 30天有效
      .sign(secret);

    const cookieStore = await cookies();
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 // 30 days
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
