import { dependencyBlockMessage } from '../taskDependencies';
import { lazy, Suspense, useState, useRef, useEffect } from 'react';
import type { Dispatch, SetStateAction, ReactNode } from 'react';
import {
  completeQuest,
  dateKey,
  reopenQuest,
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
  goalPaceStatus,
  goalPaceLabels,
  activeGoalStage,
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
  addGoalCheckpoint,
  toggleGoalCheckpoint,
  removeGoalCheckpoint,
  addGoalIfThenRule,
  removeGoalIfThenRule,
} from '../planning';
import {
  MAX_GOAL_CHECKPOINTS,
  GOAL_CHECKPOINT_TEXT_MAX,
  GOAL_WEEKLY_FOCUS_MAX,
  GOAL_FINAL_RESULT_MAX,
  STAGE_WHY_IMPORTANT_MAX,
  GOAL_WOOP_FIELD_MAX,
  MAX_GOAL_IF_THEN_RULES,
  GOAL_IF_THEN_TEXT_MAX,
  GOAL_WEEKLY_FOCUS_GOAL_TEXT_MAX,
  GOAL_WEEKLY_FOCUS_GOAL_TARGET_MAX,
  GOAL_NOTES_MAX,
} from '../game';
import { questCoins, progressQuest, duplicateQuest } from '../personalQuests';
import { sphereAssets } from '../sphereAssets';
import { startPracticeSession, togglePracticeStep, completePracticeSession } from '../skillPractice';
import { skillTreeOf, nodeLevel, practiceLevelInfo } from '../skillTree';
import ProjectCompletionDialog from './ProjectCompletionDialog';
import {
  MAX_MONTHLY_FOCUS,
  monthlyFocusGoals,
  toggleMonthlyFocus,
} from '../monthlyFocus';
import SphereIcon from './SphereIcon';
import { postponementAnalytics, timeAnalytics } from '../planningData';
import Icon from './Icon';
import TaskLabelBadge from './TaskLabelBadge';
import TaskWindow from './TaskWindow';
import { focusSlices, formatFocus } from '../focusCore';
const FocusStats = lazy(() => import('./FocusStats'));
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
  onInbox: () => void;
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
/** Компактная строка «период · дедлайн» для карточки этапа в дорожной карте. */
function stageDateLine(s: GoalStage, status: string) {
  if (!s.startsAt && !s.dueAt) return null;
  const range = s.startsAt && s.dueAt
    ? `${shortDate(s.startsAt)} → ${shortDate(s.dueAt)}`
    : s.startsAt
      ? `с ${shortDate(s.startsAt)}`
      : `до ${shortDate(s.dueAt)}`;
  return (
    <small className="gw-stage-dates">
      <span aria-hidden="true">📅</span> {range}
      {s.dueAt && (
        <>
          {' '}
          · <span aria-hidden="true">⏳</span>{' '}
          {status === 'completed' ? 'Дедлайн был' : 'Дедлайн'}:{' '}
          {shortDate(s.dueAt)}
        </>
      )}
    </small>
  );
}
/** Период и отдельный игровой дедлайн задачи (deadlineAt не синхронизируется с TickTick). */
function taskDateLine(task: Quest) {
  const range =
    task.startsAt && task.dueAt
      ? `${shortDate(task.startsAt)} → ${shortDate(task.dueAt)}`
      : task.dueAt
        ? shortDate(task.dueAt)
        : 'Без срока';
  return (
    <>
      {range}
      {task.deadlineAt && (
        <>
          {' '}
          · <span aria-hidden="true">⏳</span> Дедлайн:{' '}
          {shortDate(task.deadlineAt)}
        </>
      )}
    </>
  );
}

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
const CARD_ICONS = {
  roadmap: { name: 'list', from: '#6ad0ff', to: '#0a84ff' },
  checkpoints: { name: 'flag', from: '#ffbf5c', to: '#ff8a00' },
  nextStep: { name: 'bolt', from: '#ffe066', to: '#ff9f0a' },
  finalResult: { name: 'goals', from: '#cdaef8', to: '#8b5cf6' },
  projectState: { name: 'gauge', from: '#78e8ab', to: '#1fb866' },
  weeklyProgress: { name: 'statistics', from: '#7fe3ff', to: '#0a84ff' },
  weeklyFocus: { name: 'crosshair', from: '#a7a4f7', to: '#5e5ce6' },
  motivation: { name: 'heart', from: '#ff9ab3', to: '#ff375f' },
  stageWhy: { name: 'diamond', from: '#a7a4f7', to: '#5e5ce6' },
  weeklyFocusGoal: { name: 'ruler', from: '#6ad0ff', to: '#0a84ff' },
  notes: { name: 'paperclip', from: '#b7bfd1', to: '#717c93' },
  history: { name: 'clock', from: '#b7bfd1', to: '#717c93' },
  woop: { name: 'brain', from: '#cdaef8', to: '#8b5cf6' },
  ifThen: { name: 'flow', from: '#7fe3ff', to: '#0a84ff' },
  rewards: { name: 'trophy', from: '#ffd27a', to: '#ff9f0a' },
  stageDescription: { name: 'goals', from: '#78e8ab', to: '#1fb866' },
  timeline: { name: 'clock', from: '#6ad0ff', to: '#0a84ff' },
  planFact: { name: 'statistics', from: '#cdaef8', to: '#8b5cf6' },
  xp: { name: 'star', from: '#ffd27a', to: '#ff9f0a' },
  practice: { name: 'repeat', from: '#7fe3ff', to: '#0a84ff' },
} satisfies Record<string, { name: string; from: string; to: string }>;
type CardIcon = keyof typeof CARD_ICONS;
function IconTile({ id, small = false }: { id: CardIcon; small?: boolean }) {
  const cfg = CARD_ICONS[id];
  return (
    <span
      className={`gw-ico ${small ? 'gw-ico-sm' : ''}`}
      aria-hidden="true"
      style={{ background: `linear-gradient(160deg, ${cfg.from}, ${cfg.to})` }}
    >
      <Icon name={cfg.name} size={small ? 12 : 14} />
    </span>
  );
}
function Card({
  title,
  icon,
  children,
  className = '',
}: {
  title: string;
  icon?: CardIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`gw-card ${className}`}>
      <h3>
        {icon && <IconTile id={icon} />}
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
    <Card title="Временная шкала этапа" icon="timeline">
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
  // Переносы и фактическое время — только по задачам этого проекта (или этапа), ТЗ «Этап 2», раздел 9.
  const scopedIds = state.quests
    .filter((q) => q.goalId === goal.id && (!stageId || q.stageId === stageId))
    .map((q) => q.id);
  const postponed = postponementAnalytics(state, new Date(), scopedIds);
  const timing = timeAnalytics(state, scopedIds);
  const dates = data.rows.map((r) => r.date);
  const counts = Math.max(
    1,
    ...data.rows.flatMap((r) => [r.planned, r.actual]),
  );
  const points = (field: 'planned' | 'actual' | 'xp') =>
    data.rows.map((r) => ({ date: r.date, value: r[field] }));
  return (
    <div className="gw-statistics">
      <Card title="План и факт выполнения" icon="planFact">
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
      <Card title="Заработанный XP" icon="xp">
        {data.totalXP > 0 ? (
          <>
            <DataChart
              label="Накопленный XP по событиям этого проекта"
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
            Для этого проекта ещё нет записанных начислений XP.
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
                  : 'Процент проекта по сохранённым событиям'
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
      <Card title="Переносы и фактическое время">
        {postponed.insufficientData ? (
          <p className="gw-muted">Недостаточно данных: пока слишком мало задач {stageId ? 'этапа' : 'проекта'} с плановой датой.</p>
        ) : (
          <p className="gw-muted">
            Перенесено вперёд: {Math.round((postponed.postponementRate ?? 0) * 100)}% запланированных задач.
            Всего переносов: {postponed.totalMoves} (вперёд {postponed.forwardMoves}, назад {postponed.backwardMoves}).
            {postponed.ambiguousMoves ? ` Ещё ${postponed.ambiguousMoves} изменений с неизвестной причиной (повтор TickTick?) не включены.` : ''}
          </p>
        )}
        {timing.tasksWithBoth > 0 ? (
          <p className="gw-muted">
            Точность оценки времени: {Math.round((timing.planAccuracy ?? 0) * 100)}% по {timing.tasksWithBoth} завершённым задачам
            (план {timing.plannedMinutes} мин, факт {timing.actualMinutes} мин).
          </p>
        ) : (
          <p className="gw-muted">Пока нет завершённых задач {stageId ? 'этапа' : 'проекта'} с указанными планом и фактом времени одновременно.</p>
        )}
      </Card>
    </div>
  );
}
/** Компактный спарклайн прогресса проекта по сохранённым точкам — для боковой панели. */
function WeeklyProgressCard({ state, goal }: { state: GameState; goal: Goal }) {
  const data = goalStatistics(state, goal);
  const current = Math.round(goalProgressValue(state, goal));
  const points = data.progress;
  const coords =
    points.length > 1
      ? (() => {
          const start = Date.parse(points[0].date);
          const end = Date.parse(points[points.length - 1].date);
          const span = Math.max(1, end - start);
          return points.map((pt) => ({
            x: 8 + ((Date.parse(pt.date) - start) / span) * 244,
            y: 54 - (Math.max(0, Math.min(100, pt.value)) / 100) * 44,
          }));
        })()
      : null;
  return (
    <Card title="Прогресс по неделям" icon="weeklyProgress">
      <div className="gw-weekly-progress">
        <b>{current}%</b>
        {coords ? (
          <svg
            className="gw-sparkline"
            viewBox="0 0 260 64"
            role="img"
            aria-label={`Прогресс проекта по сохранённым точкам, сейчас ${current}%`}
          >
            <path
              d={coords
                .map((c, i) => `${i ? 'L' : 'M'}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
                .join(' ')}
              fill="none"
              stroke="#0a84ff"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              cx={coords[coords.length - 1].x}
              cy={coords[coords.length - 1].y}
              r="3.4"
              fill="#0a84ff"
            />
          </svg>
        ) : (
          <p className="gw-muted">
            График появится, когда накопится история прогресса проекта.
          </p>
        )}
      </div>
      {points.length > 1 && (
        <small className="gw-muted">
          {shortDate(points[0].date)} — {shortDate(points[points.length - 1].date)}
        </small>
      )}
    </Card>
  );
}

export default function GoalWorkspace(p: Props) {
  const { state, goal, stageId } = p;
  const stage = goal.stages?.find((s) => s.id === stageId);
  const stages = goal.stages ?? [];
  const tasks = state.quests.filter((q) => q.goalId === goal.id);
  const goalProgress = goalProgressValue(state, goal);
  const practiceSessions = (state.practiceSessions ?? []).filter((session) => session.goalId === goal.id);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [tab, setTab] = useState(goal.projectReview ? 'tasks' : 'overview');
  const [filter, setFilter] = useState('all');
  const [now, setNow] = useState(() => Date.now());
  const today = dateKey(new Date(now));
  const monthNow = new Date(now);
  const currentMonthlyFocus = monthlyFocusGoals(state, monthNow);
  const isMonthlyFocus = currentMonthlyFocus.some((item) => item.id === goal.id);
  const monthlyFocusLimitReached =
    currentMonthlyFocus.length >= MAX_MONTHLY_FOCUS;
  const monthlyFocusLimitMessage = `В этом месяце уже выбрано ${MAX_MONTHLY_FOCUS} из ${MAX_MONTHLY_FOCUS} главных проектов. Сначала уберите один из них.`;
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
    kind:
      | 'reward'
      | 'motivation'
      | 'notes'
      | 'weeklyFocus'
      | 'task'
      | 'finalResult'
      | 'stageWhy'
      | 'weeklyFocusGoal'
      | 'woop';
    task?: Quest;
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    // У окна задачи (TaskWindow) собственный оверлей — свой <dialog> под него не открываем.
    if (detail && detail.kind !== 'task') dialog.current?.showModal();
    else dialog.current?.close();
  }, [detail]);
  const sphere = spheres.find((s) => s.id === goal.sphere)!;
  const history = goalHistory(state, goal, stage?.id);
  const nextTask = nextGoalTask(state, goal);
  const activeStage = activeGoalStage(state, goal, new Date(now));
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
  function toggleGoalMonthlyFocus() {
    const shouldAdd = !isMonthlyFocus;
    try {
      if (shouldAdd && monthlyFocusLimitReached) {
        throw new Error(monthlyFocusLimitMessage);
      }
      toggleMonthlyFocus(state, goal.id, monthNow);
    } catch (e) {
      p.onNotify(
        e instanceof Error ? e.message : 'Не удалось изменить главные проекты месяца.',
      );
      return;
    }
    p.onChange((latest) => {
      const latestFocus = monthlyFocusGoals(latest, monthNow);
      const latestSelected = latestFocus.some((item) => item.id === goal.id);
      if (
        !latest.goals.some((item) => item.id === goal.id) ||
        (shouldAdd && (latestSelected || latestFocus.length >= MAX_MONTHLY_FOCUS)) ||
        (!shouldAdd && !latestSelected)
      ) {
        return latest;
      }
      return toggleMonthlyFocus(latest, goal.id, monthNow);
    });
    p.onNotify(
      shouldAdd
        ? 'Проект выбран главным проектом месяца.'
        : 'Проект убран из главных проектов месяца.',
    );
  }
  function beginPractice(task: Quest) {
    if (mutate((s) => startPracticeSession(s, goal.id, task.id))) {
      setTab('tasks');
      setDetail(null);
      p.onNotify('Создан отдельный повтор задачи. Он не меняет прогресс проекта и не выдаёт награды.');
    }
  }
  function finishPractice(sessionId: string) {
    if (mutate((s) => completePracticeSession(s, sessionId)))
      p.onNotify('Повтор сохранён. Уровень навыка растёт по завершённым практикам.');
  }
  function togglePractice(sessionId: string, stepId: string) {
    mutate((s) => togglePracticeStep(s, sessionId, stepId));
  }
  const practiceNode = goal.projectReview
    ? skillTreeOf(state, goal.sphere).nodes.find((node) => node.id === goal.projectReview?.skillNodeId)
    : undefined;
  const practiceLevel = practiceNode ? nodeLevel(state, practiceNode) : 0;
  const practiceInfo = practiceNode
    ? practiceLevelInfo(practiceSessions.filter((session) => !!session.completedAt && session.skillNodeId === practiceNode.id).length, practiceNode.levels)
    : undefined;

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
    const dependencyProblem = dependencyBlockMessage(state.quests, task);
    if (dependencyProblem) { p.onNotify(dependencyProblem); return false; }
    if (goal.paused) {
      p.onNotify('Проект на паузе. Возобновите проект, чтобы завершать задачи.');
      return false;
    }
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
    const changed = mutate((s) => completeQuest(s, task.id));
    if (changed && task.rewardClaimed)
      p.onNotify('Задача отмечена выполненной. Награда уже была получена и повторно не начислена.');
    return changed;
  }
  function undoFinish(task: Quest) {
    const changed = mutate((s) => reopenQuest(s, task.id));
    if (changed)
      p.onNotify('Отметка выполнения снята. Полученная награда остаётся и повторно не начислится.');
    return changed;
  }
  function deleteTask(task: Quest) {
    if (
      window.confirm(
        'Удалить задачу? Уже заработанные награды и история сохранятся.',
      )
    ) {
      mutate((s) =>
        planEvent(
          removeQuest(s, task.id),
          goal.id,
          `Удалена задача: ${task.name}`,
          task.stageId,
        ),
      );
      setDetail(null);
    }
  }
  function duplicateTask(task: Quest) {
    if (mutate((s) => duplicateQuest(s, task.id, p.ownerId)))
      p.onNotify(`«${task.name}» продублирована`);
  }
  const [progress, setProgress] = useState<Quest | null>(null);
  const [progressValue, setProgressValue] = useState(0);
  function startProgress(task: Quest) {
    setProgress(task);
    setProgressValue(task.currentValue ?? 0);
  }
  function saveProgress(task: Quest, value: number) {
    if (goal.paused) {
      p.onNotify('Проект на паузе. Возобновите проект, чтобы завершать задачи.');
      return;
    }
    const target = task.targetValue ?? 1;
    if (value >= target) {
      if (finish(task)) setProgress(null);
    } else if (mutate((s) => progressQuest(s, task.id, value, p.ownerId))) {
      setProgress(null);
    }
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
          disabled={!task.done && (
            !!blocked ||
            (!!task.startsAt && Date.parse(task.startsAt) > now)
          )}
          aria-label={`${task.done ? 'Отменить выполнение' : 'Выполнить'}: ${task.name}`}
          onClick={() => task.done ? undoFinish(task) : finish(task)}
        >
          {task.done ? '✓' : ''}
        </button>
        <button
          className="gw-task-name"
          onClick={() => setDetail({ kind: 'task', task })}
        >
          <strong>{task.name}</strong>
          <TaskLabelBadge labelId={task.labelId} labels={state.taskLabels} />
          <small>
            {taskDateLine(task)}
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
        title={stage ? 'Награды за этап' : 'Награды за достижение проекта'}
        icon="rewards"
        className="gw-rewards"
      >
        <button
          className="gw-reward-content"
          onClick={() => setDetail({ kind: 'reward' })}
        >
          <div>
            <b>⭐ {stage ? xp : goal.reward} XP</b>
            <b>
              🪙 {coins} лайфкоинов <small>за задачи</small>
            </b>
            <strong>
              {(stage ? stage.achievementTitle : goal.achievementTitle) ||
                (stage ? 'Результат этапа' : 'Достижение проекта')}
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
              ? 'Награда проекта уже получена.'
              : 'Награда XP выдаётся один раз при достижении проекта.'}
        </p>
      </Card>
    );
  }
  function roadmap() {
    return (
      <section className="gw-roadmap-section">
        <div className="gw-section-heading">
          <h2>
            <IconTile id="roadmap" />
            Путь к проекту
          </h2>
          <div>
            {tab !== 'stages' && (
              <button className="text-button" onClick={() => setExpanded([])}>
                Свернуть все этапы
              </button>
            )}
            <button className="primary-button" onClick={() => p.onEditStage()}>
              + Этап
            </button>
          </div>
        </div>
        <div className="gw-roadmap">
          {stages.map((s, index) => {
            const m = stageMetrics(state, goal, s),
              status = stageState(state, goal, s),
              open = tab === 'stages' || expanded.includes(s.id),
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
                    {stageDateLine(s, status)}
                  </div>
                  <div className="gw-stage-numbers">
                    <b>{Math.round(m.progress)}%</b>
                    <small>
                      {m.done} из {m.total} задач
                    </small>
                  </div>
                  {tab !== 'stages' && (
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
                  )}
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
              <h3>Большой проект начинается с первого этапа</h3>
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
                'Удалить этап? Его задачи останутся в проекте без этапа. XP и история сохранятся.',
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
        <button onClick={() => p.onSelect(null)}>Проекты</button>
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
      {goal.paused && !stage && (
        <div className="gw-paused-banner">
          <span>Проект на паузе — срок и серия активности не учитываются</span>
          <button
            className="primary-button"
            onClick={() => {
              if (mutate((s) => saveGoal(s, { ...goal, paused: false })))
                p.onNotify('Проект возобновлён.');
            }}
          >
            Возобновить проект
          </button>
        </div>
      )}
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
          <button aria-label="Изменить обложку проекта" onClick={p.onEditGoal}>
            ✎
          </button>
          <details>
            <summary aria-label="Дополнительные действия проекта">⋮</summary>
            <div>
              <button onClick={p.onEditGoal}>Настроить проект</button>
              <button
                onClick={() => {
                  const next = !goal.paused;
                  if (mutate((s) => saveGoal(s, { ...goal, paused: next })))
                    p.onNotify(
                      next
                        ? 'Проект на паузе — срок и серия активности не учитываются.'
                        : 'Проект возобновлён.',
                    );
                }}
              >
                {goal.paused ? '▶ Возобновить проект' : 'Ⅱ Поставить на паузу'}
              </button>
              <button onClick={() => p.onTransfer()}>Задачи в TickTick</button>
              <button onClick={p.onInbox}>Разобрать входящие</button>
              <button
                onClick={() => mutate((s) => ({ ...s, mainGoalId: goal.id }))}
              >
                Сделать главной
              </button>
              <button
                aria-pressed={isMonthlyFocus}
                disabled={!isMonthlyFocus && monthlyFocusLimitReached}
                title={
                  !isMonthlyFocus && monthlyFocusLimitReached
                    ? monthlyFocusLimitMessage
                    : undefined
                }
                onClick={toggleGoalMonthlyFocus}
              >
                {isMonthlyFocus
                  ? 'Убрать из главных проектов месяца'
                  : 'Сделать главным проектом месяца'}
              </button>
              {!isMonthlyFocus && monthlyFocusLimitReached && (
                <small className="gw-monthly-focus-limit">
                  {monthlyFocusLimitMessage}
                </small>
              )}
              <button
                className="gw-danger"
                onClick={() => {
                  if (
                    window.confirm(
                      'Удалить проект? Задачи, заработанный XP и история сохранятся.',
                    )
                  ) {
                    mutate((s) => deleteGoal(s, goal.id));
                    p.onSelect(null);
                  }
                }}
              >
                Удалить проект
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
            {isMonthlyFocus && (
              <span>
                ★ Главный проект месяца
                <small>Выбрана на текущий месяц</small>
              </span>
            )}
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
              ⏱ Всего фокуса
              <small>{formatFocus(focusSlices(state, { goalId: goal.id }).reduce((sum, s) => sum + s.seconds, 0))}</small>
            </span>
            <span>
              ▥ {tasks.filter((q) => q.done).length} из {tasks.length} задач
              <small>
                {completed} из {stages.length} этапов
              </small>
            </span>
          </div>
        </div>
        <div className="gw-banner-progress">
          <ProgressRing value={goalProgress} label="Общий прогресс проекта" />
          <small>Общий прогресс проекта</small>
          {stageId && (
            <a className="primary-button" href={`#${goalRoute(goal.id)}`}>
              Перейти к проекту →
            </a>
          )}
          {!stage && !goal.projectReview && (
            <button className="primary-button gw-finish-project" disabled={goalProgress < 100} onClick={() => setReviewOpen(true)}>
              Завершить проект
            </button>
          )}
          {!stage && goal.projectReview && (
            <button className="text-button gw-practice-link" onClick={() => setTab('tasks')}>
              Навык: {goal.projectReview.skillName} · практика →
            </button>
          )}
        </div>
      </section>
      {stageId && (!stage || stageAccess(state, goal, stage)) ? (
        <Card title={stage ? 'Этап заблокирован' : 'Этап не найден'}>
          <p>
            {stage
              ? stageAccess(state, goal, stage)
              : 'Проверьте ссылку или откройте существующий этап из проекта.'}
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
            Перейти к проекту →
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
            aria-label={stage ? 'Разделы этапа' : 'Разделы проекта'}
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
                <Card title="Контрольные точки" icon="checkpoints" className="gw-checkpoints">
                  <p className="gw-muted">
                    Измеримые промежуточные результаты проекта — отдельно от
                    этапов и задач.
                  </p>
                  <ul className="gw-checkpoint-list">
                    {(goal.checkpoints ?? []).map((c) => (
                      <li key={c.id} className={c.done ? 'gw-checkpoint-done' : ''}>
                        <button
                          className="gw-checkpoint-check"
                          aria-label={`${c.done ? 'Снять отметку' : 'Отметить выполненной'}: ${c.text}`}
                          onClick={() =>
                            mutate((s) => toggleGoalCheckpoint(s, goal.id, c.id))
                          }
                        >
                          {c.done ? '✓' : ''}
                        </button>
                        <span>{c.text}</span>
                        <button
                          className="gw-icon-button"
                          aria-label={`Удалить контрольную точку: ${c.text}`}
                          onClick={() =>
                            mutate((s) => removeGoalCheckpoint(s, goal.id, c.id))
                          }
                        >
                          ×
                        </button>
                      </li>
                    ))}
                    {!goal.checkpoints?.length && (
                      <li className="gw-muted">Контрольных точек пока нет.</li>
                    )}
                  </ul>
                  {(goal.checkpoints?.length ?? 0) < MAX_GOAL_CHECKPOINTS && (
                    <form
                      className="gw-checkpoint-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const text = String(new FormData(form).get('text') ?? '');
                        if (mutate((s) => addGoalCheckpoint(s, goal.id, text)))
                          form.reset();
                      }}
                    >
                      <input
                        name="text"
                        placeholder="Например: сдать первый тест"
                        maxLength={GOAL_CHECKPOINT_TEXT_MAX}
                        required
                      />
                      <button className="text-button" type="submit">
                        ＋ Добавить контрольную точку
                      </button>
                    </form>
                  )}
                </Card>
              )}
              {!stage && tab === 'overview' && (
                <Card title="Следующий шаг" icon="nextStep" className="gw-next-step">
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
                            ? ` · ${questCoins(nextTask)} лайфкоинов`
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
                        ? 'Все задачи выполнены. Добавьте следующий этап или подтвердите достижение проекта.'
                        : 'Сейчас нет доступных задач. Добавьте задачу или проверьте даты и условия этапов.'}
                    </p>
                  )}
                </Card>
              )}
              {stage && tab === 'overview' && (
                <>
                  <Card title="Описание этапа" icon="stageDescription">
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
              {!stage && tab === 'tasks' && goal.projectReview && (
                <Card title={`Практика навыка: ${goal.projectReview.skillName}`} icon="practice" className="gw-practice-card">
                  <p className="gw-muted">Уровень {practiceLevel} из {practiceNode?.levels ?? 5}. {practiceInfo?.max ? 'Максимальный уровень достигнут.' : `До следующего уровня осталось ${Math.max(0, (practiceInfo?.required ?? 0) - (practiceInfo?.practiced ?? 0))} повтора(ов).`} Повторы не дают XP или лайфкоины и не меняют исходные задачи.</p>
                  {practiceSessions.filter((session) => !session.completedAt).map((session) => (
                    <article className="gw-practice-session" key={session.id}>
                      <strong>{session.taskName}</strong>
                      {session.subtasks.map((step) => (
                        <label className="gw-practice-step" key={step.id}>
                          <input type="checkbox" checked={step.done} onChange={() => togglePractice(session.id, step.id)} />
                          <span>{step.title}</span>
                        </label>
                      ))}
                      <button className="primary-button" disabled={session.subtasks.some((step) => !step.done)} onClick={() => finishPractice(session.id)}>
                        {session.subtasks.length ? 'Завершить повтор' : 'Отметить повтор выполненным'}
                      </button>
                    </article>
                  ))}
                  {practiceSessions.some((session) => session.completedAt) && (
                    <details className="gw-practice-history">
                      <summary>История повторов: {practiceSessions.filter((session) => session.completedAt).length}</summary>
                      {practiceSessions.filter((session) => session.completedAt).slice().reverse().slice(0, 8).map((session) => (
                        <p key={session.id}>✓ {session.taskName} · {shortDate(session.completedAt)}</p>
                      ))}
                    </details>
                  )}
                  {!practiceSessions.length && <p className="gw-muted">Открой выполненную задачу ниже и нажми «Практиковать снова».</p>}
                </Card>
              )}
              {tab === 'tasks' || (stage && tab === 'overview') ? (
                <Card
                  title={
                    stage
                      ? `Задачи этапа (${group!.done} из ${group!.total})`
                      : 'Все задачи проекта'
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
                <Card title="Заметки" icon="notes">
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
                <Suspense fallback={null}>
                  <FocusStats state={state} goal={goal} stageId={stage?.id}
                    onOpenStage={(id) => { window.location.hash = goalRoute(goal.id, id); }} />
                </Suspense>
              )}
              {tab === 'statistics' && (
                <Statistics state={state} goal={goal} stageId={stage?.id} />
              )}
              {!stage && tab === 'history' && (
                <Card title="История проекта">{historyList()}</Card>
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
                    Подтвердить достижение проекта
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
                  <Card title="Конечный результат" icon="finalResult">
                    <button
                      className="gw-final-result"
                      onClick={() => setDetail({ kind: 'finalResult' })}
                    >
                      {goal.finalResult ||
                        'Опишите, каким будет конечный результат этого проекта.'}
                      <span>✎</span>
                    </button>
                  </Card>
                  <Card title="Состояние проекта" icon="projectState">
                    {(() => {
                      const pace = goalPaceStatus(state, goal, new Date(now));
                      return (
                        <>
                          <span className={`gw-pace gw-pace-${pace.status}`}>
                            {pace.status === 'unknown' ? '⚪' : pace.status === 'ahead' ? '🟢' : pace.status === 'behind' ? '🔴' : '🔵'}{' '}
                            {goalPaceLabels[pace.status]}
                          </span>
                          <p className="gw-muted">
                            {pace.timeProgress === null
                              ? 'Укажите срок начала и окончания проекта, чтобы сравнить прогресс со временем.'
                              : `Прогресс ${Math.round(pace.progress)}% при ${Math.round(pace.timeProgress)}% прошедшего срока.`}
                          </p>
                        </>
                      );
                    })()}
                  </Card>
                  <WeeklyProgressCard state={state} goal={goal} />
                  <Card title="Фокус на эту неделю" icon="weeklyFocus">
                    <button
                      className="gw-weekly-focus-btn"
                      onClick={() => setDetail({ kind: 'weeklyFocus' })}
                    >
                      {goal.weeklyFocus ||
                        'На чём сфокусироваться на этой неделе, чтобы продвинуть проект?'}
                      <span>✎</span>
                    </button>
                  </Card>
                  <Card title="Почему этот проект важен для меня" icon="motivation">
                    <button
                      className="gw-motivation"
                      onClick={() => setDetail({ kind: 'motivation' })}
                    >
                      {goal.motivation ||
                        'Добавьте свою причину — она поможет двигаться к проекту.'}
                      <span>✎</span>
                    </button>
                  </Card>
                  {activeStage && (
                    <Card title="Почему важен этот этап" icon="stageWhy">
                      <p className="gw-muted gw-stage-why-title">
                        {activeStage.name}
                      </p>
                      <button
                        className="gw-stage-why"
                        onClick={() => setDetail({ kind: 'stageWhy' })}
                      >
                        {activeStage.whyImportant ||
                          'Почему именно этот этап важен сейчас?'}
                        <span>✎</span>
                      </button>
                    </Card>
                  )}
                  <Card title="Фокус на эту неделю — измеримый" icon="weeklyFocusGoal">
                    {goal.weeklyFocusGoal ? (
                      <div className="gw-weekly-focus-goal">
                        <button
                          className="text-button"
                          onClick={() => setDetail({ kind: 'weeklyFocusGoal' })}
                        >
                          {goal.weeklyFocusGoal.text}
                          <span>✎</span>
                        </button>
                        <div className="gw-meter">
                          <span
                            style={{
                              width: `${Math.min(100, (goal.weeklyFocusGoal.done / Math.max(1, goal.weeklyFocusGoal.target)) * 100)}%`,
                            }}
                          />
                        </div>
                        <div className="gw-weekly-focus-goal-controls">
                          <button
                            className="gw-icon-button"
                            aria-label="Меньше"
                            disabled={goal.weeklyFocusGoal.done <= 0}
                            onClick={() =>
                              mutate((s) =>
                                saveGoal(s, {
                                  ...goal,
                                  weeklyFocusGoal: {
                                    ...goal.weeklyFocusGoal!,
                                    done: Math.max(
                                      0,
                                      goal.weeklyFocusGoal!.done - 1,
                                    ),
                                  },
                                }),
                              )
                            }
                          >
                            −
                          </button>
                          <span>
                            {goal.weeklyFocusGoal.done} из{' '}
                            {goal.weeklyFocusGoal.target}
                          </span>
                          <button
                            className="gw-icon-button"
                            aria-label="Больше"
                            disabled={
                              goal.weeklyFocusGoal.done >=
                              goal.weeklyFocusGoal.target
                            }
                            onClick={() =>
                              mutate((s) =>
                                saveGoal(s, {
                                  ...goal,
                                  weeklyFocusGoal: {
                                    ...goal.weeklyFocusGoal!,
                                    done: Math.min(
                                      goal.weeklyFocusGoal!.target,
                                      goal.weeklyFocusGoal!.done + 1,
                                    ),
                                  },
                                }),
                              )
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="gw-weekly-focus-btn"
                        onClick={() => setDetail({ kind: 'weeklyFocusGoal' })}
                      >
                        Задайте измеримую цель на неделю — например, число
                        тренировок.
                        <span>✎</span>
                      </button>
                    )}
                  </Card>
                  <Card title="Заметки" icon="notes">
                    <button
                      className="gw-goal-notes"
                      onClick={() => setDetail({ kind: 'notes' })}
                    >
                      {goal.notes ||
                        'Сохраните мысли, ссылки и детали, которые стоит держать под рукой при работе над проектом.'}
                      <span>✎</span>
                    </button>
                  </Card>
                  <Card title="История проекта">
                    {historyList(4)}
                    <button
                      className="text-button"
                      onClick={() => setTab('history')}
                    >
                      Все события →
                    </button>
                  </Card>
                  <Card title="WOOP" icon="woop">
                    <p className="gw-muted">
                      Желание → Результат → Препятствие → План.
                    </p>
                    {goal.woop &&
                    (goal.woop.wish ||
                      goal.woop.outcome ||
                      goal.woop.obstacle ||
                      goal.woop.plan) ? (
                      <dl className="gw-woop-list">
                        <div>
                          <dt>Желание</dt>
                          <dd>{goal.woop.wish || '—'}</dd>
                        </div>
                        <div>
                          <dt>Результат</dt>
                          <dd>{goal.woop.outcome || '—'}</dd>
                        </div>
                        <div>
                          <dt>Препятствие</dt>
                          <dd>{goal.woop.obstacle || '—'}</dd>
                        </div>
                        <div>
                          <dt>План</dt>
                          <dd>{goal.woop.plan || '—'}</dd>
                        </div>
                      </dl>
                    ) : null}
                    <button
                      className="text-button"
                      onClick={() => setDetail({ kind: 'woop' })}
                    >
                      {goal.woop ? 'Изменить' : '＋ Заполнить WOOP'}
                    </button>
                  </Card>
                  <Card title="Если-То план" icon="ifThen" className="gw-checkpoints">
                    <p className="gw-muted">
                      Заранее решите, как отреагировать на препятствие — так
                      проще не бросить на полпути.
                    </p>
                    <ul className="gw-checkpoint-list gw-if-then-list">
                      {(goal.ifThenRules ?? []).map((r) => (
                        <li key={r.id}>
                          <span>
                            <b>Если</b> {r.ifText} <b>→ то</b> {r.thenText}
                          </span>
                          <button
                            className="gw-icon-button"
                            aria-label={`Удалить правило: если ${r.ifText}`}
                            onClick={() =>
                              mutate((s) =>
                                removeGoalIfThenRule(s, goal.id, r.id),
                              )
                            }
                          >
                            ×
                          </button>
                        </li>
                      ))}
                      {!goal.ifThenRules?.length && (
                        <li className="gw-muted">Правил пока нет.</li>
                      )}
                    </ul>
                    {(goal.ifThenRules?.length ?? 0) < MAX_GOAL_IF_THEN_RULES && (
                      <form
                        className="gw-checkpoint-form gw-if-then-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const data = new FormData(form);
                          const ifText = String(data.get('ifText') ?? '');
                          const thenText = String(data.get('thenText') ?? '');
                          if (
                            mutate((s) =>
                              addGoalIfThenRule(s, goal.id, ifText, thenText),
                            )
                          )
                            form.reset();
                        }}
                      >
                        <input
                          name="ifText"
                          placeholder="Если… (например: не хочется идти на тренировку)"
                          maxLength={GOAL_IF_THEN_TEXT_MAX}
                          required
                        />
                        <input
                          name="thenText"
                          placeholder="То… (например: сделаю хотя бы 10 минут)"
                          maxLength={GOAL_IF_THEN_TEXT_MAX}
                          required
                        />
                        <button className="text-button" type="submit">
                          ＋ Добавить правило
                        </button>
                      </form>
                    )}
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
                ? stage
                  ? 'Заметки этапа'
                  : 'Заметки проекта'
                : detail?.kind === 'weeklyFocus'
                  ? 'Фокус на эту неделю'
                  : detail?.kind === 'finalResult'
                    ? 'Конечный результат'
                    : detail?.kind === 'stageWhy'
                      ? 'Почему важен этот этап'
                      : detail?.kind === 'weeklyFocusGoal'
                        ? 'Измеримый фокус недели'
                        : detail?.kind === 'woop'
                          ? 'WOOP'
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
              <h2>🏆 {stage ? 'Награды этапа' : 'Награды проекта'}</h2>
              <p>
                {stage
                  ? 'Награды этапа — это награды его задач; они начисляются при выполнении и не повторяются при завершении этапа.'
                  : `За достижение проекта предусмотрено ${goal.reward} XP. Лайфкоины начисляются за задачи по существующим правилам.`}
              </p>
              <p>
                За задачи: {xp} XP · {coins} лайфкоинов.
              </p>
              <p>
                {stage
                  ? group?.complete
                    ? 'Этап завершён'
                    : 'Этап ещё не завершён'
                  : goal.rewarded
                    ? 'Награда проекта получена'
                    : 'Награда проекта ещё не получена'}
              </p>
              {(stage ? stage.achievementTitle : goal.achievementTitle) && (
                <strong>
                  {stage ? stage.achievementTitle : goal.achievementTitle}
                </strong>
              )}
            </>
          )}
          {(detail?.kind === 'motivation' ||
            detail?.kind === 'notes' ||
            detail?.kind === 'weeklyFocus' ||
            detail?.kind === 'finalResult' ||
            detail?.kind === 'stageWhy') && (
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
                    : detail.kind === 'notes'
                      ? mutate((s) => saveGoal(s, { ...goal, notes: text }))
                      : detail.kind === 'weeklyFocus'
                        ? mutate((s) =>
                            saveGoal(s, { ...goal, weeklyFocus: text }),
                          )
                        : detail.kind === 'finalResult'
                          ? mutate((s) =>
                              saveGoal(s, { ...goal, finalResult: text }),
                            )
                          : detail.kind === 'stageWhy' && activeStage
                            ? mutate((s) =>
                                saveStage(s, goal.id, {
                                  ...activeStage,
                                  whyImportant: text,
                                }),
                              )
                            : mutate((s) =>
                                saveGoal(s, { ...goal, motivation: text }),
                              );
                if (saved) setDetail(null);
              }}
            >
              <h2>
                {detail.kind === 'notes'
                  ? stage
                    ? 'Заметки этапа'
                    : 'Заметки проекта'
                  : detail.kind === 'weeklyFocus'
                    ? 'Фокус на эту неделю'
                    : detail.kind === 'finalResult'
                      ? 'Конечный результат'
                      : detail.kind === 'stageWhy'
                        ? 'Почему важен этот этап'
                        : 'Почему этот проект важен для меня'}
              </h2>
              <label>
                Текст
                <textarea
                  autoFocus
                  name="text"
                  maxLength={
                    detail.kind === 'weeklyFocus'
                      ? GOAL_WEEKLY_FOCUS_MAX
                      : detail.kind === 'finalResult'
                        ? GOAL_FINAL_RESULT_MAX
                        : detail.kind === 'stageWhy'
                          ? STAGE_WHY_IMPORTANT_MAX
                          : detail.kind === 'notes'
                            ? GOAL_NOTES_MAX
                            : 2000
                  }
                  rows={8}
                  defaultValue={
                    detail.kind === 'notes'
                      ? (stage ? stage.notes : goal.notes) ?? ''
                      : detail.kind === 'weeklyFocus'
                        ? (goal.weeklyFocus ?? '')
                        : detail.kind === 'finalResult'
                          ? (goal.finalResult ?? '')
                          : detail.kind === 'stageWhy'
                            ? (activeStage?.whyImportant ?? '')
                            : (goal.motivation ?? '')
                  }
                />
              </label>
              <button className="primary-button" type="submit">
                Сохранить
              </button>
            </form>
          )}
          {detail?.kind === 'weeklyFocusGoal' && (
            <form
              className="planning-form"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                const text = String(data.get('text') ?? '').trim();
                const target = Math.max(1, Number(data.get('target')) || 1);
                if (!text) return;
                const saved = mutate((s) =>
                  saveGoal(s, {
                    ...goal,
                    weeklyFocusGoal: {
                      text,
                      target,
                      done: Math.min(goal.weeklyFocusGoal?.done ?? 0, target),
                    },
                  }),
                );
                if (saved) setDetail(null);
              }}
            >
              <h2>Фокус на эту неделю — измеримый</h2>
              <label>
                Что именно сделать
                <input
                  autoFocus
                  name="text"
                  maxLength={GOAL_WEEKLY_FOCUS_GOAL_TEXT_MAX}
                  defaultValue={goal.weeklyFocusGoal?.text ?? ''}
                  placeholder="Например: тренировки на этой неделе"
                  required
                />
              </label>
              <label>
                Сколько раз за неделю
                <input
                  name="target"
                  type="number"
                  min={1}
                  max={GOAL_WEEKLY_FOCUS_GOAL_TARGET_MAX}
                  defaultValue={goal.weeklyFocusGoal?.target ?? 3}
                  required
                />
              </label>
              <button className="primary-button" type="submit">
                Сохранить
              </button>
            </form>
          )}
          {detail?.kind === 'woop' && (
            <form
              className="planning-form"
              onSubmit={(e) => {
                e.preventDefault();
                const data = new FormData(e.currentTarget);
                const woop = {
                  wish: String(data.get('wish') ?? '').trim(),
                  outcome: String(data.get('outcome') ?? '').trim(),
                  obstacle: String(data.get('obstacle') ?? '').trim(),
                  plan: String(data.get('plan') ?? '').trim(),
                };
                const saved = mutate((s) => saveGoal(s, { ...goal, woop }));
                if (saved) setDetail(null);
              }}
            >
              <h2>WOOP</h2>
              <p className="gw-muted">
                Проверенная психологами техника достижения целей (Gabriele
                Oettingen): желание → результат → препятствие → план.
              </p>
              <label>
                Желание (Wish)
                <textarea
                  autoFocus
                  name="wish"
                  rows={2}
                  maxLength={GOAL_WOOP_FIELD_MAX}
                  defaultValue={goal.woop?.wish ?? ''}
                  placeholder="Чего вы хотите достичь в этом проекте?"
                />
              </label>
              <label>
                Результат (Outcome)
                <textarea
                  name="outcome"
                  rows={2}
                  maxLength={GOAL_WOOP_FIELD_MAX}
                  defaultValue={goal.woop?.outcome ?? ''}
                  placeholder="Как вы себя почувствуете, когда этого добьётесь?"
                />
              </label>
              <label>
                Препятствие (Obstacle)
                <textarea
                  name="obstacle"
                  rows={2}
                  maxLength={GOAL_WOOP_FIELD_MAX}
                  defaultValue={goal.woop?.obstacle ?? ''}
                  placeholder="Что внутри вас мешает этому больше всего?"
                />
              </label>
              <label>
                План (Plan)
                <textarea
                  name="plan"
                  rows={2}
                  maxLength={GOAL_WOOP_FIELD_MAX}
                  defaultValue={goal.woop?.plan ?? ''}
                  placeholder="Если наступит препятствие, то я..."
                />
              </label>
              <button className="primary-button" type="submit">
                Сохранить
              </button>
            </form>
          )}
        </div>
      </dialog>
      {detail?.kind === 'task' && !viewedTask && (
        <div className="pyl-overlay" onClick={(e) => e.target === e.currentTarget && setDetail(null)}>
          <div className="dialog-content" role="dialog" aria-modal="true" aria-label="Подробности задачи">
            <button className="icon-button modal-close" aria-label="Закрыть" onClick={() => setDetail(null)}>×</button>
            <p className="gw-muted">
              Эта задача больше не находится в проекте. Закройте окно и выберите
              доступный шаг.
            </p>
          </div>
        </div>
      )}
      {detail?.kind === 'task' && viewedTask && (
        <TaskWindow
          ownerId={p.ownerId}
          taskId={viewedTask.id}
          state={state}
          today={today}
          onChange={p.onChange}
          notify={p.onNotify}
          onClose={() => setDetail(null)}
          onAdvanced={(task) => p.onEditTask(task)}
          onProgress={(task) => { setDetail(null); startProgress(task); }}
          onComplete={(task) => { if (finish(task)) setDetail(null); }}
          onUndo={undoFinish}
          onDelete={deleteTask}
          onDuplicate={duplicateTask}
          onTransfer={(task) => p.onTransfer(task)}
          onPractice={goal.projectReview ? beginPractice : undefined}
        />
      )}
      {progress && (
        <div className="pyl-overlay">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="goal-progress-title"
            onSubmit={(e) => {
              e.preventDefault();
              saveProgress(progress, progressValue);
            }}
          >
            <h2 id="goal-progress-title">{progress.name}</h2>
            <label>
              Выполнено ({progress.unit || 'шагов'})
              <input
                autoFocus
                type="number"
                required
                min={progress.currentValue ?? 0}
                max={progress.targetValue ?? 1}
                step="any"
                value={progressValue}
                onChange={(e) => setProgressValue(e.target.valueAsNumber)}
              />
            </label>
            <p>
              Цель: {progress.targetValue ?? 1} {progress.unit}
            </p>
            <footer>
              <button type="button" onClick={() => setProgress(null)}>
                Отмена
              </button>
              <button className="primary-button">Сохранить прогресс</button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => saveProgress(progress, progress.targetValue ?? 1)}
              >
                Выполнить полностью
              </button>
            </footer>
          </form>
        </div>
      )}
      {reviewOpen && !goal.projectReview && (
        <ProjectCompletionDialog
          state={state}
          goal={goal}
          onSave={(next) => p.onChange(next)}
          onClose={() => setReviewOpen(false)}
          onNotify={p.onNotify}
        />
      )}
    </div>
  );
}
