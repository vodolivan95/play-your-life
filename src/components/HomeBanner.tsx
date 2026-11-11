import { useState } from 'react';
import type { ReactNode } from 'react';
import heroPeak from '../assets/home-peak.svg';
import heroPeakDark from '../assets/home-peak-dark.webp';
import { goalRoute } from '../goalRoutes';
import type { NextPeak } from '../nextPeak';
import { MAX_MONTHLY_FOCUS } from '../monthlyFocus';
import { useMenuTheme } from '../menuTheme';
import './HomeBanner.css';

const FEATURES = [
  ['tree', '▥', 'Развивай', 'навыки'],
  ['goals', '◎', 'Выполняй', 'проекты'],
  ['achievements', '🏆', 'Получай', 'достижения'],
  ['profile', '♥', 'Создавай', 'лучшую версию себя'],
] as const;

function BannerArt() {
  const [theme] = useMenuTheme();
  return <div className="peak-art" aria-hidden="true">
    <img className={theme === 'dark' ? 'peak-art-dark' : 'peak-art-light'} src={theme === 'dark' ? heroPeakDark : heroPeak} alt="" fetchPriority="high" />
  </div>;
}

function NextPeakCard({ peaks, onChooseFocus }: { peaks: NextPeak[]; onChooseFocus: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const peak = peaks.find(item => item.goalId === selectedId) ?? peaks[0] ?? null;

  return <aside className="peak-card" aria-label="Главные проекты месяца">
    <div className="peak-card-head"><h2>Следующая вершина</h2><span className="peak-card-count">{peak ? peak.counter : `0/${MAX_MONTHLY_FOCUS}`}</span></div>
    {peak ? <>
      <p className="peak-card-goal">{peak.headline}</p>
      <p className="peak-card-detail">Проект: {peak.goalName}{peak.stageStatus === 'active' && peak.total > 0 ? ` · ${peak.done} из ${peak.total} задач` : ''}</p>
      <div className="peak-card-bar" role="progressbar" aria-label="Выполнение задач проекта" aria-valuemin={0} aria-valuemax={100} aria-valuenow={peak.taskPercent ?? peak.percent}><span style={{ width: `${peak.taskPercent ?? peak.percent}%` }} /></div>
      <p className="peak-card-hint">{peak.stageStatus === 'active' ? peak.taskPercent === null ? 'Добавь задачи, чтобы видеть прогресс.' : peak.taskPercent >= 100 ? 'Все задачи этапа выполнены!' : 'Ты ближе к своему проекту!' : peak.stageStatus === 'completed' ? 'Все этапы проекта завершены!' : 'Открой проект и продолжи путь.'}</p>
      <a className="peak-card-button" href={`#${goalRoute(peak.goalId, peak.stageId)}`}>{peak.stageStatus === 'active' ? 'Открыть этап' : 'Открыть проект'} <span aria-hidden="true">›</span></a>
    </> : <>
      <p className="peak-card-goal">Три главных проекта месяца</p>
      <p className="peak-card-detail">Выбери проекты, к которым хочешь двигаться в этом месяце.</p>
      <button className="peak-card-button" type="button" onClick={onChooseFocus}>Выбрать проекты <span aria-hidden="true">›</span></button>
    </>}
    <div className="peak-focus-head"><span>Главные проекты месяца</span><small>{peaks.length} из {MAX_MONTHLY_FOCUS}</small></div>
    <div className="peak-focus-switch" role="group" aria-label="Переключить главный проект месяца">{Array.from({ length: MAX_MONTHLY_FOCUS }, (_, index) => {
      const item = peaks[index];
      return item ? <button key={item.goalId} type="button" aria-pressed={peak?.goalId === item.goalId} aria-label={`Главный проект ${index + 1}: ${item.goalName}`} className={peak?.goalId === item.goalId ? 'is-active' : ''} onClick={() => setSelectedId(item.goalId)}><b>{index + 1}</b><span>{item.goalImage ? <img src={item.goalImage} alt="" /> : '◆'}</span><small>{item.goalName}</small></button> : <button key={`empty-${index}`} type="button" className="is-empty" aria-label={`Назначить главный проект ${index + 1}`} onClick={onChooseFocus}><b>＋</b><small>Проект {index + 1}</small></button>;
    })}</div>
  </aside>;
}

export default function HomeBanner({ peaks, demo, onContinue, onNavigate, onChooseFocus, onStart, extra }: {
  peaks: NextPeak[]; demo: boolean; onContinue: () => void; onNavigate: (page: string) => void; onChooseFocus: () => void; onStart: () => void; extra?: ReactNode;
}) {
  return <section className="peak-banner" aria-label="Главная вершина и проекты месяца">
    <div className="peak-stage">
      <BannerArt />
      <div className="peak-main">
        <small className="peak-brand">PLAY YOUR LIFE</small>
        <h1><span>Ты творец</span><span>своей истории</span></h1>
        <p className="peak-sub">Маленькие шаги — большие результаты</p>
        <button type="button" className="peak-cta" onClick={onContinue}><span className="peak-cta-play">▶</span><span><strong>Продолжить путь</strong><small>К своим проектам</small></span><b aria-hidden="true">›</b></button>
        <ul className="peak-features">{FEATURES.map(([page, icon, line1, line2]) => <li key={page}><button type="button" onClick={() => onNavigate(page)}><span className="peak-feature-icon">{icon}</span><span>{line1}<br />{line2}</span></button></li>)}</ul>
      </div>
      <NextPeakCard peaks={peaks} onChooseFocus={onChooseFocus} />
      {demo && <button type="button" className="peak-demo" onClick={onStart}>Демо · Начать свою игру →</button>}
    </div>
    {extra}
  </section>;
}
