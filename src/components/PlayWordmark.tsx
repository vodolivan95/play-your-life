import { useId } from 'react';
import './PlayWordmark.css';

/** Crisp reference wordmark for the sidebar and mobile footer only. */
export default function PlayWordmark({ horizontal = false }: { horizontal?: boolean }) {
  const gold = `wordmark-gold-${useId().replaceAll(':', '')}`;
  return (
    <div className={`play-wordmark${horizontal ? ' play-wordmark-horizontal' : ''}`} role="img" aria-label="PLAY YOUR LIFE — Твоя жизнь. Твоя игра.">
      <svg className="play-wordmark-crown" viewBox="0 0 72 62" aria-hidden="true">
        <defs><linearGradient id={gold} x1="0" y1="0" x2="0.7" y2="1"><stop stopColor="#ffe67b" /><stop offset="0.55" stopColor="#ffc62c" /><stop offset="1" stopColor="#f3a315" /></linearGradient></defs>
        <path d="M8 19 21 32 36 7 51 32 64 19 57 51H15Z" fill={`url(#${gold})`} />
        <circle cx="8" cy="18" r="4" fill="#ffcd43" /><circle cx="36" cy="7" r="4" fill="#ffcd43" /><circle cx="64" cy="18" r="4" fill="#ffcd43" />
        <path d="m36 28 6 8-6 8-6-8Z" fill="#29b8ee" />
        <path d="M17 55H55" stroke="#f3ae1d" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <div className="play-wordmark-copy"><strong><span>PLAY</span><span>YOUR LIFE</span></strong><small>Твоя жизнь. Твоя игра.</small></div>
    </div>
  );
}
