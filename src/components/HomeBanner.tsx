import { useState } from 'react';
import type { CSSProperties } from 'react';
import renovationFallback from '../assets/project-renovation-reference.png';
import { goalRoute } from '../goalRoutes';
import type { NextPeak, TimeProgress } from '../nextPeak';
import { MAX_MONTHLY_FOCUS } from '../monthlyFocus';
import './HomeBanner.css';

function pluralDays(value: number) {
  const n = Math.abs(value), mod10 = n % 10, mod100 = n % 100;
  return mod10 === 1 && mod100 !== 11 ? 'день' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'дня' : 'дней';
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

function timeCaption(time: TimeProgress) {
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
  if (peak.time?.state === 'overdue') return 'Срок этапа прошёл. Проверь оставшиеся задачи.';
  if (peak.time?.state === 'before') return 'Следующая вершина уже близко!';
  if (peak.total === 0) return 'Добавь задачи этапа, чтобы видеть свой прогресс.';
  if (peak.done === peak.total) return 'Все задачи этапа выполнены!';
  const percent = peak.taskPercent ?? 0;
  if (percent >= 75) return 'До вершины осталось немного!';
  if (percent >= 50) return 'Ты уверенно движешься к цели!';
  if (percent >= 25) return 'Продолжай движение к цели!';
  return 'Первые шаги к вершине!';
}

function MountainMark() {
  return <svg className="peak-mountain-mark" viewBox="0 0 100 78" aria-hidden="true">
    <path d="M2 68 31 29l14 18 14-22 38 43H2Z" fill="#ffd05a" />
    <path d="m12 68 20-26 8 10-12 16Zm27 0 19-32 12 18-10-7-8 9 13 12Z" fill="#fff0b1" />
    <path d="M59 25V4" fill="none" stroke="#fff0b1" strokeWidth="3" strokeLinecap="round" />
    <path d="M60 5c11-3 15 5 25 2l-5 10c-8 2-12-6-20-2Z" fill="#ffd05a" />
  </svg>;
}

function ProjectCover({ peak }: { peak: NextPeak | null }) {
  return <div className="peak-project-cover" aria-hidden="true">
    <img key={peak?.goalId ?? 'no-project'} src={peak?.goalImage || renovationFallback} alt="" />
    <div className="peak-cover-shade" />
  </div>;
}

function MainProjectCard({ peaks, onChooseFocus }: { peaks: NextPeak[]; onChooseFocus: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const peak = peaks.find(item => item.goalId === selectedId) ?? peaks[0] ?? null;
  const currentIndex = Math.max(0, peaks.findIndex(item => item.goalId === peak?.goalId));
  const selectAt = (index: number) => {
    if (peaks.length) setSelectedId(peaks[(index + peaks.length) % peaks.length].goalId);
  };
  const taskPercent = peak?.taskPercent ?? (peak?.stageStatus === 'completed' ? 100 : null);
  const timePercent = peak?.time?.percent ?? null;
  const timeLabel = peak?.time ? timeCaption(peak.time) : 'Сроки этапа не указаны';
  const startLabel = formatDate(peak?.startsAt);
  const dueLabel = formatDate(peak?.dueAt, true);
  const taskBarStyle = { '--peak-progress': `${taskPercent ?? 0}%` } as CSSProperties;
  const timeBarStyle = { '--peak-progress': `${timePercent ?? 0}%`, '--peak-marker': `${Math.min(96, Math.max(4, timePercent ?? 0))}%` } as CSSProperties;

  return <section className="peak-panel" aria-label="Следующая вершина">
    <ProjectCover peak={peak} />
    <div className="peak-panel-inner">
      <header className="peak-topline">
        <div className="peak-brand-lockup"><MountainMark /><div><h2>Следующая вершина</h2><p>Главные проекты месяца</p></div></div>
        <div className="peak-carousel" role="group" aria-label="Переключение проектов">
          <button type="button" aria-label="Предыдущий проект" disabled={peaks.length < 2} onClick={() => selectAt(currentIndex - 1)}>‹</button>
          <span aria-live="polite">{peaks.length ? `${currentIndex + 1} / ${peaks.length}` : `0 / ${MAX_MONTHLY_FOCUS}`}</span>
          <button type="button" aria-label="Следующий проект" disabled={peaks.length < 2} onClick={() => selectAt(currentIndex + 1)}>›</button>
        </div>
      </header>

      {peak ? <>
        <div className="peak-primary">
          <h1>{peak.headline}</h1>
          <p className="peak-project-name"><span aria-hidden="true">⌂</span> Проект: {cleanGoalName(peak.goalName)}</p>
          <div className="peak-current-stage"><span aria-hidden="true">▰</span><span>Текущий этап:</span><strong>{peak.stageStatus === 'active' ? peak.stageName || peak.headline : peak.stageStatus === 'completed' ? 'Все этапы завершены' : peak.stageStatus === 'none' ? 'Этапы пока не добавлены' : 'Нет доступного активного этапа'}</strong></div>
        </div>

        <div className="peak-date-row">
          <span className="peak-date-icon" aria-hidden="true">▦</span>
          <span className="peak-date-range">{startLabel && dueLabel ? <>{startLabel} — <strong>{dueLabel}</strong></> : 'Сроки этапа не указаны'}</span>
          <span className="peak-date-divider" />
          <span className="peak-clock-icon" aria-hidden="true">◷</span>
          <span>{peak.time ? timeLabel : 'Добавь даты этапа'}</span>
        </div>

        <section className="peak-time-section" aria-label="Прогресс по срокам этапа">
          <h3><span aria-hidden="true">▦</span> Прогресс по срокам этапа</h3>
          {peak.time && peak.time.state !== 'invalid' ? <>
            <div className="peak-time-track" style={timeBarStyle} role="progressbar" aria-label="Прошедшая доля срока этапа" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(timePercent ?? 0)}>
              <span className="peak-time-fill" /><span className="peak-time-marker"><b>{Math.round(timePercent ?? 0)}%</b></span>
            </div>
            <div className="peak-time-labels"><span>{startLabel || 'Старт'}<small>Старт</small></span><span>Прошло: {peak.time.elapsedDays} {pluralDays(peak.time.elapsedDays)}</span><span>{dueLabel || 'Завершение'}<small>Завершение</small></span></div>
          </> : <p className="peak-neutral-line">{peak.time ? 'Даты этапа указаны некорректно' : 'Укажи даты начала и завершения этапа в настройках проекта.'}</p>}
        </section>

        <section className="peak-task-section" aria-label="Выполнение задач этапа">
          <h3><span aria-hidden="true">☑</span> Выполнение задач этапа</h3>
          <p>{peak.total > 0 ? <>Выполнено: <strong>{peak.done} из {peak.total} задач</strong></> : peak.stageStatus === 'completed' ? 'Все этапы проекта завершены' : 'Задачи этапа пока не добавлены'}</p>
          <div className="peak-task-progress-row"><div className="peak-task-track" style={taskBarStyle} role="progressbar" aria-label="Выполнение задач этапа" aria-valuemin={0} aria-valuemax={100} aria-valuenow={taskPercent ?? undefined} aria-valuetext={taskPercent === null ? 'Задачи этапа пока не добавлены' : `${taskPercent}%`}><span /></div><strong>{taskPercent === null ? '—' : `${taskPercent}%`}</strong></div>
        </section>

        <div className="peak-encouragement"><MountainMark /><span>{encouragement(peak)}</span></div>
        <a className="peak-open-stage" href={`#${goalRoute(peak.goalId, peak.stageId)}`}>{peak.stageStatus === 'active' ? 'Открыть этап' : 'Открыть проект'} <span aria-hidden="true">›</span></a>
      </> : <div className="peak-empty-state"><h1>На этот месяц пока нет главных проектов</h1><p>Выбери проект, к которому хочешь двигаться дальше.</p><button type="button" className="peak-open-stage" onClick={onChooseFocus}>Выбрать проект <span aria-hidden="true">›</span></button></div>}

      {peaks.length > 0 && <nav className="peak-projects" aria-label="Главные проекты месяца">{Array.from({ length: MAX_MONTHLY_FOCUS }, (_, index) => {
        const item = peaks[index];
        return item ? <button key={item.goalId} type="button" className={peak?.goalId === item.goalId ? 'is-active' : ''} aria-pressed={peak?.goalId === item.goalId} aria-label={`Проект ${index + 1}: ${cleanGoalName(item.goalName)}`} onClick={() => setSelectedId(item.goalId)}><b>{index + 1}</b><span className="peak-project-emoji">{item.goalName.match(/^\s*(\p{Extended_Pictographic}\uFE0F?)/u)?.[1] || '◆'}</span><span className="peak-project-title">{cleanGoalName(item.goalName)}</span></button> : <button key={`empty-${index}`} type="button" className="is-empty" aria-label={`Добавить главный проект ${index + 1}`} onClick={onChooseFocus}><b>{index + 1}</b><span className="peak-project-title">＋ Добавить проект</span></button>;
      })}</nav>}
      {peaks.length === 0 && <div className="peak-empty-projects"><button type="button" onClick={onChooseFocus}>＋ Выбрать главные проекты месяца</button></div>}
    </div>
  </section>;
}

export default function HomeBanner({ peaks, onChooseFocus }: { peaks: NextPeak[]; onChooseFocus: () => void }) {
  return <div className="peak-banner"><MainProjectCard peaks={peaks} onChooseFocus={onChooseFocus} /></div>;
}
