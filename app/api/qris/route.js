import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { convertQRIS, validateQRIS, parseQRIS } from '@/lib/qris';

export const dynamic = 'force-dynamic';

const KEY = 'qris_static';

// GET: generate dynamic QRIS dari static + amount
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const amount = Number(searchParams.get('amount') || 0);

  if (!amount || amount <= 0) {
    return NextResponse.json(
      { error_code: 1, msg: 'Amount harus lebih dari 0' },
      { status: 400 }
    );
  }

  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('settings')
      .select('value')
      .eq('key', KEY)
      .maybeSingle();

    if (error) throw error;

    const qrisStatic = data?.value?.qris || '';
    if (!qrisStatic) {
      return NextResponse.json(
        { error_code: 1, msg: 'QRIS belum di-setup oleh admin' },
        { status: 404 }
      );
    }

    // Convert static → dynamic
    const dynamicQRIS = convertQRIS(qrisStatic, { amount });
    const parsed = parseQRIS(dynamicQRIS);

    return NextResponse.json({
      error_code: 0,
      data: {
        qris: dynamicQRIS,
        amount,
        merchantName: parsed.merchantName,
        merchantCity: parsed.merchantCity,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal generate QRIS' },
      { status: 500 }
    );
  }
}

// POST: admin simpan/update QRIS statis
export async function POST(request) {
  try {
    const auth = request.headers.get('x-admin-password') || '';
    if (auth !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error_code: 1, msg: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const qrisString = (body.qris || '').trim();

    if (!qrisString) {
      return NextResponse.json(
        { error_code: 1, msg: 'String QRIS tidak boleh kosong' },
        { status: 400 }
      );
    }

    // Validate
    const validation = validateQRIS(qrisString);
    if (!validation.valid) {
      return NextResponse.json(
        { error_code: 1, msg: `QRIS tidak valid: ${validation.errors.join(', ')}` },
        { status: 400 }
      );
    }

    const parsed = parseQRIS(qrisString);

    const sb = getSupabase();
    const { data: upsertData, error } = await sb
      .from('settings')
      .upsert(
        {
          key: KEY,
          value: {
            qris: qrisString,
            merchantName: parsed.merchantName,
            merchantCity: parsed.merchantCity,
            method: parsed.method,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      )
      .select();

    if (error) {
      console.error('QRIS POST upsert error:', error);
      throw error;
    }

    console.log('QRIS saved:', upsertData);

    return NextResponse.json({
      error_code: 0,
      data: {
        merchantName: parsed.merchantName,
        merchantCity: parsed.merchantCity,
        method: parsed.method,
      },
    });
  } catch (e) {
    console.error('QRIS POST catch:', e.message);
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal simpan QRIS' },
      { status: 500 }
    );
  }
}
