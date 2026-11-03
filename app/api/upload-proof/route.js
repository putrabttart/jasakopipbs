import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const orderId = formData.get('orderId') || 'unknown';

    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { error_code: 1, msg: 'File tidak ditemukan' },
        { status: 400 }
      );
    }

    const sb = getSupabase();

    // Generate unique filename
    const ext = file.name?.split('.').pop() || 'jpg';
    const filename = `${orderId}_${Date.now()}.${ext}`;

    // Upload ke Supabase Storage bucket "proofs"
    const buffer = Buffer.from(await file.arrayBuffer());
    const { data, error } = await sb.storage
      .from('proofs')
      .upload(filename, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = sb.storage.from('proofs').getPublicUrl(filename);
    const publicUrl = urlData?.publicUrl || '';

    // Update order data dengan proof URL
    if (orderId !== 'unknown') {
      await sb
        .from('orders')
        .update({
          data: sb.rpc ? undefined : undefined, // handled below
          status: 'pending',
        })
        .eq('id', orderId);

      // Update proof_url in order data
      const { data: orderRow } = await sb
        .from('orders')
        .select('data')
        .eq('id', orderId)
        .maybeSingle();

      if (orderRow) {
        const updatedData = { ...orderRow.data, proof_url: publicUrl };
        await sb
          .from('orders')
          .update({ data: updatedData })
          .eq('id', orderId);
      }
    }

    return NextResponse.json({
      error_code: 0,
      data: { url: publicUrl, filename },
    });
  } catch (e) {
    console.error('Upload proof error:', e.message);
    return NextResponse.json(
      { error_code: 1, msg: e.message || 'Gagal upload' },
      { status: 500 }
    );
  }
}
