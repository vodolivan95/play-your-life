import { useId } from 'react';
import type { ReactNode } from 'react';
import heroPeak from '../assets/home-peak.svg';
import type { NextPeak } from '../nextPeak';
import './HomeBanner.css';

/** Размер рисунка гор (вектор): слой с живыми звёздами использует те же координаты. */
const ART_W = 2000;
const ART_H = 888;
/** Золотые звёзды маршрута на рисунке (координаты рисунка). */
const STARS = [
  { x: 1350, y: 320, delay: 0 },
  { x: 1265, y: 440, delay: 1.1 },
  { x: 1125, y: 590, delay: 2.2 },
  { x: 1085, y: 700, delay: 3.3 },
];
/** Тропа к вершине, по которой плывёт световая частица (та же, что нарисована на рисунке). */
const TRAIL =
  'M830 792 C858 787,957 777,1000 762 C1042 747,1064 729,1085 700 C1106 671,1108 622,1125 590 C1142 557,1170 525,1185 505 C1200 485,1202 479,1215 468 C1228 457,1249 455,1265 440 C1281 425,1296 400,1310 380 C1324 360,1337 342,1350 320 C1362 297,1376 269,1385 245 C1394 221,1399 189,1402 178';

/** Фон: картинка гор и отдельный слой звёзд и облаков. Это только оформление, текста здесь нет. */
function BannerArt() {
  const glow = useId().replace(/:/g, '');
  return (
    <div className="peak-art" aria-hidden="true">
      <div className="peak-art-frame">
      <img src={heroPeak} alt="" width={ART_W} height={ART_H} decoding="async" fetchPriority="high" />
      <i className="peak-cloud peak-cloud-a" />
      <i className="peak-cloud peak-cloud-b" />
      <svg className="peak-glow" viewBox={`170 0 ${ART_W} ${ART_H}`} preserveAspectRatio="none" focusable="false">
        <defs>
          <radialGradient id={glow}>
            <stop offset="0" stopColor="#fff6c8" stopOpacity="0.95" />
            <stop offset="0.35" stopColor="#ffd75e" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffd75e" stopOpacity="0" />
          </radialGradient>
        </defs>
        {STARS.map((s) => (
          <circle key={s.y} className="peak-star" cx={s.x} cy={s.y} r={56} fill={`url(#${glow})`} style={{ animationDelay: `${s.delay}s`, transformOrigin: `${s.x}px ${s.y}px` }} />
        ))}
        <circle className="peak-spark" r="20" fill="#fffbe6">
          <animateMotion dur="9s" repeatCount="indefinite" path={TRAIL} />
          <animate attributeName="opacity" values="0;0.95;0.95;0" keyTimes="0;0.12;0.88;1" dur="9s" repeatCount="indefinite" />
        </circle>
      </svg>
      </div>
    </div>
  );
}

function Play() {
  return <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8.5 5.8v12.4c0 .8.9 1.3 1.6.8l9-6.2a1 1 0 0 0 0-1.6l-9-6.2c-.7-.5-1.6 0-1.6.8Z" fill="currentColor" /></svg>;
}
function Arrow({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/** Цветные иконки четырёх возможностей игры. */
function FeatureIcon({ kind }: { kind: 'skills' | 'goals' | 'trophy' | 'heart' }) {
  const id = useId().replace(/:/g, '');
  const g = (a: string, b: string) => <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>;
  if (kind === 'skills')
    return <svg viewBox="0 0 48 48" aria-hidden="true"><defs>{g('#6fb4ff', '#1f6feb')}</defs><rect x="6" y="28" width="9" height="14" rx="3" fill={`url(#${id})`} /><rect x="19.5" y="19" width="9" height="23" rx="3" fill={`url(#${id})`} /><rect x="33" y="9" width="9" height="33" rx="3" fill={`url(#${id})`} /><path d="m8 22 11-8 8 4 13-11" fill="none" stroke="#9fd0ff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (kind === 'goals')
    return <svg viewBox="0 0 48 48" aria-hidden="true"><defs>{g('#5fd7a3', '#16a06a')}</defs><circle cx="22" cy="26" r="17" fill={`url(#${id})`} /><circle cx="22" cy="26" r="11.5" fill="#e8fff4" /><circle cx="22" cy="26" r="6.5" fill="#1db57a" /><circle cx="22" cy="26" r="2.4" fill="#fff" /><path d="m23 25 15-15m0 0h-6m6 0v6" stroke="#2a4a7a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>;
  if (kind === 'trophy')
    return <svg viewBox="0 0 48 48" aria-hidden="true"><defs>{g('#ffe27a', '#f0a81c')}</defs><path d="M14 8h20v12a10 10 0 0 1-20 0V8Z" fill={`url(#${id})`} /><path d="M14 11H7c0 7 3 11 8 12M34 11h7c0 7-3 11-8 12" fill="none" stroke="#f0a81c" strokeWidth="3" strokeLinecap="round" /><rect x="21" y="29" width="6" height="7" fill="#e69a14" /><rect x="14" y="36" width="20" height="5" rx="2.5" fill={`url(#${id})`} /><path d="M19 13v6" stroke="#fff6c8" strokeWidth="2.6" strokeLinecap="round" /></svg>;
  return <svg viewBox="0 0 48 48" aria-hidden="true"><defs>{g('#ff7a8a', '#e5243b')}</defs><path d="M24 41C10 31 6 24 6 17.5 6 12 10 8 15 8c4 0 7 2.4 9 5.5C26 10.4 29 8 33 8c5 0 9 4 9 9.5C42 24 38 31 24 41Z" fill={`url(#${id})`} /><path d="M13 15c1-3 3.5-4.500 6-4" fill="none" stroke="#ffc4cb" strokeWidth="2.8" strokeLinecap="round" /></svg>;
}

const FEATURES: { kind: 'skills' | 'goals' | 'trophy' | 'heart'; page: string; lines: [string, string] }[] = [
  { kind: 'skills', page: 'tree', lines: ['Развивай', 'навыки'] },
  { kind: 'goals', page: 'goals', lines: ['Выполняй', 'цели'] },
  { kind: 'trophy', page: 'achievements', lines: ['Получай', 'достижения'] },
  { kind: 'heart', page: 'profile', lines: ['Создавай', 'лучшую версию себя'] },
];

/** Следующая вершина: карточка поверх гор. Все значения приходят из реальных целей и задач. */
function NextPeakCard({ peak, onShowTask, onCreateGoal }: { peak: NextPeak | null; onShowTask: () => void; onCreateGoal: () => void }) {
  return (
    <aside className="peak-card" aria-label="Следующая вершина">
      <div className="peak-card-head">
        <h2>Следующая вершина</h2>
        {peak && <span className="peak-card-count" aria-label={peak.total > 0 ? `Выполнено ${peak.done} из ${peak.total}` : `Прогресс ${peak.percent}%`}>{peak.counter}</span>}
      </div>
      {peak ? (
        <>
          <p className="peak-card-goal">{peak.headline}</p>
          <p className="peak-card-detail">{peak.detail}</p>
          <div className="peak-card-bar" role="progressbar" aria-label="Прогресс до вершины" aria-valuemin={0} aria-valuemax={100} aria-valuenow={peak.percent}><span style={{ width: `${peak.percent}%` }} /></div>
        </>
      ) : (
        <>
          <p className="peak-card-goal">Выбери свою первую вершину</p>
          <p className="peak-card-detail">Создай цель, и тропа к ней появится здесь.</p>
        </>
      )}
      <div className="peak-card-foot">
        <span className="peak-card-hint">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="m2 19 6.5-10 4 6 2.5-3.5L22 19Z" fill="currentColor" opacity=".85" /><path d="m8.500 9 1.8 2.8-1.8-.6-1.6.9Z" fill="#fff" opacity=".9" /></svg>
          {peak ? 'Ты ближе к своей цели!' : 'Начни с первого шага'}
        </span>
        <button type="button" className="peak-card-button" onClick={peak ? onShowTask : onCreateGoal}>
          {peak ? 'Показать задачу' : 'Создать цель'}
          <Arrow />
        </button>
      </div>
    </aside>
  );
}

export default function HomeBanner({ peak, demo, onContinue, onNavigate, onShowTask, onCreateGoal, onStart, extra }: {
  peak: NextPeak | null;
  demo: boolean;
  onContinue: () => void;
  onNavigate: (page: string) => void;
  onShowTask: () => void;
  onCreateGoal: () => void;
  onStart: () => void;
  extra?: ReactNode;
}) {
  return (
    <section className="peak-banner" aria-labelledby="peak-title">
      <div className="peak-stage">
        <BannerArt />
        <div className="peak-veil" aria-hidden="true" />
        <div className="peak-main">
          <small className="peak-brand">PLAY YOUR LIFE</small>
          <h1 id="peak-title"><span>Ты творец</span>{' '}<span>своей истории</span></h1>
          <p className="peak-sub">Маленькие шаги — большие результаты</p>
          <button type="button" className="peak-cta" onClick={onContinue}>
            <span className="peak-cta-play"><Play /></span>
            <span className="peak-cta-text"><strong>Продолжить путь</strong><small>К своим целям</small></span>
            <Arrow className="peak-cta-arrow" />
          </button>
          <ul className="peak-features">
            {FEATURES.map((f) => (
              <li key={f.kind}>
                <button type="button" onClick={() => onNavigate(f.page)}>
                  <span className="peak-feature-icon"><FeatureIcon kind={f.kind} /></span>
                  <span className="peak-feature-text">{f.lines[0]}<br />{f.lines[1]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <NextPeakCard peak={peak} onShowTask={onShowTask} onCreateGoal={onCreateGoal} />
        {demo && <button type="button" className="peak-demo" onClick={onStart}>Демо · Начать свою игру →</button>}
      </div>
      {extra}
    </section>
  );
}
