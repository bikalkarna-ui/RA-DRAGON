'use client';
import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: "Hi! I'm here to answer questions about RYXSOR AI — features, pricing, how it works. What would you like to know?" },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const nextMessages = [...messages, { role: 'user' as const, content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/landing-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: nextMessages.map(m => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      if (data.reply) setMessages(m => [...m, { role: 'assistant', content: data.reply }]);
      else setMessages(m => [...m, { role: 'assistant', content: "Sorry, I'm having trouble right now — try emailing bikalkarna@gmail.com." }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: "Sorry, I'm having trouble right now — try emailing bikalkarna@gmail.com." }]);
    }
    setLoading(false);
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] max-w-sm h-[28rem] rounded-2xl bg-white shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="bg-accent text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div>
              <p className="font-bold text-sm">Ask about RYXSOR AI</p>
              <p className="text-[11px] text-red-100">Usually replies instantly</p>
            </div>
            <button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                  m.role === 'user' ? 'bg-accent text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl px-3.5 py-2 text-sm text-gray-400">Typing…</div>
              </div>
            )}
            <div ref={endRef} />
          </div>
          <div className="border-t border-gray-100 p-3 flex items-center gap-2 shrink-0">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Ask a question…"
              className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-accent focus:outline-none" />
            <button onClick={send} disabled={loading || !input.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white disabled:opacity-40 shrink-0">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <button onClick={() => setOpen(v => !v)}
        className="fixed bottom-6 right-4 sm:right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-xl hover:bg-red-700 transition-colors active:scale-95">
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </>
  );
}
