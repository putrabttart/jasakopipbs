import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const { password } = await request.json();
    if (password === process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error_code: 0 });
    }
    return NextResponse.json(
      { error_code: 1, msg: 'Password salah' },
      { status: 401 }
    );
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: 'Bad request' },
      { status: 400 }
    );
  }
}
