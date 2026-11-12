// Экран этапа проекта. Дизайн перенесён из макета Manus «PLAY YOUR LIFE — этап
// проекта · демо» (10 ноября 2026) на настоящие данные игры: задачи, шаги,
// награды, WOOP, «Если — то» и заметки берутся из сохранения, новых полей нет.
// Пятиминутный старт — только таймер на экране: он ничего не сохраняет и не
// меняет статус задачи.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { GameState, Goal, GoalStage, Quest } from '../game';
import TaskLabelBadge from './TaskLabelBadge';
import './StageScreen.css';

export type StageStop = {
  id: string;
  name: string;
  label: string;
  state: string;
  href: string;
  blocked: string;
};
export type StageDetailKind =
  | 'reward'
  | 'notes'
  | 'stageWhy'
  | 'woop'
  | 'weeklyFocus'
  | 'motivation';
type Props = {
  state: GameState;
  goal: Goal;
  stage: GoalStage;
  stops: StageStop[];
  tasks: Quest[];
  progress: number;
  complete: boolean;
  xp: number;
  coins: number;
  statusLabel: string;
  daysLeft: number | null;
  period: string;
  sphereName: string;
  image: string;
  projectHref: string;
  stageRing: ReactNode;
  projectRing: ReactNode;
  projectTools: ReactNode;
  taskLocked: (task: Quest) => boolean;
  taskDateLine: (task: Quest) => ReactNode;
  onToggleTask: (task: Quest) => void;
  onOpenTask: (task: Quest) => void;
  onReorderTask: (sourceId: string, targetId: string) => void;
  onAddTask: () => void;
  onEditStage: () => void;
  onDetail: (kind: StageDetailKind) => void;
  onNotify: (message: string) => void;
  slots: {
    calendar: ReactNode;
    timeline: ReactNode;
    statistics: ReactNode;
    management: ReactNode;
    rewards: ReactNode;
    woop: ReactNode;
    ifThen: ReactNode;
    history: ReactNode;
  };
};

const ICONS = {
  tasks: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  focus: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  mind: 'M12 3l2.2 5.6L20 11l-5.8 2.4L12 19l-2.2-5.6L4 11l5.8-2.4z',
  chart: 'M5 20V11M12 20V5M19 20v-7',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  calendar: 'M4 9h16M8 3v4M16 3v4M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z',
  clock: 'M12 7v5l3.5 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  flag: 'M6 21V4M6 5h12l-3 4 3 4H6',
  play: 'M8 5.5v13l11-6.5z',
  branch: 'M6 4v16M6 8h6a4 4 0 0 1 4 4v0M6 16h6a4 4 0 0 0 4-4',
  diamond: 'M12 3l9 9-9 9-9-9z',
  heart: 'M12 20s-7-4.4-9-9a4.6 4.6 0 0 1 9-2 4.6 4.6 0 0 1 9 2c-2 4.6-9 9-9 9z',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H4c0 3 1.5 4.5 4 4.5M16 6h4c0 3-1.5 4.5-4 4.5M12 13v4M8.5 20h7',
  pencil: 'M4 20h4L19 9l-4-4L4 16z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  note: 'M5 4h14v11l-5 5H5zM14 20v-5h5',
} as const;
function I({ n, fill = false }: { n: keyof typeof ICONS; fill?: boolean }) {
  return (
    <svg className="ss-i" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={ICONS[n]}
        fill={fill ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const TABS = [
  ['tasks', 'Задачи', 'tasks'],
  ['focus', 'Фокус дня', 'focus'],
  ['psychology', 'Психология', 'mind'],
  ['progress', 'Прогресс', 'chart'],
  ['settings', 'Настройки', 'gear'],
] as const;
type TabId = (typeof TABS)[number][0];
const PRIORITY = { high: 0, normal: 1, low: 2 } as const;
const PRIORITY_LABEL = { high: 'Высокий', normal: 'Средний', low: 'Низкий' } as const;
const plain = (value: string) =>
  value.toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').trim();
const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
const plural = (n: number, one: string, few: string, many: string) => {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11 ? one : d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
};

type Session = {
  taskId: string;
  action: string;
  endsAt: number | null;
  minutes: number;
};

export default function StageScreen(p: Props) {
  const { goal, stage, tasks, slots } = p;
  const [tab, setTab] = useState<TabId>('tasks');
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');
  const [sort, setSort] = useState<'order' | 'priority' | 'due' | 'name'>('order');
  const [query, setQuery] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [left, setLeft] = useState(0);
  const [avail, setAvail] = useState<number | null>(null);
  const sessionDialog = useRef<HTMLDialogElement>(null);

  const index = p.stops.findIndex((s) => s.id === stage.id);
  const done = tasks.filter((q) => q.done).length;
  const active = tasks.filter((q) => !q.done);
  const startable = active.filter((q) => !p.taskLocked(q));
  const nextTask = startable[0];
  const required = tasks.filter((q) => q.required !== false);
  const requiredDone = required.filter((q) => q.done).length;
  const earnedXp = tasks.filter((q) => q.done).reduce((sum, q) => sum + q.xp, 0);
  const rules = goal.ifThenRules ?? [];
  const woopFilled = !!(
    goal.woop &&
    (goal.woop.wish || goal.woop.outcome || goal.woop.obstacle || goal.woop.plan)
  );

  const visible = useMemo(() => {
    const words = plain(query).split(/\s+/).filter(Boolean);
    const list = tasks.filter((q) => {
      if (filter === 'active' && q.done) return false;
      if (filter === 'done' && !q.done) return false;
      if (!words.length) return true;
      const text = plain(
        [q.name, q.notes ?? '', ...(q.subtasks ?? []).map((s) => s.title)].join(' '),
      );
      return words.every((word) => text.includes(word));
    });
    if (sort === 'order') return list;
    return [...list].sort((a, b) =>
      sort === 'priority'
        ? PRIORITY[a.priority ?? 'normal'] - PRIORITY[b.priority ?? 'normal'] ||
          (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999')
        : sort === 'due'
          ? (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999')
          : a.name.localeCompare(b.name, 'ru'),
    );
  }, [tasks, filter, sort, query]);

  useEffect(() => {
    if (session && !sessionDialog.current?.open) sessionDialog.current?.showModal();
  }, [session]);
  useEffect(() => {
    if (!session?.endsAt) return;
    const endsAt = session.endsAt;
    const timer = window.setInterval(
      () => setLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))),
      500,
    );
    return () => window.clearInterval(timer);
  }, [session?.endsAt]);

  function openStart(task?: Quest) {
    const chosen = task && !task.done ? task : nextTask;
    if (!chosen) {
      p.onNotify('На этом этапе нет задач, которые можно начать сейчас.');
      return;
    }
    const step = chosen.subtasks?.find((s) => !s.done)?.title ?? '';
    setSession({ taskId: chosen.id, action: step, endsAt: null, minutes: 5 });
  }
  // Реалистичный план: что из доступных задач помещается в выбранное время.
  const fit: Quest[] = [];
  let fitMinutes = 0;
  if (avail)
    for (const task of startable) {
      const need = task.estimateMinutes ?? 0;
      if (need > 0 && fitMinutes + need <= avail) {
        fit.push(task);
        fitMinutes += need;
      }
    }
  const unestimated = startable.filter((q) => !q.estimateMinutes).length;
  const sessionTask = session ? tasks.find((q) => q.id === session.taskId) : undefined;
  const finished = !!session?.endsAt && left === 0;

  const reorderEnabled = sort === 'order' && filter === 'all' && !query.trim();
  function taskRow(task: Quest) {
    const steps = task.subtasks ?? [];
    const stepsDone = steps.filter((s) => s.done).length;
    const locked = p.taskLocked(task);
    return (
      <article
        className={`ss-task ${task.done ? 'is-done' : ''}${draggedTaskId === task.id ? ' is-dragging' : ''}`}
        key={task.id}
        data-task={task.id}
        onDragOver={(event) => {
          if (reorderEnabled && draggedTaskId && draggedTaskId !== task.id) event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          const sourceId = event.dataTransfer.getData('text/plain') || draggedTaskId;
          if (reorderEnabled && sourceId && sourceId !== task.id) p.onReorderTask(sourceId, task.id);
          setDraggedTaskId('');
        }}
      >
        <div className="ss-task-row">
          {reorderEnabled && (
            <button
              type="button"
              className="ss-drag-handle"
              draggable
              aria-label={`Переместить задачу: ${task.name}`}
              title="Перетащите, чтобы изменить порядок"
              onDragStart={(event) => {
                setDraggedTaskId(task.id);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', task.id);
              }}
              onDragEnd={() => setDraggedTaskId('')}
            >
              ⋮⋮
            </button>
          )}
          <button
            className="ss-check"
            disabled={!task.done && locked}
            aria-label={`${task.done ? 'Отменить выполнение' : 'Выполнить'}: ${task.name}`}
            onClick={() => p.onToggleTask(task)}
          >
            {task.done && <I n="check" />}
          </button>
          <button className="ss-task-main" onClick={() => p.onOpenTask(task)}>
            <strong>{task.name}</strong>
            <TaskLabelBadge labelId={task.labelId} labels={p.state.taskLabels} />
            <small>
              {task.estimateMinutes ? `~ ${task.estimateMinutes} мин · ` : ''}
              {p.taskDateLine(task)}
              {task.required === false ? ' · Необязательная' : ''}
              {task.targetValue && !task.done
                ? ` · ${task.currentValue ?? 0}/${task.targetValue} ${task.unit ?? ''}`
                : ''}
            </small>
          </button>
          <div className="ss-task-side">
            {task.priority && (
              <span className={`ss-pill ss-pill-${task.priority}`}>
                {PRIORITY_LABEL[task.priority]}
              </span>
            )}
            <span className="ss-xp">+{task.xp} XP</span>
            {!task.done && !locked && (
              <button
                className="ss-start"
                aria-label={`Начать 5 минут: ${task.name}`}
                onClick={() => openStart(task)}
              >
                <I n="play" fill />5 минут
              </button>
            )}
          </div>
        </div>
        {steps.length > 0 && (
          <div className="ss-steps">
            <div className="ss-steps-head">
              <span>
                Шаги <b>{stepsDone}/{steps.length}</b>
              </span>
              <span className="ss-steps-bar" aria-hidden="true">
                <i style={{ width: `${(stepsDone / steps.length) * 100}%` }} />
              </span>
            </div>
            <ol>
              {steps.map((step, i) => (
                <li key={step.id} className={step.done ? 'is-done' : ''}>
                  <span className="ss-step-mark" aria-hidden="true">
                    {step.done ? <I n="check" /> : i + 1}
                  </span>
                  {step.title}
                </li>
              ))}
            </ol>
          </div>
        )}
      </article>
    );
  }

  const notesCard = (
    <section className="ss-panel ss-notes">
      <h3>
        <span className="ss-tile ss-tile-slate"><I n="note" /></span>
        Заметки этапа
      </h3>
      <p>
        {stage.notes ||
          'Здесь можно сохранить мысли, ссылки и идеи для этого этапа.'}
      </p>
      <button className="ss-link" onClick={() => p.onDetail('notes')}>
        Редактировать заметки →
      </button>
    </section>
  );
  const startCard = (
    <section className="ss-quick">
      <span className="ss-quick-icon"><I n="play" fill /></span>
      <div>
        <strong>Просто начни</strong>
        <span>
          {nextTask
            ? `Пять минут на «${nextTask.name}»`
            : 'Нет задач, доступных прямо сейчас'}
        </span>
      </div>
      <button className="ss-primary" disabled={!nextTask} onClick={() => openStart()}>
        Начать 5 минут
      </button>
    </section>
  );

  return (
    <div className="ss">
      {/* ---------- Карточка этапа ---------- */}
      <section className="ss-hero" aria-label="Карточка этапа">
        <div className="ss-hero-image">
          <img src={p.image} alt="" />
          <span className="ss-hero-tag">
            <I n="diamond" />
            Этап {index + 1} из {p.stops.length}
          </span>
        </div>
        <div className="ss-hero-tools">
          <button
            className="ss-hero-edit"
            aria-label="Редактировать этап"
            onClick={p.onEditStage}
          >
            <I n="pencil" />
          </button>
          {p.projectTools}
        </div>
        <div className="ss-hero-copy">
          <a className="ss-eyebrow" href={p.projectHref}>
            <i /> {p.sphereName} · {goal.name}
          </a>
          <h2>
            <small>Этап {index + 1}.</small> {stage.name}
          </h2>
          {stage.description && <p>{stage.description}</p>}
          <ul className="ss-meta">
            <li>
              <I n="calendar" />
              {p.period}
            </li>
            <li className={`ss-status ss-status-${p.stops[index]?.state ?? ''}`}>
              <I n="clock" />
              {p.statusLabel}
              {p.daysLeft !== null && !p.complete && (
                <em>
                  {p.daysLeft < 0
                    ? `просрочка ${-p.daysLeft} дн.`
                    : `осталось ${p.daysLeft} дн.`}
                </em>
              )}
            </li>
            <li>
              <I n="tasks" />
              {done} из {tasks.length} {plural(tasks.length, 'задачи', 'задач', 'задач')}
            </li>
          </ul>
        </div>
        <div className="ss-hero-ring">
          {p.stageRing}
          <span>Задачи этапа</span>
        </div>
        <button
          className="ss-reward"
          onClick={() => p.onDetail('reward')}
        >
          <span className="ss-reward-label">
            <I n="trophy" />
            <span>
              Награда за этап
              <b>{p.complete ? 'этап завершён' : 'выдаётся за задачи'}</b>
            </span>
          </span>
          <strong className="ss-reward-xp">{p.xp} XP</strong>
          <strong className="ss-reward-coins">
            <i /> {p.coins} {plural(p.coins, 'лайфкоин', 'лайфкоина', 'лайфкоинов')}
          </strong>
          <span className="ss-reward-note">
            {stage.achievementTitle || 'Подробнее о награде'} →
          </span>
        </button>
      </section>

      {/* ---------- Маршрут проекта ---------- */}
      <nav className="ss-route" aria-label="Маршрут проекта">
        <ol>
          {p.stops.map((stop, i) => {
            const inner = (
              <>
                <span className="ss-stop-mark">
                  {stop.state === 'completed' ? <I n="check" /> : i + 1}
                </span>
                <span className="ss-stop-copy">
                  <small>
                    Этап {i + 1} · {stop.label}
                  </small>
                  <b>{stop.name}</b>
                </span>
              </>
            );
            const cls = `ss-stop ss-stop-${stop.state} ${stop.id === stage.id ? 'is-current' : ''}`;
            return (
              <li key={stop.id}>
                {stop.id === stage.id ? (
                  <span className={cls} aria-current="step">
                    {inner}
                  </span>
                ) : stop.blocked ? (
                  <button
                    className={cls}
                    aria-disabled="true"
                    onClick={() => p.onNotify(stop.blocked)}
                  >
                    {inner}
                  </button>
                ) : (
                  <a className={cls} href={stop.href}>
                    {inner}
                  </a>
                )}
                <i
                  className={`ss-route-line ${i < index || stop.state === 'completed' ? 'is-complete' : ''}`}
                  aria-hidden="true"
                />
              </li>
            );
          })}
          <li>
            <div className="ss-goal">
              {p.projectRing}
              <span className="ss-stop-copy">
                <small>Цель проекта</small>
                <a href={p.projectHref}>Перейти к проекту →</a>
              </span>
            </div>
          </li>
        </ol>
      </nav>

      {/* ---------- Вкладки ---------- */}
      <nav className="gw-tabs ss-tabs" aria-label="Разделы этапа">
        {TABS.map(([id, name, icon]) => (
          <button
            key={id}
            aria-current={tab === id ? 'page' : undefined}
            className={tab === id ? 'selected' : ''}
            onClick={() => setTab(id)}
          >
            <I n={icon} />
            {name}
            {id === 'tasks' && (
              <span className="ss-tab-count" aria-hidden="true">
                {tasks.length}
              </span>
            )}
          </button>
        ))}
      </nav>

      {tab === 'tasks' && (
        <div className="ss-layout">
          <section className="ss-panel ss-task-panel">
            <header className="ss-panel-head">
              <h3>
                Задачи этапа <span>{done} из {tasks.length}</span>
              </h3>
              <div className="ss-filters" role="group" aria-label="Фильтр задач">
                {(
                  [
                    ['all', 'Все', tasks.length],
                    ['active', 'Активные', active.length],
                    ['done', 'Выполненные', done],
                  ] as const
                ).map(([id, name, count]) => (
                  <button
                    key={id}
                    aria-pressed={filter === id}
                    className={filter === id ? 'is-on' : ''}
                    onClick={() => setFilter(id)}
                  >
                    {name} <b>{count}</b>
                  </button>
                ))}
              </div>
            </header>
            {tasks.length > 3 && (
              <div className="ss-discovery">
                <label className="ss-search">
                  <I n="search" />
                  <input
                    type="search"
                    aria-label="Поиск по задачам и шагам"
                    placeholder="Найти задачу или шаг…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
                <select
                  aria-label="Сортировка задач"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as typeof sort)}
                >
                  <option value="order">По порядку</option>
                  <option value="priority">Приоритет</option>
                  <option value="due">Срок</option>
                  <option value="name">Название</option>
                </select>
                <span aria-live="polite">
                  {visible.length} из {tasks.length}
                </span>
              </div>
            )}
            <div className="ss-task-list">
              {visible.map(taskRow)}
              {!visible.length && (
                <p className="ss-empty">
                  {tasks.length
                    ? 'По этому фильтру задач и шагов не найдено.'
                    : 'На этом этапе пока нет задач. Добавьте первую — и этап оживёт.'}
                </p>
              )}
            </div>
            <footer className="ss-panel-foot">
              <button className="ss-secondary" onClick={p.onAddTask}>
                ＋ Добавить задачу
              </button>
              <button className="ss-link" onClick={() => setTab('progress')}>
                Проверить готовность этапа →
              </button>
            </footer>
          </section>
          <aside className="ss-stack">
            {startCard}
            <button className="ss-tool" onClick={() => setTab('psychology')}>
              <span className="ss-tile ss-tile-cyan"><I n="branch" /></span>
              <span>
                <strong>Если — то</strong>
                <small>
                  {rules.length
                    ? `Если ${rules[0].ifText} → ${rules[0].thenText}`
                    : 'План на случай препятствия пока не создан'}
                </small>
              </span>
              <I n="arrow" />
            </button>
            <button className="ss-tool" onClick={() => p.onDetail('stageWhy')}>
              <span className="ss-tile ss-tile-violet"><I n="diamond" /></span>
              <span>
                <strong>Почему важен этот этап</strong>
                <small>{stage.whyImportant || 'Запишите свою причину — она помогает не бросить'}</small>
              </span>
              <I n="arrow" />
            </button>
            <button className="ss-tool" onClick={() => p.onDetail('woop')}>
              <span className="ss-tile ss-tile-violet"><I n="mind" /></span>
              <span>
                <strong>План WOOP</strong>
                <small>
                  {woopFilled
                    ? goal.woop!.wish || 'План заполнен'
                    : 'Желание → результат → препятствие → план'}
                </small>
              </span>
              <I n="arrow" />
            </button>
            {slots.calendar}
            {notesCard}
            {slots.management}
          </aside>
        </div>
      )}

      {tab === 'focus' && (
        <div className="ss-layout">
          <section className="ss-panel ss-focus">
            <span className="ss-kicker">Один следующий шаг</span>
            {nextTask ? (
              <>
                <h3>{nextTask.name}</h3>
                {nextTask.notes && <p>{nextTask.notes}</p>}
                {nextTask.subtasks?.find((s) => !s.done) && (
                  <div className="ss-first-action">
                    <small>Первое действие</small>
                    {nextTask.subtasks.find((s) => !s.done)!.title}
                  </div>
                )}
                <ul className="ss-meta">
                  {!!nextTask.estimateMinutes && (
                    <li>
                      <I n="clock" />~ {nextTask.estimateMinutes} мин
                    </li>
                  )}
                  <li>
                    <I n="calendar" />
                    {p.taskDateLine(nextTask)}
                  </li>
                  <li className="ss-gold">+{nextTask.xp} XP</li>
                </ul>
                <div className="ss-actions">
                  <button className="ss-primary" onClick={() => openStart(nextTask)}>
                    <I n="play" fill />
                    Начать 5 минут
                  </button>
                  <button className="ss-secondary" onClick={() => p.onOpenTask(nextTask)}>
                    Открыть задачу
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>
                  {tasks.length && !active.length
                    ? 'Все задачи этапа выполнены'
                    : 'Сейчас нечего начинать'}
                </h3>
                <p>
                  {tasks.length && !active.length
                    ? 'Проверьте готовность этапа на вкладке «Прогресс».'
                    : 'Добавьте задачу или проверьте даты и условия этапа.'}
                </p>
                <div className="ss-actions">
                  <button className="ss-secondary" onClick={p.onAddTask}>
                    ＋ Добавить задачу
                  </button>
                </div>
              </>
            )}
            {startable.length > 1 && (
              <div className="ss-queue">
                <small>Дальше по этапу</small>
                {startable.slice(1, 4).map((task) => (
                  <button key={task.id} onClick={() => p.onOpenTask(task)}>
                    <span>{task.name}</span>
                    <em>{p.taskDateLine(task)}</em>
                  </button>
                ))}
              </div>
            )}
            {startable.length > 0 && (
              <div className="ss-fit">
                <small>Сколько сейчас есть времени?</small>
                <div className="ss-filters" role="group" aria-label="Доступное время">
                  {[15, 30, 60, 120].map((minutes) => (
                    <button
                      key={minutes}
                      aria-pressed={avail === minutes}
                      className={avail === minutes ? 'is-on' : ''}
                      onClick={() => setAvail(avail === minutes ? null : minutes)}
                    >
                      {minutes < 60 ? `${minutes} мин` : `${minutes / 60} ч`}
                    </button>
                  ))}
                </div>
                {avail !== null && (
                  <>
                    {fit.map((task) => (
                      <button
                        key={task.id}
                        className="ss-fit-row"
                        onClick={() => p.onOpenTask(task)}
                      >
                        <span>{task.name}</span>
                        <em>~ {task.estimateMinutes} мин</em>
                      </button>
                    ))}
                    <p>
                      {fit.length
                        ? `В это время помещается ${fit.length} ${plural(fit.length, 'задача', 'задачи', 'задач')} — около ${fitMinutes} мин. Остальное спокойно подождёт.`
                        : 'Целиком ни одна задача с оценкой не помещается — начните с пяти минут, этого достаточно.'}
                      {unestimated > 0 &&
                        ` Без оценки времени: ${unestimated}.`}
                    </p>
                  </>
                )}
              </div>
            )}
          </section>
          <aside className="ss-stack">
            <button className="ss-tool" onClick={() => p.onDetail('weeklyFocus')}>
              <span className="ss-tile ss-tile-cyan"><I n="focus" /></span>
              <span>
                <strong>Фокус на эту неделю</strong>
                <small>{goal.weeklyFocus || 'На чём сфокусироваться, чтобы продвинуть проект?'}</small>
              </span>
              <I n="pencil" />
            </button>
            <section className="ss-tip">
              <strong>Маленький старт</strong>
              <p>
                Пять минут — способ начать, а не обещание закончить. Таймер не
                меняет статус задачи и нигде не сохраняется.
              </p>
            </section>
            {rules[0] && (
              <section className="ss-tip">
                <strong>Мой план «Если — то»</strong>
                <p>
                  Если {rules[0].ifText} — то {rules[0].thenText}
                </p>
              </section>
            )}
          </aside>
        </div>
      )}

      {tab === 'psychology' && (
        <div className="ss-psych">
          <header className="ss-intro">
            <h3>Психология продуктивности</h3>
            <p>Инструменты, которые помогают начинать, не откладывать и доводить этап до конца.</p>
          </header>
          <div className="ss-psych-grid">
            {startCard}
            <button className="ss-tool" onClick={() => p.onDetail('stageWhy')}>
              <span className="ss-tile ss-tile-violet"><I n="diamond" /></span>
              <span>
                <strong>Почему важен этот этап</strong>
                <small>{stage.whyImportant || 'Почему именно этот этап важен сейчас?'}</small>
              </span>
              <I n="pencil" />
            </button>
            <button className="ss-tool" onClick={() => p.onDetail('motivation')}>
              <span className="ss-tile ss-tile-rose"><I n="heart" /></span>
              <span>
                <strong>Зачем мне этот проект</strong>
                <small>{goal.motivation || 'Добавьте свою причину — она поможет двигаться.'}</small>
              </span>
              <I n="pencil" />
            </button>
          </div>
          <div className="ss-layout ss-layout-even">
            {slots.ifThen}
            {slots.woop}
          </div>
        </div>
      )}

      {tab === 'progress' && (
        <div className="ss-progress">
          <div className="ss-metrics">
            <div>
              <span>Задачи выполнены</span>
              <strong className="ss-cyan">{done} / {tasks.length}</strong>
            </div>
            <div>
              <span>Прогресс этапа</span>
              <strong>{Math.round(p.progress)}%</strong>
            </div>
            <div>
              <span>{p.daysLeft !== null && p.daysLeft < 0 ? 'Просрочка' : 'Осталось дней'}</span>
              <strong>{p.daysLeft === null ? '—' : Math.abs(p.daysLeft)}</strong>
            </div>
            <div>
              <span>Получено XP</span>
              <strong className="ss-gold">{earnedXp} / {p.xp}</strong>
            </div>
          </div>
          <div className="ss-layout ss-layout-even">
            <section className="ss-panel">
              <h3>Задачи этапа</h3>
              <div
                className="ss-track"
                role="progressbar"
                aria-label="Доля выполненных задач"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(p.progress)}
              >
                <i style={{ width: `${p.progress}%` }} />
              </div>
              <ul className="ss-states">
                {tasks.map((task) => (
                  <li key={task.id} className={task.done ? 'is-done' : ''}>
                    <span>{task.name}</span>
                    <em>{task.done ? 'Выполнена' : 'Активна'}</em>
                  </li>
                ))}
                {!tasks.length && <li><span>Задач пока нет.</span></li>}
              </ul>
            </section>
            <section className="ss-panel ss-ready">
              <h3>
                <span className="ss-tile ss-tile-gold"><I n="flag" /></span>
                Готовность этапа
              </h3>
              <ul className="ss-criteria">
                <li className={required.length > 0 && requiredDone === required.length ? 'is-done' : ''}>
                  <span className="ss-step-mark" aria-hidden="true">
                    {required.length > 0 && requiredDone === required.length ? <I n="check" /> : ''}
                  </span>
                  Обязательные задачи: {requiredDone} из {required.length}
                </li>
                {stage.completionCondition && (
                  <li className={p.complete ? 'is-done' : ''}>
                    <span className="ss-step-mark" aria-hidden="true">
                      {p.complete ? <I n="check" /> : ''}
                    </span>
                    {stage.completionCondition}
                  </li>
                )}
              </ul>
              <p className={`ss-verdict ${p.complete ? 'is-ready' : ''}`}>
                {p.complete
                  ? 'Этап завершён. Награды за задачи уже учтены.'
                  : stage.completionMode === 'manual'
                    ? 'Этап завершается вручную — кнопка «Завершить этап» на вкладке «Настройки».'
                    : 'Этап завершится сам, когда будут выполнены все обязательные задачи.'}
              </p>
              {!stage.completionCondition && (
                <button className="ss-link" onClick={p.onEditStage}>
                  Добавить условие завершения →
                </button>
              )}
            </section>
          </div>
          {slots.timeline}
          {slots.statistics}
          {slots.history}
        </div>
      )}

      {tab === 'settings' && (
        <div className="ss-layout ss-layout-even">
          {slots.management}
          <div className="ss-stack">
            {notesCard}
            {slots.rewards}
          </div>
        </div>
      )}

      {session && (
        <dialog
          ref={sessionDialog}
          className="ss-session"
          aria-label="Пятиминутный старт"
          onClose={() => setSession(null)}
        >
          {!session.endsAt ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setLeft(session.minutes * 60);
                setSession({ ...session, endsAt: Date.now() + session.minutes * 60000 });
              }}
            >
              <h3>Просто начни</h3>
              <p>Выбери задачу и назови самое маленькое первое действие.</p>
              <label>
                Задача этапа
                <select
                  value={session.taskId}
                  onChange={(e) => setSession({ ...session, taskId: e.target.value })}
                >
                  {startable.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Моё первое действие
                <input
                  type="text"
                  maxLength={160}
                  placeholder="Например: открыть план и отметить розетки"
                  value={session.action}
                  onChange={(e) => setSession({ ...session, action: e.target.value })}
                />
              </label>
              <small>Таймер не меняет статус задачи и не сохраняется.</small>
              <div className="ss-actions">
                <button type="button" className="ss-secondary" onClick={() => sessionDialog.current?.close()}>
                  Отмена
                </button>
                <button type="submit" className="ss-primary">
                  Запустить 5 минут →
                </button>
              </div>
            </form>
          ) : (
            <div>
              <h3>{finished ? 'Время вышло — первый шаг сделан' : 'Время на первый шаг'}</h3>
              <div
                className={`ss-clock ${finished ? 'is-finished' : ''}`}
                style={{ '--ss-left': `${(left / (session.minutes * 60)) * 100}%` } as CSSProperties}
                role="timer"
                aria-label={`Осталось ${clock(left)}`}
              >
                <strong>{clock(left)}</strong>
              </div>
              <p>
                <b>{sessionTask?.name}</b>
                {session.action && <span>{session.action}</span>}
              </p>
              <div className="ss-actions">
                {finished && (
                  <button
                    className="ss-secondary"
                    onClick={() => {
                      setLeft(300);
                      setSession({ ...session, minutes: 5, endsAt: Date.now() + 300000 });
                    }}
                  >
                    Ещё 5 минут
                  </button>
                )}
                {sessionTask && (
                  <button
                    className="ss-secondary"
                    onClick={() => {
                      sessionDialog.current?.close();
                      p.onOpenTask(sessionTask);
                    }}
                  >
                    Открыть задачу
                  </button>
                )}
                <button className="ss-primary" onClick={() => sessionDialog.current?.close()}>
                  {finished ? 'Готово' : 'Завершить'}
                </button>
              </div>
            </div>
          )}
        </dialog>
      )}
    </div>
  );
}
