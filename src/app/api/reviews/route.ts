import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const sb = createClient();
    const { data, error } = await sb.from('reviews').select('id,name,store_name,rating,comment,created_at')
      .eq('approved', true).order('created_at', { ascending: false }).limit(20);
    if (error) return NextResponse.json({ reviews: [] });
    return NextResponse.json({ reviews: data ?? [] });
  } catch {
    return NextResponse.json({ reviews: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, store_name, rating, comment } = await req.json();
    if (!name?.trim() || !comment?.trim() || !rating) {
      return NextResponse.json({ error: 'Please fill in your name, a rating, and a comment.' }, { status: 400 });
    }
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5.' }, { status: 400 });
    }
    const sb = createClient();
    const { error } = await sb.from('reviews').insert({
      name: name.trim().slice(0, 100),
      store_name: (store_name || '').trim().slice(0, 150),
      rating,
      comment: comment.trim().slice(0, 1000),
      approved: false,
    });
    if (error) {
      console.error('review insert failed:', error);
      return NextResponse.json({ error: 'Could not submit review — please try again.' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Could not submit review — please try again.' }, { status: 500 });
  }
}
