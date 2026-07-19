'use client';
import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface AgryxProps {
  ownerName: string;
  storeName: string;
  grossSales: number;
  weekSales: number;
  outOfStock: number;
  lowStock: number;
  shortOver: number;
  hasReport: boolean;
  healthScore: number;
  onDismiss: () => void;
}

function buildScript(p: AgryxProps): string {
  const parts: string[] = [];
  const timeOfDay = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening';
  parts.push(`Good ${timeOfDay}, ${p.ownerName}. This is Agryx.`);

  if (!p.hasReport) {
    parts.push(`No report has been uploaded yet today for ${p.storeName}. I'll let you know as soon as one comes in.`);
  } else {
    const avgDay = p.weekSales / 7;
    if (avgDay > 0) {
      const diff = ((p.grossSales - avgDay) / avgDay) * 100;
      if (Math.abs(diff) < 5) {
        parts.push(`Today's sales are right on pace with your usual day, at $${p.grossSales.toFixed(0)}.`);
      } else if (diff > 0) {
        parts.push(`Sales are up ${Math.round(diff)} percent above your weekly average today, at $${p.grossSales.toFixed(0)}. Nice work.`);
      } else {
        parts.push(`Sales are down ${Math.round(Math.abs(diff))} percent below your weekly average today, at $${p.grossSales.toFixed(0)}.`);
      }
    } else {
      parts.push(`Today's sales are $${p.grossSales.toFixed(0)}.`);
    }

    if (p.shortOver < -0.5) parts.push(`Heads up — the drawer is short by $${Math.abs(p.shortOver).toFixed(2)} today.`);
    else if (p.shortOver > 0.5) parts.push(`The drawer is over by $${p.shortOver.toFixed(2)} today.`);
    else parts.push(`The drawer balanced perfectly.`);
  }

  if (p.outOfStock > 0) parts.push(`${p.outOfStock} item${p.outOfStock === 1 ? ' is' : 's are'} completely out of stock.`);
  if (p.lowStock > 0) parts.push(`${p.lowStock} more ${p.lowStock === 1 ? 'is' : 'are'} running low.`);
  if (p.outOfStock === 0 && p.lowStock === 0) parts.push(`Inventory looks healthy — nothing urgent to reorder.`);

  parts.push(`Store health is at ${p.healthScore} out of 100.`);
  parts.push(`I'll be here if you need anything. Let's get to it.`);

  return parts.join(' ');
}

export function AgryxIntro(props: AgryxProps) {
  const [visible, setVisible] = useState(true);
  const [revealedChars, setRevealedChars] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const scriptRef = useRef(buildScript(props));
  const script = scriptRef.current;

  useEffect(() => {
    // Try real speech synthesis — browsers may block autoplay without a
    // prior user gesture, which is fine: the text below still shows either way.
    let utterance: SpeechSynthesisUtterance | null = null;
    if ('speechSynthesis' in window) {
      try {
        utterance = new SpeechSynthesisUtterance(script);
        utterance.rate = 1.02;
        utterance.pitch = 0.9;
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => /male|david|daniel|google uk english male/i.test(v.name)) || voices[0];
        if (preferred) utterance.voice = preferred;
        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => setSpeaking(false);
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } catch { /* speech not available — text still displays */ }
    }

    // Typewriter reveal, roughly paced with speech regardless of whether
    // audio actually played
    const totalMs = Math.max(4000, script.length * 35);
    const interval = setInterval(() => {
      setRevealedChars(prev => {
        const next = prev + Math.ceil(script.length / (totalMs / 50));
        return next >= script.length ? script.length : next;
      });
    }, 50);

    return () => {
      clearInterval(interval);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, [script]);

  const dismiss = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setVisible(false);
    setTimeout(props.onDismiss, 300);
  };

  return (
    <div
      onClick={dismiss}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gray-950 transition-opacity duration-300 cursor-pointer ${visible ? 'opacity-100' : 'opacity-0'}`}
    >
      <button
        onClick={(e) => { e.stopPropagation(); dismiss(); }}
        className="absolute top-6 right-6 flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Arc-reactor style orb */}
      <div className="relative mb-10">
        <div className={`h-32 w-32 rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 blur-xl ${speaking ? 'animate-pulse' : ''}`} style={{ opacity: 0.7 }} />
        <div className={`absolute inset-0 h-32 w-32 rounded-full border-2 border-cyan-300/60 ${speaking ? 'animate-ping' : ''}`} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-cyan-300 to-blue-500 shadow-[0_0_40px_10px_rgba(56,189,248,0.5)]" />
        </div>
      </div>

      <p className="text-cyan-400 text-xs font-bold tracking-[0.3em] mb-3 uppercase">Agryx</p>
      <p className="text-white text-lg sm:text-2xl font-medium text-center max-w-lg px-8 leading-relaxed min-h-[8rem]">
        {script.slice(0, revealedChars)}
        {revealedChars < script.length && <span className="inline-block w-2 h-5 bg-cyan-400 ml-1 animate-pulse align-middle" />}
      </p>

      <p className="absolute bottom-8 text-gray-500 text-xs">Tap anywhere to skip to your dashboard</p>
    </div>
  );
}
