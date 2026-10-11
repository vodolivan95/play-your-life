import emblem from '../assets/brand/emblem-128.png';
import emblem2x from '../assets/brand/emblem-256.png';
import './PlayWordmark.css';

/** Логотип меню и мобильного подвала: эмблема «корона с горами» и надпись настоящим текстом. */
export default function PlayWordmark({ horizontal = false }: { horizontal?: boolean }) {
  return (
    <div className={`play-wordmark${horizontal ? ' play-wordmark-horizontal' : ''}`} role="img" aria-label="PLAY YOUR LIFE — Твоя жизнь. Твоя игра.">
      <img className="play-wordmark-crown" src={emblem} srcSet={`${emblem} 1x, ${emblem2x} 2x`} width={128} height={128} alt="" aria-hidden="true" decoding="async" draggable={false} />
      <div className="play-wordmark-copy"><strong><span>PLAY</span><span>YOUR LIFE</span></strong><small>Твоя жизнь. Твоя игра.</small></div>
    </div>
  );
}
