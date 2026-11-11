import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { goalRoute } from '../goalRoutes';
import type { NextPeak } from '../nextPeak';
import { MAX_MONTHLY_FOCUS } from '../monthlyFocus';
import './HomeBanner.css';

function MountainMark() {
  return <svg className="peak-mark" viewBox="0 0 76 56" aria-hidden="true"><path d="M2 49 22 20l12 16 12-25 28 38H2Z" fill="#ffd05b"/><path d="m18 49 16-21 19 21H18Z" fill="#ffe38a"/><path d="M53 5v28" stroke="#f5f7ff" strokeWidth="2"/><path d="M54 6h14l-6 6 6 6H54Z" fill="#ffd05b"/></svg>;
}
function Arrow({ direction = 'right' }: { direction?: 'left' | 'right' }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d={direction === 'right' ? 'm9 5 7 7-7 7' : 'm15 5-7 7 7 7'} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function shortDate(value?: string) {
  if (!value) return '—';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date).replace('.', '');
}
function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
}
function motivation(peak: NextPeak) {
  if (peak.stageStatus === 'completed') return '🏆 Все этапы проекта завершены!';
  if (peak.stageStatus === 'unavailable') return '🏔️ Открой проект, чтобы продолжить путь.';
  if (peak.stageStatus === 'none') return '🏔️ Добавь первый этап и выбери следующую вершину.';
  if (peak.time?.state === 'overdue') return `⏳ Срок этапа прошёл. Проверь оставшиеся задачи.`;
  if (peak.time?.state === 'before') return '🏔️ Следующая вершина уже близко!';
  if (peak.taskPercent === null) return 'Добавь задачи, чтобы видеть свой прогресс.';
  if (peak.taskPercent === 100) return '🎉 Все задачи этапа выполнены!';
  if (peak.taskPercent < 25) return '🚀 Первые шаги к вершине!';
  if (peak.taskPercent < 50) return '🏔️ Продолжай движение к цели!';
  if (peak.taskPercent < 75) return '💪 Ты уверенно движешься к цели!';
  return '🏆 До вершины осталось немного!';
}
function timeText(peak: NextPeak) {
  const t = peak.time;
  if (!t) return 'Сроки этапа не указаны';
  if (t.state === 'invalid') return 'Проверь даты этапа';
  if (t.state === 'before') return `До начала: ${t.elapsedDays < 0 ? -t.elapsedDays : Math.max(0, t.remainingDays - t.totalDays)} ${plural(Math.max(0, t.remainingDays - t.totalDays), 'день', 'дня', 'дней')}`;
  if (t.state === 'overdue') return `Просрочено на ${-t.remainingDays} ${plural(-t.remainingDays, 'день', 'дня', 'дней')}`;
  if (t.state === 'due-today') return 'Срок завершения — сегодня';
  return `Осталось: ${t.remainingDays} ${plural(t.remainingDays, 'день', 'дня', 'дней')}`;
}

function NextPeakCard({ peaks, onChooseFocus }: { peaks: NextPeak[]; onChooseFocus: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedRef = useRef<HTMLButtonElement | null>(null);
  const peak = peaks.find((item) => item.goalId === selectedId) ?? peaks[0] ?? null;
  const selectedGoalId = peak?.goalId;
  useEffect(() => { if (selectedGoalId) selectedRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); }, [selectedGoalId]);
  const items = peak?.stageStatus === 'active' ? peak.time : null;
  const timePercent = items?.state === 'invalid' ? null : items?.percent ?? null;
  const progress = peak?.taskPercent;
  return <section className="next-peak-panel" aria-label="Следующая вершина">
    <header className="next-peak-header"><div className="next-peak-brand"><MountainMark/><div><strong>СЛЕДУЮЩАЯ ВЕРШИНА</strong><span>Главные проекты месяца</span></div></div>
      {peak && <div className="peak-controls">{peaks.length > 1 && <button type="button" aria-label="Предыдущий проект" onClick={() => { const i = peaks.findIndex(p => p.goalId === peak.goalId); setSelectedId(peaks[(i - 1 + peaks.length) % peaks.length].goalId); }}><Arrow direction="left"/></button>}<span>{peaks.findIndex(p => p.goalId === peak.goalId) + 1} / {peaks.length}</span>{peaks.length > 1 && <button type="button" aria-label="Следующий проект" onClick={() => { const i = peaks.findIndex(p => p.goalId === peak.goalId); setSelectedId(peaks[(i + 1) % peaks.length].goalId); }}><Arrow/></button>}</div>}
    </header>
    {!peak ? <div className="peak-empty"><h2>На этот месяц пока нет главных проектов</h2><p>Выбери проект в списке, чтобы добавить его в фокус месяца.</p><button type="button" className="peak-open-button" onClick={onChooseFocus}>Выбрать проекты <Arrow/></button></div> : <>
      <div className="peak-project-hero">
        {peak.goalImage && <img className="peak-project-cover" src={peak.goalImage} alt=""/>}<div className="peak-hero-shade"/>
        <div className="peak-project-copy"><h1>{peak.headline}</h1><p>⌂ <span>Проект: {peak.goalName}</span></p><div className="peak-stage-pill"><span aria-hidden="true">▱</span>Текущий этап: <b>{peak.stageName ?? peak.headline}</b></div></div>
      </div>
      {peak.stageStatus === 'active' ? <>
        <div className="peak-dates-row"><span>▦ {shortDate(peak.startsAt)} – {shortDate(peak.dueAt)}</span><i/><span>◷ {timeText(peak)}</span></div>
        <section className="peak-timeline" aria-label="Прогресс по срокам этапа"><div className="peak-label-row"><strong>Прогресс по срокам этапа</strong>{timePercent !== null && <span>{Math.round(timePercent)}%</span>}</div>
          {timePercent === null ? <p className="peak-muted">{peak.time?.state === 'invalid' ? 'Даты этапа некорректны' : 'Сроки этапа не указаны'}</p> : <><div className="peak-time-track" role="progressbar" aria-label="Прогресс по срокам" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(timePercent)}><span style={{ width: `${timePercent}%` }}/><i style={{ left: `${Math.max(2, Math.min(98, timePercent))}%` }}><b>{Math.round(timePercent)}%</b></i></div><div className="peak-time-captions"><span>{items?.elapsedDays ?? 0} дн. прошло</span><span>{items?.totalDays ?? 0} дн. всего</span></div></>}
        </section>
        <section className="peak-tasks"><div className="peak-label-row"><strong>☑ Выполнение задач этапа</strong>{progress !== null && <span>{peak.done} из {peak.total} задач</span>}</div>
          {progress === null ? <p className="peak-muted">Задачи этапа пока не добавлены</p> : <div className="peak-task-row"><div className="peak-task-track" role="progressbar" aria-label="Выполнение задач этапа" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }}/></div><b>{progress}%</b></div>}
        </section>
      </> : <div className="peak-stage-state">{peak.stageStatus === 'completed' ? 'Все этапы проекта завершены' : peak.stageStatus === 'none' ? 'Этапы пока не добавлены' : 'Сейчас нет доступного этапа. Открой проект, чтобы продолжить.'}</div>}
      <div className="peak-motivation">🏔️ <span>{motivation(peak)}</span></div>
      <a className="peak-open-button" href={`#${goalRoute(peak.goalId, peak.stageId)}`}>{peak.stageStatus === 'active' ? 'Открыть этап' : 'Открыть проект'} <Arrow/></a>
      <div className="peak-projects-label"><span>Главные проекты месяца</span><small>{peaks.length} из {MAX_MONTHLY_FOCUS}</small></div>
      <div className="peak-projects" role="group" aria-label="Переключить главный проект месяца">{peaks.map((item, index) => <button ref={item.goalId === peak.goalId ? selectedRef : null} key={item.goalId} type="button" aria-pressed={item.goalId === peak.goalId} className={`peak-project ${item.goalId === peak.goalId ? 'is-active' : ''}`} onClick={() => setSelectedId(item.goalId)}><b>{index + 1}</b><span className="peak-project-icon">{item.goalImage ? <img src={item.goalImage} alt="" loading="lazy"/> : '◆'}</span><span className="peak-project-name">{item.goalName}</span></button>)}</div>
    </>}
  </section>;
}

export default function HomeBanner({ peaks, demo, onContinue, onNavigate, onChooseFocus, onStart, extra }: {
  peaks: NextPeak[]; demo: boolean; onContinue: () => void; onNavigate: (page: string) => void; onChooseFocus: () => void; onStart: () => void; extra?: ReactNode;
}) {
  return <section className="peak-banner"><NextPeakCard peaks={peaks} onChooseFocus={onChooseFocus}/>
    <nav className="peak-quick-links" aria-label="Разделы приложения">{[['goals','⌂','Проекты'],['tree','◈','Навыки'],['achievements','♜','Достижения'],['profile','♥','Профиль']].map(([page, icon, label])=><button key={page} type="button" onClick={()=>onNavigate(page)}><span>{icon}</span>{label}</button>)}</nav>
    <div className="peak-secondary-actions"><button type="button" onClick={onContinue}>К задачам</button>{demo && <button type="button" onClick={onStart}>Начать свою игру</button>}</div>{extra}
  </section>;
}
