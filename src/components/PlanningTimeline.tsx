import { Fragment, useState } from 'react';
import type { CSSProperties, DragEvent } from 'react';
import type { GameState, Quest } from '../game';
import { dayDistance, timelineDays, timelinePlacement, timelineRows } from '../planningTimeline';
import { planningDay } from '../planningData';
import { dependencyBlockers, dependentTasks } from '../taskDependencies';
import './PlanningTimeline.css';
import { goalRoute } from '../goalRoutes';

const short = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
export default function PlanningTimeline({ state, quests, start, end, onOpen, onShift }: {
  state: GameState; quests: Quest[]; start: string; end: string; onOpen: (id: string) => void; onShift: (q: Quest, days: number) => void;
}) {
  const [dragged, setDragged] = useState('');
  const days = timelineDays(start, end), rows = timelineRows(state, quests);
  function drop(event: DragEvent, day: string) {
    event.preventDefault();
    const q = quests.find((q) => q.id === dragged && q.id === event.dataTransfer.getData('text/plain'));
    setDragged('');
    if (!q || q.done || q.planning?.archivedAt) return;
    const from = planningDay(q.startsAt ?? q.dueAt);
    const shift = from ? dayDistance(from, day) : 0;
    if (shift) onShift(q, shift);
  }
  return <section aria-label="Шкала сроков" className="ptimeline">
    <p>Задачи и этапы · {short(start)} — {short(end)}. Открой полосу для редактирования. Перетащи задачу на дату в шапке или используй стрелки.</p>
    <p>Зависимости блокируют выполнение. Перенос предшественника не меняет даты зависимых задач автоматически.</p>
    <div className="ptimeline-scroll" tabIndex={0} role="region" aria-label="Таблица сроков с горизонтальной прокруткой">
      <div className="ptimeline-grid" style={{ gridTemplateColumns: `200px repeat(${days.length}, 34px)` } as CSSProperties}>
        <strong className="ptimeline-heading">Задача / этап</strong>
        {days.map((d) => <div key={d} className={`ptimeline-day${dragged ? ' is-drop-target' : ''}`} onDragOver={(e) => dragged && e.preventDefault()} onDrop={(e) => drop(e, d)}>{short(d)}</div>)}
        {rows.map((row, i) => {
          const pos = timelinePlacement(start, end, row.from, row.to);
          const q = row.task, blockers = q ? dependencyBlockers(state.quests, q) : [];
          const children = q ? dependentTasks(state.quests, q.id) : [];
          const movable = !!q && !q.done && !q.wontDo && !q.planning?.archivedAt && !!planningDay(q.dueAt ?? q.startsAt);
          return <Fragment key={row.id}>
            <div className={`ptimeline-label${row.kind === 'stage' ? ' is-stage' : ''}`} style={{ gridRow: i + 2, gridColumn: 1 }}>
              {q ? <button type="button" onClick={() => onOpen(q.id)}>{row.title}</button> : <a href={`#${goalRoute(row.projectId!, row.stageId)}`}>Этап: {row.title}</a>}
              {row.projectName && <small>{row.projectName}</small>}
              {!!q?.planning?.dependencyIds?.length && <small>После: {q.planning.dependencyIds.map((id) => { const dep = state.quests.find((t) => t.id === id); return dep ? <button key={id} type="button" className="text-button" onClick={() => onOpen(id)}>{dep.done ? "✓ " : ""}{dep.name}</button> : <span key={id}>Удалённая задача ({id})</span>; })}</small>}
              {blockers.length > 0 && <small>Блокирует: {blockers.map((b) => b.name).join(', ')}</small>}
              {children.length > 0 && <small>Зависимых задач: {children.length}</small>}
              {movable && <div className="ptimeline-controls"><button type="button" aria-label={`На день раньше: ${row.title}`} onClick={() => onShift(q!, -1)}>←</button><button type="button" aria-label={`На день позже: ${row.title}`} onClick={() => onShift(q!, 1)}>→</button></div>}
            </div>
            <div className="ptimeline-track" style={{ gridRow: i + 2, gridColumn: `2 / span ${days.length}` }} />
            {pos && pos.span > 0 ? q ? <button type="button" className={`ptimeline-bar${q.done ? ' is-done' : ''}${blockers.length ? ' is-blocked' : ''}`}
              style={{ gridRow: i + 2, gridColumn: `${pos.offset + 2} / span ${pos.span}` }}
              aria-label={`Сроки: ${row.title}`} title={`${row.title}: ${planningDay(row.from)} — ${planningDay(row.to)} · ${row.progress}%`}
              onClick={() => onOpen(q.id)} draggable={movable} onDragStart={(e) => { setDragged(q.id); e.dataTransfer.setData('text/plain', q.id); }} onDragEnd={() => setDragged('')}>{row.progress}%</button>
              : <div className="ptimeline-bar is-stage" style={{ gridRow: i + 2, gridColumn: `${pos.offset + 2} / span ${pos.span}` }}>{Math.round(row.progress)}%</div>
              : <span className="ptimeline-empty" style={{ gridRow: i + 2, gridColumn: `2 / span ${days.length}` }}>{pos && 'invalid' in pos ? 'Проверь интервал' : pos ? 'Вне периода' : 'Без даты'}</span>}
          </Fragment>;
        })}
      </div>
    </div>
    {!rows.length && <p>Нет задач для шкалы. Добавь задачи или измени фильтр.</p>}
  </section>;
}
