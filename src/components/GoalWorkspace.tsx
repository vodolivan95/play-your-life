import { useState, useRef, useEffect } from 'react';
import type { Dispatch, SetStateAction, ReactNode } from 'react';
import {
  completeQuest,
  removeQuest,
  spheres,
  syncGoalTasks,
  updateGoal,
} from '../game';
import type { GameState, Goal, GoalStage, Quest } from '../game';
import {
  goalProgressValue,
  stageMetrics,
  stageState,
  stageAccess,
  stageLabels,
  stageDays,
  nextGoalTask,
  goalHistory,
  goalActivityStreak,
} from '../goalWorkspace';
import { goalStatistics, chartCoordinates } from '../goalStatistics';
import type { ProgressPoint } from '../goalStatistics';
import { goalRoute } from '../goalRoutes';
import {
  saveGoal,
  saveStage,
  removeStage,
  moveStage,
  duplicateStage,
  finishStage,
  deleteGoal,
  planEvent,
} from '../planning';
import { questCoins, progressQuest } from '../personalQuests';
import { sphereProgress, MAX_SPHERE_LEVEL } from '../sphereProgress';
import { sphereAssets } from '../sphereAssets';
import SphereIcon from './SphereIcon';
import Icon from './Icon';
import './GoalWorkspace.css';

type Props = {
  ownerId: string;
  state: GameState;
  goal: Goal;
  stageId?: string;
  onChange: Dispatch<SetStateAction<GameState>>;
  onEditGoal: () => void;
  onEditStage: (stage?: GoalStage) => void;
  onAddTask: (stageId?: string) => void;
  onEditTask: (task: Quest) => void;
  onTransfer: (task?: Quest) => void;
  onNotify: (message: string) => void;
  onSelect: (id: string | null) => void;
  onSphere: (id: string) => void;
};
const rarityNames = {
  common: 'Обычная',
  rare: 'Редкая',
  epic: 'Эпическая',
  legendary: 'Легендарная',
};
const shortDate = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Без срока';
const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function ProgressRing({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const p = Math.max(0, Math.min(100, value));
  return (
    <div
      className="gw-ring"
      role="img"
      aria-label={`${label}: ${Math.round(p)}%`}
    >
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="gw-ring-track" cx="60" cy="60" r="50" />
        <circle
          className="gw-ring-value"
          cx="60"
          cy="60"
          r="50"
          pathLength="100"
          strokeDasharray={`${p} 100`}
          visibility={p === 0 ? 'hidden' : 'visible'}
        />
      </svg>
      <b>{Math.round(p)}%</b>
    </div>
  );
}
function Card({
  title,
  icon,
  children,
  className = '',
}: {
  title: string;
  icon?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`gw-card ${className}`}>
      <h3>
        {icon && <span aria-hidden="true">{icon}</span>}
        {title}
      </h3>
      {children}
    </section>
  );
}
function StageCalendar({
  stage,
  tasks,
  onTask,
}: {
  stage: GoalStage;
  tasks: Quest[];
  onTask: (q: Quest) => void;
}) {
  const [month, setMonth] = useState(() => {
    const d = new Date(stage.startsAt ?? Date.now());
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState(dayKey(new Date()));
  const offset = (month.getDay() + 6) % 7;
  const count = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const key = (value?: string) => (value ? dayKey(new Date(value)) : '');
  return (
    <Card title="Календарь этапа">
      <div className="gw-calendar-heading">
        <button
          aria-label="Предыдущий месяц"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))
          }
        >
          ‹
        </button>
        <b>
          {month.toLocaleDateString('ru-RU', {
            month: 'long',
            year: 'numeric',
          })}
        </b>
        <button
          aria-label="Следующий месяц"
          onClick={() =>
            setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))
          }
        >
          ›
        </button>
      </div>
      <div className="gw-calendar-grid">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
          <small key={d}>{d}</small>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`offset-${i}`} />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const date = dayKey(
            new Date(month.getFullYear(), month.getMonth(), i + 1),
          );
          const due = tasks.filter((q) => key(q.dueAt) === date);
          return (
            <button
              key={date}
              className={`${date === key(stage.startsAt) || date === key(stage.dueAt) ? 'gw-calendar-boundary' : ''} ${date === dayKey(new Date()) ? 'gw-calendar-today' : ''} ${date === selected ? 'gw-calendar-selected' : ''}`}
              aria-label={`${date}${due.length ? `, задач: ${due.length}` : ''}${date === key(stage.startsAt) ? ', начало этапа' : ''}${date === key(stage.dueAt) ? ', окончание этапа' : ''}`}
              aria-pressed={selected === date}
              onClick={() => setSelected(date)}
            >
              {i + 1}
              {due.length > 0 && <i />}
            </button>
          );
        })}
      </div>
      <small className="gw-muted">
        Голубой — границы этапа · синий — сегодня · точка — задачи
      </small>
      <div className="gw-calendar-tasks">
        <b>{shortDate(`${selected}T12:00:00`)}</b>
        {tasks
          .filter((q) => key(q.dueAt) === selected)
          .map((q) => (
            <button key={q.id} onClick={() => onTask(q)}>
              {q.done ? '✓' : '○'} {q.name}
            </button>
          ))}
        {!tasks.some((q) => key(q.dueAt) === selected) && (
          <small>На этот день задач нет.</small>
        )}
      </div>
    </Card>
  );
}
function Timeline({ stage, onEdit }: { stage: GoalStage; onEdit: () => void }) {
  const days = stageDays(stage);
  return (
    <Card title="Временная шкала этапа" icon="◷">
      <div className="gw-date-range">
        <div>
          <small>Дата начала</small>
          <b>{shortDate(stage.startsAt)}</b>
        </div>
        <span>→</span>
        <div>
          <small>Дата окончания</small>
          <b>{shortDate(stage.dueAt)}</b>
        </div>
      </div>
      {days.progress === null ? (
        <p className="gw-muted">
          Укажите обе даты, чтобы увидеть временную шкалу.
        </p>
      ) : (
        <>
          <div
            className="gw-time-track"
            role="img"
            aria-label={`Прошло ${Math.round(days.progress)}% срока`}
          >
            <span style={{ width: `${days.progress}%` }} />
            <i style={{ left: `${days.progress}%` }} />
          </div>
          <div className="gw-date-range">
            <small>Прошло {days.elapsed} дн.</small>
            <small>
              {days.remaining! < 0
                ? `Просрочка ${-days.remaining!} дн.`
                : `Осталось ${days.remaining} дн.`}
            </small>
          </div>
        </>
      )}
      {stage.completedAt && (
        <p>Фактически завершён: {shortDate(stage.completedAt)}</p>
      )}
      <button className="text-button" onClick={onEdit}>
        Изменить даты →
      </button>
    </Card>
  );
}
function DataChart({
  label,
  series,
  maximum,
  extent,
  percent = false,
}: {
  label: string;
  series: {
    name: string;
    color: string;
    points: ProgressPoint[];
    dashed?: boolean;
  }[];
  maximum: number;
  extent?: string[];
  percent?: boolean;
}) {
  const domain = extent ?? series.flatMap((s) => s.points.map((p) => p.date));
  return (
    <svg
      className="gw-chart"
      viewBox="0 0 600 194"
      role="img"
      aria-label={label}
    >
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <path
            d={`M24 ${154 - f * 130}H580`}
            stroke="#e5f0f8"
            strokeDasharray="4 4"
          />
          <text x="22" y={151 - f * 130} fill="#6e809c" fontSize="11">
            {Number((maximum * f).toFixed(1))}
            {percent ? '%' : ''}
          </text>
        </g>
      ))}
      {series.map((item) => {
        const points = chartCoordinates(item.points, maximum, domain);
        return (
          <g key={item.name}>
            <polyline
              points={points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={item.color}
              strokeWidth="3"
              strokeDasharray={item.dashed ? '6 4' : undefined}
            />
            {points.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={item.color}>
                <title>
                  {item.name}: {p.value}
                  {percent ? '%' : ''} · {shortDate(p.date)}
                </title>
              </circle>
            ))}
          </g>
        );
      })}
      {domain.length > 0 && (
        <>
          <text x="24" y="186" fill="#6e809c" fontSize="11">
            {shortDate(domain[0])}
          </text>
          <text x="580" y="186" textAnchor="end" fill="#6e809c" fontSize="11">
            {shortDate(domain.at(-1))}
          </text>
        </>
      )}
    </svg>
  );
}
function Statistics({
  state,
  goal,
  stageId,
}: {
  state: GameState;
  goal: Goal;
  stageId?: string;
}) {
  const data = goalStatistics(state, goal, stageId);
  const dates = data.rows.map((r) => r.date);
  const counts = Math.max(
    1,
    ...data.rows.flatMap((r) => [r.planned, r.actual]),
  );
  const points = (field: 'planned' | 'actual' | 'xp') =>
    data.rows.map((r) => ({ date: r.date, value: r[field] }));
  return (
    <div className="gw-statistics">
      <Card title="План и факт выполнения" icon="▥">
        {data.rows.length ? (
          <>
            <DataChart
              label="План и факт выполнения задач по сохранённым срокам и датам завершения"
              maximum={counts}
              extent={dates}
              series={[
                {
                  name: 'План',
                  color: '#b38ae4',
                  points: points('planned'),
                  dashed: true,
                },
                { name: 'Факт', color: '#00a8ef', points: points('actual') },
              ]}
            />
            <div className="gw-chart-legend">
              <span>План: {data.planned}</span>
              <span>Факт: {data.done}</span>
            </div>
            <small className="gw-muted">
              Последние 30 дат с событиями. Расстояния между точками
              соответствуют датам.
            </small>
            <details>
              <summary>Данные графика</summary>
              <table>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>План</th>
                    <th>Факт</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.date}>
                      <td>{shortDate(r.date)}</td>
                      <td>{r.planned}</td>
                      <td>{r.actual}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        ) : (
          <p className="gw-muted">
            Нет задач со сроками или сохранёнными датами выполнения.
          </p>
        )}
        {data.undatedDone > 0 && (
          <p className="gw-muted">
            У {data.undatedDone} выполненных задач дата завершения не сохранена.
            Они учтены в общем результате, но не привязаны к дню на графике.
          </p>
        )}
      </Card>
      <Card title="Заработанный XP" icon="⭐">
        {data.totalXP > 0 ? (
          <>
            <DataChart
              label="Накопленный XP по событиям этой цели"
              maximum={Math.max(1, data.totalXP)}
              extent={dates}
              series={[{ name: 'XP', color: '#f3b02a', points: points('xp') }]}
            />
            <b>{data.totalXP} XP</b>
            <details>
              <summary>Начисления по датам</summary>
              <table>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Накопленный XP</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.date}>
                      <td>{shortDate(r.date)}</td>
                      <td>{r.xp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        ) : (
          <p className="gw-muted">
            Для этой цели ещё нет записанных начислений XP.
          </p>
        )}
      </Card>
      <Card title={stageId ? 'История прогресса этапа' : 'История прогресса'}>
        {data.progress.length ? (
          <>
            <DataChart
              label={
                stageId
                  ? 'Процент этапа по сохранённым событиям'
                  : 'Процент цели по сохранённым событиям'
              }
              maximum={100}
              percent
              series={[
                { name: 'Прогресс', color: '#17c499', points: data.progress },
              ]}
            />
            <details>
              <summary>Сохранённые значения прогресса</summary>
              <table>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Прогресс</th>
                  </tr>
                </thead>
                <tbody>
                  {data.progress.map((p, i) => (
                    <tr key={i}>
                      <td>{new Date(p.date).toLocaleString('ru-RU')}</td>
                      <td>{Number(p.value.toFixed(1))}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        ) : (
          <p className="gw-muted">
            История процентов появится после новых действий. Ранее не записанные
            значения не восстанавливаются.
          </p>
        )}
      </Card>
    </div>
  );
}

export default function GoalWorkspace(p: Props) {
  const { state, goal, stageId } = p;
  const stage = goal.stages?.find((s) => s.id === stageId);
  const stages = goal.stages ?? [];
  const tasks = state.quests.filter((q) => q.goalId === goal.id);
  const goalProgress = goalProgressValue(state, goal);
  const [tab, setTab] = useState('overview');
  const [filter, setFilter] = useState('all');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);
  const [expanded, setExpanded] = useState<string[]>(() => {
    const current = stages.find((s) => stageState(state, goal, s) === 'active');
    return current ? [current.id] : [];
  });
  const activeId = stages.find(
    (s) => stageState(state, goal, s, new Date(now)) === 'active',
  )?.id;
  const previousActiveId = useRef(activeId);
  useEffect(() => {
    if (previousActiveId.current !== activeId) {
      previousActiveId.current = activeId;
      if (activeId)
        queueMicrotask(() =>
          setExpanded((v) => (v.includes(activeId) ? v : [...v, activeId])),
        );
    }
  }, [activeId]);
  const [detail, setDetail] = useState<{
    kind: 'reward' | 'motivation' | 'notes' | 'task';
    task?: Quest;
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (detail) dialog.current?.showModal();
    else dialog.current?.close();
  }, [detail]);
  const sphere = spheres.find((s) => s.id === goal.sphere)!;
  const level = sphereProgress(state.spheres[goal.sphere].xp);
  const history = goalHistory(state, goal, stage?.id);
  const nextTask = nextGoalTask(state, goal);
  const streak = goalActivityStreak(state, goal);
  const completed = stages.filter(
    (s) => stageMetrics(state, goal, s).complete,
  ).length;
  const group = stage ? stageMetrics(state, goal, stage) : null;
  const scopeTasks = stage ? group!.tasks : tasks;
  const visibleTasks = scopeTasks.filter(
    (q) =>
      stage ||
      filter === 'all' ||
      (filter === 'none'
        ? !q.stageId || !stages.some((s) => s.id === q.stageId)
        : q.stageId === filter),
  );
  const viewedTask =
    detail?.kind === 'task'
      ? state.quests.find(
          (q) =>
            q.id === detail.task?.id &&
            q.goalId === goal.id &&
            (!stage || q.stageId === stage.id),
        )
      : undefined;
  const xp = scopeTasks.reduce((sum, q) => sum + q.xp, 0);
  const coins = scopeTasks.reduce((sum, q) => sum + questCoins(q), 0);
  const mutate = (fn: (s: GameState) => GameState) => {
    try {
      p.onChange(fn(state));
      return true;
    } catch (e) {
      p.onNotify(e instanceof Error ? e.message : 'Изменение не сохранено.');
      return false;
    }
  };
  const stageLink = (s: GoalStage, text: ReactNode, className = '') => {
    const label =
      className === 'gw-stage-enter' ? `Открыть этап: ${s.name}` : undefined;
    const blocked = stageAccess(state, goal, s);
    return blocked ? (
      <button
        className={className}
        aria-disabled="true"
        aria-label={label}
        onClick={() => p.onNotify(blocked)}
      >
        {text}
      </button>
    ) : (
      <a
        className={className}
        aria-label={label}
        href={`#${goalRoute(goal.id, s.id)}`}
      >
        {text}
      </a>
    );
  };
  function finish(task: Quest) {
    const parent = stages.find((s) => s.id === task.stageId);
    if (
      parent &&
      (stageAccess(state, goal, parent) || parent.status === 'paused')
    ) {
      p.onNotify(stageAccess(state, goal, parent) || 'Этап приостановлен.');
      return false;
    }
    if (task.startsAt && Date.parse(task.startsAt) > now) {
      p.onNotify('Задача запланирована на будущую дату.');
      return false;
    }
    return mutate((s) => completeQuest(s, task.id));
  }
  function taskRow(task: Quest) {
    const parent = stages.find((s) => s.id === task.stageId);
    const blocked = parent
      ? stageAccess(state, goal, parent) ||
        (parent.status === 'paused' ? 'Этап приостановлен' : '')
      : '';
    return (
      <div
        className={`gw-task ${task.done ? 'gw-task-done' : ''}`}
        key={task.id}
        data-task={task.id}
      >
        <button
          className="gw-task-check"
          disabled={
            task.done ||
            !!blocked ||
            (!!task.startsAt && Date.parse(task.startsAt) > now)
          }
          aria-label={`Выполнить: ${task.name}`}
          onClick={() => finish(task)}
        >
          {task.done ? '✓' : ''}
        </button>
        <button
          className="gw-task-name"
          onClick={() => setDetail({ kind: 'task', task })}
        >
          <strong>{task.name}</strong>
          <small>
            {task.dueAt ? shortDate(task.dueAt) : 'Без срока'}
            {task.required === false ? ' · Необязательная' : ''}
            {task.targetValue && !task.done
              ? ` · ${task.currentValue ?? 0}/${task.targetValue} ${task.unit ?? ''}`
              : ''}
          </small>
        </button>
        <span className="gw-task-xp">+{task.xp} XP</span>
        <button
          className="gw-icon-button"
          aria-label={`Открыть задачу: ${task.name}`}
          onClick={() => setDetail({ kind: 'task', task })}
        >
          ›
        </button>
      </div>
    );
  }
  function historyList(limit?: number) {
    return (
      <ol className="gw-history">
        {history.slice(0, limit).map((e) => (
          <li key={e.id}>
            <span
              className={`gw-history-dot ${e.xp ? 'gw-history-reward' : ''}`}
            >
              {e.xp ? '★' : '✓'}
            </span>
            <div>
              <small>{shortDate(e.date)}</small>
              <p>{e.title}</p>
            </div>
            {e.xp > 0 && <b>+{e.xp} XP</b>}
          </li>
        ))}
        {!history.length && (
          <li className="gw-muted">События этого этапа ещё не записаны.</li>
        )}
      </ol>
    );
  }
  function rewards() {
    return (
      <Card
        title={stage ? 'Награды за этап' : 'Награды за достижение цели'}
        icon="🏆"
        className="gw-rewards"
      >
        <button
          className="gw-reward-content"
          onClick={() => setDetail({ kind: 'reward' })}
        >
          <div>
            <b>⭐ {stage ? xp : goal.reward} XP</b>
            <b>
              🪙 {coins} Life Coins <small>за задачи</small>
            </b>
            <strong>
              {(stage ? stage.achievementTitle : goal.achievementTitle) ||
                (stage ? 'Результат этапа' : 'Достижение цели')}
            </strong>
            <span className="gw-rarity">
              {(stage ? stage.rarity : goal.rarity)
                ? rarityNames[(stage ? stage.rarity : goal.rarity)!]
                : 'Редкость не задана'}
            </span>
          </div>
          <span className="gw-trophy" aria-hidden="true">
            🏆
          </span>
        </button>
        <p className="gw-muted">
          {stage
            ? group?.complete
              ? 'Этап завершён. Награды задач учтены.'
              : 'Награды выдаются при выполнении задач.'
            : goal.rewarded
              ? 'Награда цели уже получена.'
              : 'Награда XP выдаётся один раз при достижении цели.'}
        </p>
      </Card>
    );
  }
  function roadmap() {
    return (
      <section className="gw-roadmap-section">
        <div className="gw-section-heading">
          <h2>Путь к цели</h2>
          <div>
            <button className="text-button" onClick={() => setExpanded([])}>
              Свернуть все этапы
            </button>
            <button className="primary-button" onClick={() => p.onEditStage()}>
              + Этап
            </button>
          </div>
        </div>
        <div className="gw-roadmap">
          {stages.map((s, index) => {
            const m = stageMetrics(state, goal, s),
              status = stageState(state, goal, s),
              open = expanded.includes(s.id),
              blocked = stageAccess(state, goal, s);
            return (
              <article
                className={`gw-roadmap-stage gw-stage-${status}`}
                key={s.id}
                data-stage={s.id}
              >
                <span className="gw-stage-marker" title={stageLabels[status]}>
                  {status === 'completed'
                    ? '✓'
                    : status === 'locked'
                      ? '🔒'
                      : index + 1}
                </span>
                <div className="gw-stage-row">
                  <div>
                    {stageLink(
                      s,
                      <strong>
                        Этап {index + 1}. {s.name}
                      </strong>,
                      'gw-stage-title',
                    )}
                    <p>
                      {s.description || 'Описание этапа пока не добавлено.'}
                    </p>
                    <small>{stageLabels[status]}</small>
                  </div>
                  <div className="gw-stage-numbers">
                    <b>{Math.round(m.progress)}%</b>
                    <small>
                      {m.done} из {m.total} задач
                    </small>
                  </div>
                  <button
                    className="gw-icon-button"
                    aria-label={`${open ? 'Свернуть' : 'Раскрыть'} этап: ${s.name}`}
                    aria-expanded={open}
                    aria-controls={`stage-content-${s.id}`}
                    onClick={() =>
                      setExpanded((v) =>
                        open ? v.filter((id) => id !== s.id) : [...v, s.id],
                      )
                    }
                  >
                    {open ? '⌃' : '⌄'}
                  </button>
                  {stageLink(s, '›', 'gw-stage-enter')}
                </div>
                {open && (
                  <div className="gw-stage-tasks" id={`stage-content-${s.id}`}>
                    {blocked ? (
                      <div>
                        <p className="gw-muted">{blocked}</p>
                        <button
                          className="text-button"
                          onClick={() => p.onEditStage(s)}
                        >
                          Настроить доступ этапа →
                        </button>
                      </div>
                    ) : (
                      <>
                        {m.tasks.map(taskRow)}
                        {!m.tasks.length && (
                          <p className="gw-muted">
                            Добавьте первый шаг этого этапа.
                          </p>
                        )}
                        <div className="gw-stage-footer">
                          <button
                            className="text-button"
                            onClick={() => p.onAddTask(s.id)}
                          >
                            ＋ Добавить задачу
                          </button>
                          {stageLink(
                            s,
                            <>Продолжить →</>,
                            'primary-button gw-continue',
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })}
          {!stages.length && (
            <div className="gw-empty">
              <span>🎯</span>
              <h3>Большая цель начинается с первого этапа</h3>
              <p>Создайте этап и добавьте реальные задачи.</p>
              <button
                className="primary-button"
                onClick={() => p.onEditStage()}
              >
                + Этап
              </button>
            </div>
          )}
        </div>
        {tasks.some(
          (q) => !q.stageId || !stages.some((s) => s.id === q.stageId),
        ) && (
          <Card title="Задачи без этапа">
            {tasks
              .filter(
                (q) => !q.stageId || !stages.some((s) => s.id === q.stageId),
              )
              .map(taskRow)}
            <button className="text-button" onClick={() => p.onAddTask()}>
              ＋ Добавить задачу
            </button>
          </Card>
        )}
      </section>
    );
  }
  function management() {
    if (!stage) return null;
    return (
      <Card title="Управление этапом" className="gw-management">
        <button onClick={() => p.onEditStage(stage)}>
          ✎ Редактировать этап
        </button>
        <button
          onClick={() => mutate((s) => duplicateStage(s, goal.id, stage.id))}
        >
          ▣ Дублировать этап с задачами
        </button>
        <button onClick={() => p.onEditStage(stage)}>▦ Перенести даты</button>
        <div className="gw-order">
          <button
            disabled={stages.indexOf(stage) === 0}
            onClick={() =>
              mutate((s) =>
                moveStage(s, goal.id, stage.id, stages.indexOf(stage) - 1),
              )
            }
          >
            ↑ Выше
          </button>
          <button
            disabled={stages.indexOf(stage) === stages.length - 1}
            onClick={() =>
              mutate((s) =>
                moveStage(s, goal.id, stage.id, stages.indexOf(stage) + 1),
              )
            }
          >
            ↓ Ниже
          </button>
        </div>
        <button
          onClick={() =>
            mutate((s) =>
              saveStage(s, goal.id, {
                ...stage,
                status: stage.status === 'paused' ? 'active' : 'paused',
              }),
            )
          }
          disabled={group?.complete}
        >
          {stage.status === 'paused'
            ? '▶ Возобновить этап'
            : 'Ⅱ Приостановить этап'}
        </button>
        <button
          disabled={group?.complete}
          onClick={() => mutate((s) => finishStage(s, goal.id, stage.id))}
        >
          ✓ Завершить этап
        </button>
        <button
          className="gw-danger"
          onClick={() => {
            if (
              window.confirm(
                'Удалить этап? Его задачи останутся в цели без этапа. XP и история сохранятся.',
              )
            ) {
              mutate((s) =>
                planEvent(
                  removeStage(s, goal.id, stage.id),
                  goal.id,
                  `Удалён этап: ${stage.name}`,
                  stage.id,
                ),
              );
              window.location.hash = goalRoute(goal.id);
            }
          }}
        >
          ♲ Удалить этап
        </button>
      </Card>
    );
  }
  const days = stageDays(goal);
  return (
    <div className="gw-workspace">
      <nav className="gw-breadcrumbs" aria-label="Навигационная цепочка">
        <button onClick={() => p.onSelect(null)}>Цели</button>
        <span>›</span>
        <a href={`#${goalRoute(goal.id)}`}>{goal.name}</a>
        {stage && (
          <>
            <span>›</span>
            <span>
              Этап {stages.indexOf(stage) + 1}. {stage.name}
            </span>
          </>
        )}
      </nav>
      <section className={`gw-banner ${stageId ? 'gw-banner-compact' : ''}`}>
        <img
          className="gw-banner-image"
          src={
            goal.image ||
            sphereAssets[goal.sphere as keyof typeof sphereAssets]
              .buildingThumbnail
          }
          alt=""
        />
        <div className="gw-banner-tools">
          <button aria-label="Изменить обложку цели" onClick={p.onEditGoal}>
            ✎
          </button>
          <details>
            <summary aria-label="Дополнительные действия цели">⋮</summary>
            <div>
              <button onClick={p.onEditGoal}>Настроить цель</button>
              <button onClick={() => p.onTransfer()}>Задачи в TickTick</button>
              <button
                onClick={() => mutate((s) => ({ ...s, mainGoalId: goal.id }))}
              >
                Сделать главной
              </button>
              <button
                className="gw-danger"
                onClick={() => {
                  if (
                    window.confirm(
                      'Удалить цель? Задачи, заработанный XP и история сохранятся.',
                    )
                  ) {
                    mutate((s) => deleteGoal(s, goal.id));
                    p.onSelect(null);
                  }
                }}
              >
                Удалить цель
              </button>
            </div>
          </details>
        </div>
        <div className="gw-banner-copy">
          <div className="gw-banner-sphere">
            <SphereIcon id={goal.sphere} />
            <span>{sphere.name}</span>
          </div>
          <h2>{goal.name}</h2>
          {!stageId && goal.description && <p>{goal.description}</p>}
          <div className="gw-banner-metrics">
            <span>
              ▦ {shortDate(goal.dueAt)}
              {days.remaining !== null && (
                <small>
                  {days.remaining < 0
                    ? `Просрочка ${-days.remaining} дн.`
                    : `Осталось ${days.remaining} дн.`}
                </small>
              )}
            </span>
            {streak > 0 && (
              <span>
                🔥 Серия активности<small>{streak} дн.</small>
              </span>
            )}
            <span>
              ▥ {tasks.filter((q) => q.done).length} из {tasks.length} задач
              <small>
                {completed} из {stages.length} этапов
              </small>
            </span>
          </div>
        </div>
        <div className="gw-banner-progress">
          <ProgressRing value={goalProgress} label="Общий прогресс цели" />
          <small>Общий прогресс цели</small>
          {stageId && (
            <a className="primary-button" href={`#${goalRoute(goal.id)}`}>
              Перейти к цели →
            </a>
          )}
        </div>
      </section>
      {stageId && (!stage || stageAccess(state, goal, stage)) ? (
        <Card title={stage ? 'Этап заблокирован' : 'Этап не найден'}>
          <p>
            {stage
              ? stageAccess(state, goal, stage)
              : 'Проверьте ссылку или откройте существующий этап из цели.'}
          </p>
          {stage && (
            <button
              className="text-button"
              onClick={() => p.onEditStage(stage)}
            >
              Настроить доступ этапа →
            </button>
          )}
          <a className="primary-button" href={`#${goalRoute(goal.id)}`}>
            Перейти к цели →
          </a>
        </Card>
      ) : (
        <>
          {stage && (
            <div className="gw-stage-heading">
              <span className="gw-stage-marker">
                {stages.indexOf(stage) + 1}
              </span>
              <div>
                <h2>
                  Этап {stages.indexOf(stage) + 1}. {stage.name}
                </h2>
                <p>{stage.description}</p>
              </div>
              <span className="gw-status">
                {stageLabels[stageState(state, goal, stage)]}
              </span>
              <button
                className="gw-icon-button"
                aria-label="Редактировать этап"
                onClick={() => p.onEditStage(stage)}
              >
                ✎
              </button>
            </div>
          )}
          <nav
            className="gw-tabs"
            aria-label={stage ? 'Разделы этапа' : 'Разделы цели'}
          >
            {(stage
              ? [
                  ['overview', 'Обзор', 'quests'],
                  ['tasks', 'Задачи', 'calendar'],
                  ['timeline', 'Временная шкала', 'plan'],
                  ['settings', 'Настройки', 'settings'],
                  ['statistics', 'Статистика', 'statistics'],
                ]
              : [
                  ['overview', 'Обзор', 'quests'],
                  ['stages', 'Этапы', 'tree'],
                  ['tasks', 'Задачи', 'calendar'],
                  ['statistics', 'Статистика', 'statistics'],
                  ['rewards', 'Награды', 'trophy'],
                  ['history', 'История', 'plan'],
                ]
            ).map(([id, name, icon]) => (
              <button
                key={id}
                aria-current={tab === id ? 'page' : undefined}
                className={tab === id ? 'selected' : ''}
                onClick={() => setTab(id)}
              >
                <Icon name={icon} size={18} />
                {name}
              </button>
            ))}
          </nav>
          {!stage && goal.progressMode !== 'tasks' && (
            <div className="gw-progress-source">
              <span>
                Источник прогресса: сохранённый числовой результат{' '}
                {goal.current} / {goal.target}. Задачи учитываются отдельно.
              </span>
              <button className="text-button" onClick={p.onEditGoal}>
                Настроить
              </button>
            </div>
          )}
          <div className="gw-columns">
            <div className="gw-main">
              {!stage && (tab === 'overview' || tab === 'stages') && roadmap()}
              {!stage && tab === 'overview' && (
                <Card title="Следующий шаг" icon="⚡" className="gw-next-step">
                  {nextTask ? (
                    <div>
                      <div>
                        <h3>{nextTask.name}</h3>
                        <p>
                          {nextTask.notes ||
                            'Откройте задачу и сделайте следующий шаг.'}
                        </p>
                        <small>
                          +{nextTask.xp} XP
                          {questCoins(nextTask)
                            ? ` · ${questCoins(nextTask)} Life Coins`
                            : ''}
                        </small>
                      </div>
                      <button
                        className="primary-button"
                        onClick={() =>
                          setDetail({ kind: 'task', task: nextTask })
                        }
                      >
                        Начать →
                      </button>
                    </div>
                  ) : (
                    <p>
                      {tasks.length && tasks.every((q) => q.done)
                        ? 'Все задачи выполнены. Добавьте следующий этап или подтвердите достижение цели.'
                        : 'Сейчас нет доступных задач. Добавьте задачу или проверьте даты и условия этапов.'}
                    </p>
                  )}
                </Card>
              )}
              {stage && tab === 'overview' && (
                <>
                  <Card title="Описание этапа" icon="🎯">
                    <p>
                      {stage.description ||
                        'Добавьте описание результата в настройках этапа.'}
                    </p>
                    {stage.completionCondition && (
                      <div className="gw-tip">
                        <strong>Условие завершения</strong>
                        <p>{stage.completionCondition}</p>
                      </div>
                    )}
                  </Card>
                  <Timeline stage={stage} onEdit={() => p.onEditStage(stage)} />
                </>
              )}
              {tab === 'tasks' || (stage && tab === 'overview') ? (
                <Card
                  title={
                    stage
                      ? `Задачи этапа (${group!.done} из ${group!.total})`
                      : 'Все задачи цели'
                  }
                >
                  <div className="gw-task-toolbar">
                    {!stage && (
                      <label>
                        Этап
                        <select
                          aria-label="Фильтр по этапу"
                          value={filter}
                          onChange={(e) => setFilter(e.target.value)}
                        >
                          <option value="all">Все этапы</option>
                          <option value="none">Без этапа</option>
                          {stages.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <button
                      className="primary-button"
                      onClick={() => p.onAddTask(stage?.id)}
                    >
                      ＋ Добавить задачу
                    </button>
                  </div>
                  {visibleTasks.map(taskRow)}
                  {!visibleTasks.length && (
                    <p className="gw-muted">
                      {scopeTasks.length
                        ? 'В выбранном этапе задач пока нет.'
                        : 'Задач пока нет.'}
                    </p>
                  )}
                </Card>
              ) : null}
              {stage && (tab === 'overview' || tab === 'settings') && (
                <Card title="Заметки" icon="▤">
                  <p className="gw-notes">
                    {stage.notes ||
                      'Здесь можно сохранить мысли, ссылки и идеи для этого этапа.'}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setDetail({ kind: 'notes' })}
                  >
                    Редактировать заметки →
                  </button>
                </Card>
              )}
              {stage && tab === 'timeline' && (
                <Timeline stage={stage} onEdit={() => p.onEditStage(stage)} />
              )}
              {stage && tab === 'settings' && management()}
              {tab === 'statistics' && (
                <Statistics state={state} goal={goal} stageId={stage?.id} />
              )}
              {!stage && tab === 'rewards' && rewards()}
              {!stage && tab === 'history' && (
                <Card title="История цели">{historyList()}</Card>
              )}
              {!stage &&
                goal.progressMode === 'tasks' &&
                goalProgress === 100 &&
                !goal.rewarded &&
                tasks.some((q) => q.required !== false) && (
                  <button
                    className="primary-button gw-claim"
                    onClick={() =>
                      mutate((s) => syncGoalTasks(s, goal.id, true))
                    }
                  >
                    Подтвердить достижение цели
                  </button>
                )}
              {!stage &&
                goal.progressMode !== 'tasks' &&
                tab === 'overview' && (
                  <Card title="Числовой результат">
                    <label>
                      Текущий прогресс
                      <input
                        type="number"
                        min={0}
                        max={goal.target}
                        value={goal.current}
                        onChange={(e) =>
                          mutate((s) =>
                            updateGoal(s, goal.id, Number(e.target.value)),
                          )
                        }
                      />
                    </label>
                  </Card>
                )}
            </div>
            <aside className="gw-aside">
              {stage ? (
                <>
                  <Card title="Прогресс этапа">
                    <ProgressRing
                      value={group!.progress}
                      label="Прогресс этапа"
                    />
                    <dl className="gw-facts">
                      <div>
                        <dt>✓ Выполнено задач</dt>
                        <dd>
                          {group!.done} из {group!.total}
                        </dd>
                      </div>
                      <div>
                        <dt>Осталось задач</dt>
                        <dd>{group!.total - group!.done}</dd>
                      </div>
                      <div>
                        <dt>Осталось дней</dt>
                        <dd>{stageDays(stage).remaining ?? 'Без срока'}</dd>
                      </div>
                      <div>
                        <dt>Дата завершения</dt>
                        <dd>{shortDate(stage.dueAt)}</dd>
                      </div>
                    </dl>
                  </Card>
                  <StageCalendar
                    stage={stage}
                    tasks={group!.tasks}
                    onTask={(task) => setDetail({ kind: 'task', task })}
                  />
                  {rewards()}
                  {management()}
                </>
              ) : (
                <>
                  {tab !== 'rewards' && rewards()}
                  <Card title="Почему эта цель важна для меня" icon="♥">
                    <button
                      className="gw-motivation"
                      onClick={() => setDetail({ kind: 'motivation' })}
                    >
                      {goal.motivation ||
                        'Добавьте свою причину — она поможет двигаться к цели.'}
                      <span>✎</span>
                    </button>
                  </Card>
                  <Card title="Связанная сфера">
                    <button
                      className="gw-sphere"
                      onClick={() => p.onSphere(goal.sphere)}
                    >
                      <SphereIcon id={goal.sphere} />
                      <div>
                        <b>{sphere.name}</b>
                        <small>
                          LVL {level.level} / {MAX_SPHERE_LEVEL}
                        </small>
                        <div className="gw-meter">
                          <span style={{ width: `${level.progress}%` }} />
                        </div>
                        <small>
                          {level.maxed
                            ? 'Максимальный уровень'
                            : `${level.remainingXP} XP до следующего уровня`}
                        </small>
                      </div>
                      <span>›</span>
                    </button>
                  </Card>
                  <Card title="История цели">
                    {historyList(4)}
                    <button
                      className="text-button"
                      onClick={() => setTab('history')}
                    >
                      Все события →
                    </button>
                  </Card>
                </>
              )}
            </aside>
          </div>
        </>
      )}
      <dialog
        ref={dialog}
        aria-label={
          detail?.kind === 'task'
            ? 'Подробности задачи'
            : detail?.kind === 'reward'
              ? 'Подробности награды'
              : detail?.kind === 'notes'
                ? 'Заметки этапа'
                : 'Личная мотивация'
        }
        onCancel={() => setDetail(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setDetail(null);
        }}
      >
        <div className="dialog-content">
          <button
            className="icon-button modal-close"
            aria-label="Закрыть"
            onClick={() => setDetail(null)}
          >
            ×
          </button>
          {detail?.kind === 'reward' && (
            <>
              <h2>🏆 {stage ? 'Награды этапа' : 'Награды цели'}</h2>
              <p>
                {stage
                  ? 'Награды этапа — это награды его задач; они начисляются при выполнении и не повторяются при завершении этапа.'
                  : `За достижение цели предусмотрено ${goal.reward} XP. Life Coins начисляются за задачи по существующим правилам.`}
              </p>
              <p>
                За задачи: {xp} XP · {coins} Life Coins.
              </p>
              <p>
                {stage
                  ? group?.complete
                    ? 'Этап завершён'
                    : 'Этап ещё не завершён'
                  : goal.rewarded
                    ? 'Награда цели получена'
                    : 'Награда цели ещё не получена'}
              </p>
              {(stage ? stage.achievementTitle : goal.achievementTitle) && (
                <strong>
                  {stage ? stage.achievementTitle : goal.achievementTitle}
                </strong>
              )}
            </>
          )}
          {(detail?.kind === 'motivation' || detail?.kind === 'notes') && (
            <form
              className="planning-form"
              onSubmit={(e) => {
                e.preventDefault();
                const text = String(new FormData(e.currentTarget).get('text'));
                const saved =
                  detail.kind === 'notes' && stage
                    ? mutate((s) =>
                        saveStage(s, goal.id, { ...stage, notes: text }),
                      )
                    : mutate((s) => saveGoal(s, { ...goal, motivation: text }));
                if (saved) setDetail(null);
              }}
            >
              <h2>
                {detail.kind === 'notes'
                  ? 'Заметки этапа'
                  : 'Почему эта цель важна для меня'}
              </h2>
              <label>
                Текст
                <textarea
                  autoFocus
                  name="text"
                  maxLength={2000}
                  rows={8}
                  defaultValue={
                    detail.kind === 'notes'
                      ? (stage?.notes ?? '')
                      : (goal.motivation ?? '')
                  }
                />
              </label>
              <button className="primary-button" type="submit">
                Сохранить
              </button>
            </form>
          )}
          {detail?.kind === 'task' && !viewedTask && (
            <p className="gw-muted">
              Эта задача больше не находится в цели. Закройте окно и выберите
              доступный шаг.
            </p>
          )}
          {detail?.kind === 'task' && viewedTask && (
            <>
              <h2>{viewedTask.name}</h2>
              <p>{viewedTask.notes || 'Описание задачи не добавлено.'}</p>
              <p>
                {shortDate(viewedTask.dueAt)} · +{viewedTask.xp} XP ·{' '}
                {questCoins(viewedTask)} Life Coins
              </p>
              <p>{viewedTask.done ? '✓ Выполнена' : 'В плане'}</p>
              {!viewedTask.done &&
                viewedTask.targetValue &&
                viewedTask.targetValue > 1 && (
                  <form
                    className="planning-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const value = Number(
                        new FormData(e.currentTarget).get('progress'),
                      );
                      if (
                        mutate((s) =>
                          progressQuest(s, viewedTask!.id, value, p.ownerId),
                        )
                      )
                        setDetail(null);
                    }}
                  >
                    <label>
                      Прогресс задачи ({viewedTask.unit || 'ед.'})
                      <input
                        name="progress"
                        type="number"
                        min={viewedTask.currentValue ?? 0}
                        max={viewedTask.targetValue}
                        step="any"
                        required
                        defaultValue={viewedTask.currentValue ?? 0}
                      />
                    </label>
                    <small>
                      Цель: {viewedTask.targetValue} {viewedTask.unit}
                    </small>
                    <button className="primary-button" type="submit">
                      Сохранить прогресс
                    </button>
                  </form>
                )}
              <div className="gw-task-toolbar">
                <button
                  className="primary-button"
                  disabled={viewedTask.done}
                  onClick={() => {
                    if (finish(viewedTask!)) setDetail(null);
                  }}
                >
                  Выполнить задачу
                </button>
                {!viewedTask.done && (
                  <button
                    className="secondary-button"
                    onClick={() => {
                      p.onEditTask(viewedTask!);
                      setDetail(null);
                    }}
                  >
                    Редактировать задачу
                  </button>
                )}
                <button
                  className="text-button"
                  onClick={() => {
                    p.onTransfer(viewedTask);
                    setDetail(null);
                  }}
                >
                  Передать в TickTick
                </button>
                <button
                  className="text-button gw-danger"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Удалить задачу? Уже заработанные награды и история сохранятся.',
                      )
                    ) {
                      mutate((s) =>
                        planEvent(
                          removeQuest(s, viewedTask!.id),
                          goal.id,
                          `Удалена задача: ${viewedTask!.name}`,
                          viewedTask!.stageId,
                        ),
                      );
                      setDetail(null);
                    }
                  }}
                >
                  Удалить задачу
                </button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
