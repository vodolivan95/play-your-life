import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import heroPeak from '../assets/home-peak.svg';
import heroPeakDark from '../assets/home-peak-dark.webp';
import renovationFallback from '../assets/project-renovation-reference.png';
import { goalRoute } from '../goalRoutes';
import type { NextPeak, TimeProgress } from '../nextPeak';
import { MAX_MONTHLY_FOCUS } from '../monthlyFocus';
import { useMenuTheme } from '../menuTheme';
import './HomeBanner.css';

const FEATURES = [
  ['tree', '▥', 'Развивай', 'навыки'],
  ['goals', '◎', 'Выполняй', 'проекты'],
  ['achievements', '🏆', 'Получай', 'достижения'],
  ['profile', '♥', 'Создавай', 'лучшую версию себя'],
] as const;

function pluralDays(value: number) {
  const n = Math.abs(value), mod10 = n % 10, mod100 = n % 100;
  return mod10 === 1 && mod100 !== 11 ? 'день' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'дня' : 'дней';
}

function pluralTasks(value: number) {
  const n = Math.abs(value), mod10 = n % 10, mod100 = n % 100;
  return mod10 === 1 && mod100 !== 11 ? 'задача' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'задачи' : 'задач';
}

function formatDate(value: string | undefined, year = false) {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', ...(year ? { year: 'numeric' } : {}) }).format(date).replaceAll('.', '');
}

function cleanGoalName(name: string) {
  return name.replace(/^\s*(?:\p{Extended_Pictographic}\uFE0F?\s*)?проект\s*[«“"]?\s*/iu, '').replace(/[»”"]\s*$/u, '').trim();
}

function timeCaption(time: TimeProgress | null) {
  if (!time || time.state === 'invalid') return 'Сроки этапа не указаны';
  if (time.state === 'before') {
    const days = Math.max(0, time.remainingDays - time.totalDays);
    return `До начала: ${days} ${pluralDays(days)}`;
  }
  if (time.state === 'overdue') return `Просрочено на ${Math.abs(time.remainingDays)} ${pluralDays(time.remainingDays)}`;
  if (time.state === 'due-today') return 'Срок завершения — сегодня';
  return `Осталось: ${time.remainingDays} ${pluralDays(time.remainingDays)}`;
}

function encouragement(peak: NextPeak) {
  if (peak.stageStatus === 'completed') return 'Этап успешно завершён!';
  if (peak.stageStatus === 'unavailable') return 'Открой проект и выбери следующий этап.';
  if (peak.stageStatus === 'none') return 'Добавь этапы и двигайся к цели.';
  if (peak.time?.state === 'overdue') return 'Срок этапа прошёл. Проверь задачи.';
  if (peak.time?.state === 'before') return 'Следующая вершина уже близко!';
  if (peak.total === 0) return 'Добавь задачи этапа, чтобы видеть прогресс.';
  if (peak.done === peak.total) return 'Все задачи этапа выполнены!';
  if ((peak.taskPercent ?? 0) >= 50) return 'Ты уверенно движешься к цели!';
  return 'Ты ближе к своему проекту!';
}

function BannerArt() {
  const [theme] = useMenuTheme();
  return <div className="peak-art" aria-hidden="true"><img className={theme === 'dark' ? 'peak-art-dark' : 'peak-art-light'} src={theme === 'dark' ? heroPeakDark : heroPeak} alt="" fetchPriority="high" /></div>;
}

function NextPeakCard({ peaks, onChooseFocus }: { peaks: NextPeak[]; onChooseFocus: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const peak = peaks.find(item => item.goalId === selectedId) ?? peaks[0] ?? null;
  const currentIndex = peak ? peaks.findIndex(item => item.goalId === peak.goalId) : -1;
  const taskPercent = peak?.taskPercent ?? (peak?.stageStatus === 'completed' ? 100 : null);
  const timePercent = peak?.time && peak.time.state !== 'invalid' ? peak.time.percent : null;
  const startLabel = formatDate(peak?.startsAt);
  const dueLabel = formatDate(peak?.dueAt, true);
  const timeStyle = { '--peak-progress': `${timePercent ?? 0}%`, '--peak-marker': `${Math.min(96, Math.max(4, timePercent ?? 0))}%` } as CSSProperties;
  const taskStyle = { '--peak-progress': `${taskPercent ?? 0}%` } as CSSProperties;
  const projectEmoji = (name: string) => name.match(/^\s*(\p{Extended_Pictographic}\uFE0F?)/u)?.[1] || '◆';
  const selectRelative = (offset: number) => {
    if (peaks.length < 2 || currentIndex < 0) return;
    setSelectedId(peaks[(currentIndex + offset + peaks.length) % peaks.length].goalId);
  };

  return <aside className="peak-card" aria-label="Следующая вершина и главные проекты месяца">
    <div className="peak-card-head"><h2>Следующая вершина</h2><div className="peak-card-controls"><button type="button" aria-label="Предыдущий проект" disabled={peaks.length < 2} onClick={() => selectRelative(-1)}>‹</button><span className="peak-card-count" aria-live="polite">{peak ? `${currentIndex + 1} / ${peaks.length}` : `0 / ${MAX_MONTHLY_FOCUS}`}</span><button type="button" aria-label="Следующий проект" disabled={peaks.length < 2} onClick={() => selectRelative(1)}>›</button></div></div>
    {peak ? <>
      <div className="peak-card-intro">
        <div className="peak-card-copy"><p className="peak-card-goal">{peak.headline}</p><p className="peak-card-project"><span aria-hidden="true">⌂</span> Проект: {cleanGoalName(peak.goalName)}</p></div>
        <img className="peak-card-photo" src={peak.goalImage || renovationFallback} alt="" />
      </div>
      <div className="peak-card-stage"><span aria-hidden="true">▰</span><span>Текущий этап:</span><strong>{peak.stageStatus === 'active' ? peak.stageName || peak.headline : peak.stageStatus === 'completed' ? 'Все этапы завершены' : peak.stageStatus === 'none' ? 'Этапы пока не добавлены' : 'Нет активного этапа'}</strong></div>
      <div className="peak-card-date-row">
        <div><span className="peak-mini-icon" aria-hidden="true">▦</span><span>{startLabel && dueLabel ? <>{startLabel} — <b>{dueLabel}</b></> : 'Даты этапа не указаны'}</span></div>
        <div><span className="peak-mini-icon peak-clock" aria-hidden="true">◷</span><span>{timeCaption(peak.time)}</span></div>
      </div>
      <section className="peak-card-time" aria-label="Прогресс по срокам этапа">
        <h3><span aria-hidden="true">▦</span> Прогресс по срокам этапа</h3>
        {timePercent !== null && peak.time ? <>
          <div className="peak-card-time-track" style={timeStyle} role="progressbar" aria-label="Прошедшая доля срока этапа" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(timePercent)}><span className="peak-card-time-fill" /><i className="peak-card-time-marker"><b>{Math.round(timePercent)}%</b></i></div>
          <div className="peak-card-time-labels"><span>{startLabel || 'Старт'}<small>Старт</small></span><span>Прошло: {peak.time.elapsedDays} {pluralDays(peak.time.elapsedDays)}</span><span>{dueLabel || 'Завершение'}<small>Завершение</small></span></div>
        </> : <p className="peak-card-neutral">Укажи даты начала и завершения этапа.</p>}
      </section>
      <section className="peak-card-tasks" aria-label="Выполнение задач этапа">
        <h3><span aria-hidden="true">☑</span> Выполнение задач этапа</h3>
        <p>{peak.total ? <>Выполнено: <b>{peak.done} из {peak.total} {pluralTasks(peak.total)}</b></> : peak.stageStatus === 'completed' ? 'Все этапы проекта завершены' : 'Задачи этапа пока не добавлены'}</p>
        <div className="peak-card-task-row"><div className="peak-card-task-track" style={taskStyle} role="progressbar" aria-label="Выполнение задач этапа" aria-valuemin={0} aria-valuemax={100} aria-valuenow={taskPercent ?? undefined} aria-valuetext={taskPercent === null ? 'Задачи этапа пока не добавлены' : `${taskPercent}%`}><span /></div><b>{taskPercent === null ? '—' : `${taskPercent}%`}</b></div>
      </section>
      <p className="peak-card-hint"><span aria-hidden="true">▲</span>{encouragement(peak)}</p>
      <a className="peak-card-button" href={`#${goalRoute(peak.goalId, peak.stageId)}`}>{peak.stageStatus === 'active' ? 'Открыть этап' : 'Открыть проект'} <span aria-hidden="true">›</span></a>
    </> : <div className="peak-card-empty"><p className="peak-card-goal">Выбери главные проекты месяца</p><p className="peak-card-detail">К каким проектам хочешь двигаться дальше?</p><button className="peak-card-button" type="button" onClick={onChooseFocus}>Выбрать проекты <span aria-hidden="true">›</span></button></div>}
    <div className="peak-focus-head"><span>Главные проекты месяца</span><small>{peaks.length} из {MAX_MONTHLY_FOCUS}</small></div>
    <div className="peak-focus-switch" role="group" aria-label="Переключить главный проект месяца">{Array.from({ length: MAX_MONTHLY_FOCUS }, (_, index) => {
      const item = peaks[index];
      return item ? <button key={item.goalId} type="button" aria-pressed={peak?.goalId === item.goalId} aria-label={`Главный проект ${index + 1}: ${cleanGoalName(item.goalName)}`} className={peak?.goalId === item.goalId ? 'is-active' : ''} onClick={() => setSelectedId(item.goalId)}><b>{index + 1}</b><span>{item.goalImage ? <img src={item.goalImage} alt="" /> : projectEmoji(item.goalName)}</span><small>{cleanGoalName(item.goalName)}</small></button> : <button key={`empty-${index}`} type="button" className="is-empty" aria-label={`Назначить главный проект ${index + 1}`} onClick={onChooseFocus}><b>＋</b><small>Проект {index + 1}</small></button>;
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
