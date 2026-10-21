import { useMemo, useState } from 'react';
import type { CSSProperties, DragEvent } from 'react';
import { spheres } from '../game';
import type { Quest } from '../game';
import {
  calendarDays,
  calendarItems,
  calendarViews,
  daySummary,
  itemsForDay,
  minutesOf,
  minutesUntil,
  nextItem,
  parseDay,
  questReward,
  shiftAnchor,
  weekLoad,
} from '../tasksCalendar';
import type { CalendarItem, CalendarView } from '../tasksCalendar';
import './TasksCalendar.css';

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const monthGenitive = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const firstHour = 8;
const lastHour = 23;
const hourHeight = 48;

const sphereOf = (id: string) => spheres.find((s) => s.id === id);
const colorOf = (quest: Quest) => sphereOf(quest.sphere)?.color ?? '#6aa6ff';
const longDate = (key: string) => {
  const date = parseDay(key);
  return `${date.getDate()} ${monthGenitive[date.getMonth()]}`;
};

function Chip({ item, selected, onPick, label, onDragStart, onDragEnd, dragging }: { item: CalendarItem; selected: boolean; onPick: () => void; label?: string; onDragStart: (e: DragEvent) => void; onDragEnd: () => void; dragging: boolean }) {
  const { quest } = item;
  // Перенос связанных с TickTick задач тоже разрешён: новая дата уходит туда обычным обменом.
  const movable = !quest.done;
  return (
    <button
      type="button"
      className={`tcal-chip${quest.done ? ' is-done' : ''}${selected ? ' is-selected' : ''}${dragging ? ' is-dragging' : ''}`}
      style={{ '--c': colorOf(quest) } as CSSProperties}
      onClick={onPick}
      draggable={movable}
      onDragStart={movable ? onDragStart : undefined}
      onDragEnd={onDragEnd}
      title={`${quest.name}${quest.tickTickSharedAt ? ' · перенос уйдёт в TickTick' : ''}`}
    >
      {label ?? `${item.start ? `${item.start} ` : ''}${quest.tickTickSharedAt ? '⟳ ' : ''}${quest.name}`}
    </button>
  );
}

/** Календарь задач: день, неделя, две недели и месяц. Нажатие на число в сетке разворачивает день, колесо мыши листает задачи. */
export default function TasksCalendar({
  quests,
  today,
  onOpen,
  onMove,
}: {
  quests: Quest[];
  today: string;
  onOpen: (quest: Quest) => void;
  /** Перенос задачи на другой день перетаскиванием: столько дней сдвинуть срок. */
  onMove?: (quest: Quest, days: number) => void;
}) {
  const [view, setView] = useState<CalendarView>('month');
  const [anchor, setAnchor] = useState(today);
  const [focus, setFocus] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [draggedId, setDraggedId] = useState('');
  const [overDay, setOverDay] = useState('');
  const items = useMemo(() => calendarItems(quests), [quests]);
  const startDrag = (item: CalendarItem) => (e: DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.quest.id);
    setDraggedId(item.quest.id);
  };
  const endDrag = () => {
    setDraggedId('');
    setOverDay('');
  };
  const allowDrop = (day: string) => (e: DragEvent) => {
    if (!draggedId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (overDay !== day) setOverDay(day);
  };
  const dropOnDay = (day: string) => (e: DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedId;
    endDrag();
    const item = items.find((x) => x.quest.id === id);
    if (!item || item.day === day || !onMove) return;
    const days = Math.round((parseDay(day).getTime() - parseDay(item.day).getTime()) / 86400000);
    if (days) onMove(item.quest, days);
  };
  const days = calendarDays(view, anchor);
  const anchorDate = parseDay(anchor);
  const now = new Date(`${today}T${new Date().toTimeString().slice(0, 5)}:00`);
  const summary = daySummary(items, today);
  const upcoming = nextItem(items, now);
  const load = weekLoad(items, today);
  const maxLoad = Math.max(1, ...load.map((x) => x.count));
  const selected = items.find((item) => item.quest.id === selectedId);
  const grid = view === 'month' || view === 'twoWeeks';
  const limit = view === 'month' ? 3 : 7;
  const ringLength = 2 * Math.PI * 42;
  const until = upcoming ? minutesUntil(upcoming, now) : undefined;
  const upcomingWhen = upcoming
    ? upcoming.day === today
      ? upcoming.start
        ? `${upcoming.start}${until !== undefined ? ` · через ${Math.floor(until / 60)} ч ${until % 60} мин` : ''}`
        : 'сегодня, весь день'
      : `${longDate(upcoming.day)}${upcoming.start ? `, ${upcoming.start}` : ''}`
    : '';

  const rangeNote = view === 'day' ? 'День' : view === 'week' ? 'Неделя' : view === 'twoWeeks' ? 'Две недели' : 'Месяц';
  const changeView = (next: CalendarView) => {
    setView(next);
    setFocus('');
  };
  const move = (direction: 1 | -1) => {
    setAnchor(shiftAnchor(view, anchor, direction));
    setFocus('');
  };

  const dayNumber = (day: string) => {
    const date = parseDay(day);
    return date.getDate() === 1 ? `${date.getDate()} ${monthGenitive[date.getMonth()].slice(0, 3)}` : String(date.getDate());
  };

  return (
    <section className="tcal" aria-label="Календарь задач">
      <div className="tcal-toolbar">
        <div className="tcal-title">
          <h2>{monthNames[anchorDate.getMonth()]} {anchorDate.getFullYear()}</h2>
          <span>{rangeNote} · {longDate(today)}</span>
        </div>
        <div className="tcal-controls">
          <div className="tcal-seg" role="group" aria-label="Вид календаря">
            {calendarViews.map((item) => (
              <button key={item.id} type="button" aria-pressed={view === item.id} onClick={() => changeView(item.id)}>{item.label}</button>
            ))}
          </div>
          <div className="tcal-seg tcal-nav">
            <button type="button" aria-label="Назад" onClick={() => move(-1)}>‹</button>
            <button type="button" onClick={() => { setAnchor(today); setFocus(''); }}>Сегодня</button>
            <button type="button" aria-label="Вперёд" onClick={() => move(1)}>›</button>
          </div>
        </div>
      </div>

      <div className="tcal-insights">
        <div className="tcal-card tcal-today">
          <svg viewBox="0 0 100 100" width="84" height="84" role="img" aria-label={`Выполнено ${summary.done} из ${summary.count}`}>
            <defs>
              <linearGradient id="tcal-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#fbd36b" />
                <stop offset="1" stopColor="#ff9f5a" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="42" className="tcal-ring-track" />
            <circle cx="50" cy="50" r="42" className="tcal-ring" stroke="url(#tcal-ring)" strokeDasharray={`${(ringLength * summary.percent) / 100} ${ringLength}`} transform="rotate(-90 50 50)" />
            <text x="50" y="56" textAnchor="middle">{summary.percent}%</text>
          </svg>
          <div>
            <small>Сегодня</small>
            <strong>{summary.count} {summary.count === 1 ? 'задача' : summary.count > 1 && summary.count < 5 ? 'задачи' : 'задач'}</strong>
            <span>{summary.earned} из {summary.plan} XP</span>
          </div>
        </div>
        <div className="tcal-card">
          <small>Дальше</small>
          {upcoming ? (
            <>
              <strong>{upcoming.quest.name}</strong>
              <span className="tcal-when"><i style={{ background: colorOf(upcoming.quest) }} />{upcomingWhen}</span>
            </>
          ) : (
            <strong>Свободно</strong>
          )}
        </div>
        <div className="tcal-card">
          <small>Нагрузка недели</small>
          <div className="tcal-load" role="img" aria-label="Задач по дням недели">
            {load.map((x, i) => (
              <div key={x.day} className={x.day === today ? 'is-today' : ''}>
                <i style={{ height: `${8 + Math.round((x.count / maxLoad) * 44)}px` }} />
                <span>{weekdays[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="tcal-legend">
        {spheres.map((s) => (<span key={s.id}><i style={{ background: s.color }} />{s.name}</span>))}
        <span className="tcal-sync">⟳ из TickTick</span>
      </div>

      <div className="tcal-panel">
        {grid ? (
          <>
            <div className="tcal-weekdays">{weekdays.map((w) => (<div key={w}>{w}</div>))}</div>
            <div className="tcal-grid">
              {days.map((day) => {
                const list = itemsForDay(items, day);
                const focused = focus === day;
                const date = parseDay(day);
                const other = view === 'month' && date.getMonth() !== anchorDate.getMonth();
                const shown = focused ? list : list.slice(0, limit);
                return (
                  <div
                    key={day}
                    className={`tcal-cell${day === today ? ' is-today' : ''}${focused ? ' is-focus' : ''}${other ? ' is-other' : ''}${((date.getDay() + 6) % 7) > 4 ? ' is-weekend' : ''}${overDay === day ? ' is-drop' : ''}`}
                    onDragOver={allowDrop(day)}
                    onDragLeave={() => setOverDay((d) => (d === day ? '' : d))}
                    onDrop={dropOnDay(day)}
                  >
                    <button
                      type="button"
                      className="tcal-num"
                      aria-pressed={focused}
                      aria-label={`${focused ? 'Свернуть' : 'Развернуть'} день ${longDate(day)}`}
                      onClick={() => setFocus(focused ? '' : day)}
                    >
                      {dayNumber(day)}
                    </button>
                    <div className={`tcal-list${focused ? ' is-scroll' : ''}${view === 'twoWeeks' ? ' is-tall' : ''}`}>
                      {shown.map((item) => (
                        <Chip key={item.quest.id} item={item} selected={selectedId === item.quest.id} onPick={() => setSelectedId(item.quest.id)} onDragStart={startDrag(item)} onDragEnd={endDrag} dragging={draggedId === item.quest.id} />
                      ))}
                    </div>
                    {!focused && list.length > limit && <span className="tcal-more">ещё {list.length - limit}</span>}
                    {focused && <span className="tcal-hint">Колесо мыши листает · нажмите на число, чтобы выйти</span>}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="tcal-timed-wrap">
            <div className="tcal-timed" style={{ ['--cols' as string]: days.length, minWidth: days.length > 1 ? 720 : 360 }}>
              <div className="tcal-timed-head">
                <div />
                {days.map((day) => {
                  const date = parseDay(day);
                  return (
                    <div key={day} className={day === today ? 'is-today' : ''}>
                      <small>{weekdays[(date.getDay() + 6) % 7]}</small>
                      <b>{date.getDate()}</b>
                    </div>
                  );
                })}
              </div>
              <div className="tcal-allday">
                <small>весь день</small>
                {days.map((day) => (
                  <div key={day} className={overDay === day ? 'is-drop' : ''} onDragOver={allowDrop(day)} onDragLeave={() => setOverDay((d) => (d === day ? '' : d))} onDrop={dropOnDay(day)}>
                    {itemsForDay(items, day).filter((item) => !item.start).map((item) => (
                      <Chip key={item.quest.id} item={item} selected={selectedId === item.quest.id} onPick={() => setSelectedId(item.quest.id)} label={`${item.quest.tickTickSharedAt ? '⟳ ' : ''}${item.quest.name}`} onDragStart={startDrag(item)} onDragEnd={endDrag} dragging={draggedId === item.quest.id} />
                    ))}
                  </div>
                ))}
              </div>
              <div className="tcal-hours" style={{ height: (lastHour - firstHour) * hourHeight }}>
                <div className="tcal-hour-labels">
                  {Array.from({ length: lastHour - firstHour }, (_, i) => (
                    <span key={i} style={{ top: i * hourHeight - 7 }}>{String(firstHour + i).padStart(2, '0')}:00</span>
                  ))}
                </div>
                {days.map((day) => (
                  <div
                    key={day}
                    className={`tcal-col${day === today ? ' is-today' : ''}${overDay === day ? ' is-drop' : ''}`}
                    onDragOver={allowDrop(day)}
                    onDragLeave={() => setOverDay((d) => (d === day ? '' : d))}
                    onDrop={dropOnDay(day)}
                  >
                    {itemsForDay(items, day).filter((item) => item.start && item.end).map((item) => {
                      const top = ((minutesOf(item.start!) - firstHour * 60) / 60) * hourHeight + 1;
                      const height = Math.max(26, ((minutesOf(item.end!) - minutesOf(item.start!)) / 60) * hourHeight - 3);
                      const movable = !item.quest.done;
                      return (
                        <button
                          key={item.quest.id}
                          type="button"
                          className={`tcal-event${item.quest.done ? ' is-done' : ''}${selectedId === item.quest.id ? ' is-selected' : ''}${draggedId === item.quest.id ? ' is-dragging' : ''}`}
                          style={{ '--c': colorOf(item.quest), top, height } as CSSProperties}
                          onClick={() => setSelectedId(item.quest.id)}
                          draggable={movable}
                          onDragStart={movable ? startDrag(item) : undefined}
                          onDragEnd={endDrag}
                          title={item.quest.tickTickSharedAt ? 'Перенос уйдёт в TickTick' : undefined}
                        >
                          <b>{item.quest.name}</b>
                          <span>{item.start} – {item.end}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {selected ? (
        <div className="tcal-detail" style={{ '--c': colorOf(selected.quest) } as CSSProperties}>
          <span className="tcal-detail-bar" />
          <div>
            <strong>{selected.quest.name}</strong>
            <span>{longDate(selected.day)}{selected.start ? `, ${selected.start}–${selected.end}` : ', весь день'} · {sphereOf(selected.quest.sphere)?.name ?? 'Сфера'} · {selected.quest.tickTickSharedAt ? 'TickTick' : 'только в игре'}</span>
          </div>
          <b>+{questReward(selected.quest)} XP</b>
          <button type="button" onClick={() => onOpen(selected.quest)}>Открыть задачу</button>
        </div>
      ) : (
        <p className="tcal-empty">{items.length ? 'Нажмите на задачу, чтобы увидеть подробности.' : 'В календаре пока нет задач со сроком. Добавьте срок задаче, и она появится здесь.'}</p>
      )}
    </section>
  );
}
