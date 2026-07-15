import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getValidGmailToken } from '@/lib/gmail';

function decodeBase64Url(data: string): string {
  try {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
  } catch { return ''; }
}

function extractPlainText(payload: any): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) return decodeBase64Url(payload.body.data);
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractPlainText(part);
      if (text) return text;
    }
  }
  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return decodeBase64Url(payload.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  }
  return '';
}

export async function GET(req: NextRequest) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: store } = await sb.from('stores').select('id').eq('owner_id', user.id).maybeSingle();
  if (!store) return NextResponse.json({ error: 'No store found' }, { status: 404 });

  const gmail = await getValidGmailToken(sb, store.id);
  if (!gmail) return NextResponse.json({ error: 'Gmail not connected or needs reconnecting', needsReconnect: true }, { status: 400 });

  try {
    // Get the 10 most recent messages in the inbox
    const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10&labelIds=INBOX', {
      headers: { Authorization: `Bearer ${gmail.token}` },
    });
    if (!listRes.ok) return NextResponse.json({ error: 'Could not fetch emails from Gmail' }, { status: 500 });
    const listData = await listRes.json();
    const ids: string[] = (listData.messages ?? []).map((m: any) => m.id);

    if (ids.length === 0) return NextResponse.json({ emails: [] });

    const emails = await Promise.all(ids.map(async (id) => {
      const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
        headers: { Authorization: `Bearer ${gmail.token}` },
      });
      if (!res.ok) return null;
      const msg = await res.json();
      const headers = msg.payload?.headers ?? [];
      const get = (name: string) => headers.find((h: any) => h.name === name)?.value ?? '';
      const body = extractPlainText(msg.payload).slice(0, 3000);
      return {
        id: msg.id,
        from: get('From'),
        subject: get('Subject') || '(no subject)',
        date: get('Date'),
        snippet: msg.snippet ?? '',
        body,
        unread: (msg.labelIds ?? []).includes('UNREAD'),
      };
    }));

    const validEmails = emails.filter(Boolean);

    // AI-summarize each email in one batched call
    const apiKey = process.env.OPENROUTER_API_KEY;
    let summaries: Record<string, string> = {};
    if (apiKey && validEmails.length > 0) {
      const prompt = `Summarize each of these emails in ONE short sentence (max 15 words) — what does the sender want or need, in plain language. Return ONLY a JSON object mapping email id to summary, nothing else.\n\n${validEmails.map((e: any) => `ID: ${e.id}\nFrom: ${e.from}\nSubject: ${e.subject}\nBody: ${e.body.slice(0, 500)}`).join('\n---\n')}`;

      try {
        const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'anthropic/claude-haiku-4-5', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const raw = aiData?.choices?.[0]?.message?.content ?? '';
          const match = raw.match(/\{[\s\S]*\}/);
          if (match) summaries = JSON.parse(match[0]);
        }
      } catch (err) {
        console.error('email summarization AI call failed (non-fatal):', err);
      }
    }

    const result = validEmails.map((e: any) => ({
      id: e.id, from: e.from, subject: e.subject, date: e.date, unread: e.unread,
      summary: summaries[e.id] || e.snippet,
    }));

    return NextResponse.json({ emails: result, connectedAs: gmail.email });
  } catch (err: any) {
    console.error('email summarize threw:', err);
    return NextResponse.json({ error: err?.message || 'Something went wrong' }, { status: 500 });
  }
}
