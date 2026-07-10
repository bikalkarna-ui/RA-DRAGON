'use client';
import { useState, useEffect } from 'react';
import { Star, MessageSquare, Check } from 'lucide-react';

type Review = { id: string; name: string; store_name: string; rating: number; comment: string; created_at: string };

export function ReviewsSection() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/reviews').then(r => r.json()).then(d => setReviews(d.reviews ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    setErr('');
    if (!name.trim() || !comment.trim() || !rating) {
      setErr('Please add your name, a star rating, and a comment.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, store_name: storeName, rating, comment }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Could not submit review'); setSubmitting(false); return; }
      setSubmitted(true);
    } catch {
      setErr('Network error — please try again');
    }
    setSubmitting(false);
  };

  return (
    <section className="max-w-6xl mx-auto px-6 py-24">
      <div className="text-center mb-12">
        <h2 className="text-4xl font-black text-gray-900 mb-4">Store owner reviews</h2>
        <p className="text-lg text-gray-500">Real feedback from people actually using RYXSOR AI</p>
      </div>

      {!loading && reviews.length === 0 && (
        <div className="max-w-md mx-auto text-center rounded-2xl border border-gray-100 bg-gray-50 p-10 mb-10">
          <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="font-bold text-gray-700 mb-1">No reviews yet</p>
          <p className="text-sm text-gray-500">We're brand new — be the first store owner to share what you think.</p>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
          {reviews.map(r => (
            <div key={r.id} className="rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex gap-1 mb-4">
                {Array.from({ length: r.rating }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                ))}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed mb-4">"{r.comment}"</p>
              <div>
                <p className="font-bold text-gray-900 text-sm">{r.name}</p>
                {r.store_name && <p className="text-xs text-gray-400">{r.store_name}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-md mx-auto">
        {submitted ? (
          <div className="text-center rounded-2xl bg-green-50 border border-green-200 p-6">
            <Check className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <p className="font-bold text-green-800 text-sm">Thanks for your review!</p>
            <p className="text-xs text-green-700 mt-1">It'll appear here once we review it.</p>
          </div>
        ) : !showForm ? (
          <button onClick={() => setShowForm(true)}
            className="block mx-auto rounded-xl border-2 border-gray-200 text-gray-700 font-bold text-sm px-6 py-3 hover:border-gray-300 hover:bg-gray-50 transition-all">
            Leave a review
          </button>
        ) : (
          <div className="rounded-2xl border border-gray-200 p-6 space-y-3">
            <div className="flex gap-1 justify-center mb-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setRating(n)}>
                  <Star className={`h-7 w-7 ${n <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'}`} />
                </button>
              ))}
            </div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm focus:border-accent focus:outline-none" />
            <input value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="Store name (optional)"
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm focus:border-accent focus:outline-none" />
            <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="What's your experience been like?" rows={3}
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 text-sm focus:border-accent focus:outline-none resize-none" />
            {err && <p className="text-xs text-red-600 font-semibold">{err}</p>}
            <button onClick={submit} disabled={submitting}
              className="w-full rounded-xl bg-accent text-white font-bold text-sm py-3 hover:bg-red-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Submitting…' : 'Submit review'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
