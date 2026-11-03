import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const KEY = 'testimonials';
const BUCKET = 'testimonials';

export async function GET() {
  try {
    const sb = getSupabase();
    const { data } = await sb
      .from('settings')
      .select('value')
      .eq('key', KEY)
      .maybeSingle();

    const items = data?.value?.items || [];
    return NextResponse.json({
      error_code: 0,
      data: items,
    });
  } catch (e) {
    return NextResponse.json({
      error_code: 0,
      data: [],
    });
  }
}

export async function POST(request) {
  try {
    const auth = request.headers.get('x-admin-password') || '';
    if (auth !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error_code: 1, msg: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { error_code: 1, msg: 'File tidak ditemukan' },
        { status: 400 }
      );
    }

    if (!file.type?.startsWith('image/')) {
      return NextResponse.json(
        { error_code: 1, msg: 'File harus berupa gambar' },
        { status: 400 }
      );
    }

    // Limit 5 MB
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error_code: 1, msg: 'Ukuran maksimal 5 MB' },
        { status: 400 }
      );
    }

    const sb = getSupabase();
    const ext = (file.name?.split('.').pop() || 'jpg').toLowerCase();
    const filename = `testi_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload ke bucket "testimonials" (buat manual di Supabase, public)
    const { error: upErr } = await sb.storage
      .from(BUCKET)
      .upload(filename, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      });

    if (upErr) {
      // Fallback: kalau bucket "testimonials" belum ada, coba pakai bucket "proofs"
      if (/bucket.*not.*found/i.test(upErr.message || '')) {
        const fallback = await sb.storage
          .from('proofs')
          .upload(`testimonials/${filename}`, buffer, {
            contentType: file.type || 'image/jpeg',
            upsert: false,
          });
        if (fallback.error) throw fallback.error;
        const { data: urlData } = sb.storage
          .from('proofs')
          .getPublicUrl(`testimonials/${filename}`);
        return saveAndRespond(sb, {
          id: `proofs/testimonials/${filename}`,
          url: urlData?.publicUrl || '',
        });
      }
      throw upErr;
    }

    const { data: urlData } = sb.storage.from(BUCKET).getPublicUrl(filename);
    return saveAndRespond(sb, { id: filename, url: urlData?.publicUrl || '' });
  } catch (e) {
    console.error('testimonials POST error:', e.message);
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal upload' },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const auth = request.headers.get('x-admin-password') || '';
    if (auth !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { error_code: 1, msg: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json(
        { error_code: 1, msg: 'ID diperlukan' },
        { status: 400 }
      );
    }

    const sb = getSupabase();

    // Hapus file dari storage (handle id yang punya prefix bucket fallback)
    if (id.startsWith('proofs/')) {
      const path = id.slice('proofs/'.length);
      await sb.storage.from('proofs').remove([path]);
    } else {
      await sb.storage.from(BUCKET).remove([id]);
    }

    // Update list di settings
    const { data: existing } = await sb
      .from('settings')
      .select('value')
      .eq('key', KEY)
      .maybeSingle();

    const items = (existing?.value?.items || []).filter((i) => i.id !== id);

    await sb
      .from('settings')
      .upsert(
        { key: KEY, value: { items }, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    return NextResponse.json({ error_code: 0 });
  } catch (e) {
    console.error('testimonials DELETE error:', e.message);
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal hapus' },
      { status: 500 }
    );
  }
}

async function saveAndRespond(sb, { id, url }) {
  const newItem = {
    id,
    url,
    created_at: new Date().toISOString(),
  };

  const { data: existing } = await sb
    .from('settings')
    .select('value')
    .eq('key', KEY)
    .maybeSingle();

  const items = existing?.value?.items || [];
  items.unshift(newItem);

  const { error: setErr } = await sb
    .from('settings')
    .upsert(
      { key: KEY, value: { items }, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );

  if (setErr) throw setErr;

  return NextResponse.json({ error_code: 0, data: newItem });
}
