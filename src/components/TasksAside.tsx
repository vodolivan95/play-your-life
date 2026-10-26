import { spheres, streak as calcStreak, hasClockTime } from '../game';
import type { GameState, Quest } from '../game';
import { goalProgressValue } from '../goalWorkspace';
import { isGoalDone } from '../goalsOverview';
import { pluralDays } from '../goalsOverview';
import { questCoins } from '../personalQuests';
import { addDays, mondayOf } from '../tasksCalendar';
import './TasksAside.css';

const steps = [
  'Задача из TickTick приходит во входящие, пока ты её не разберёшь.',
  'Ты выбираешь сферу, цель и этап. Цель можно создать на месте.',
  'Отметка в игре отмечает задачу и в TickTick. Награда приходит один раз.',
  'Цели и этапы живут только в игре и в TickTick не уходят.',
];

function questDay(q: Quest) {
  return (q.dueAt ?? q.startsAt)?.slice(0, 10);
}
function questTime(q: Quest) {
  const at = q.startsAt ?? q.dueAt;
  return at && hasClockTime(at) ? at.slice(11, 16) : null;
}
function countdown(day: string, time: string | null, now: Date) {
  const target = new Date(`${day}T${time ?? '23:59'}:00`);
  const minutes = Math.round((target.getTime() - now.getTime()) / 60000);
  if (minutes <= 0) return 'сейчас';
  if (minutes < 60) return `через ${minutes} мин`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `через ${hours} ч` : `через ${Math.round(hours / 24)} дн.`;
}
function goalFraction(state: GameState, goal: GameState['goals'][number]) {
  const tasks = state.quests.filter((q) => q.goalId === goal.id && q.required !== false);
  if (goal.progressMode === 'tasks' && tasks.length) {
    return `${tasks.filter((q) => q.done).length} / ${tasks.length}`;
  }
  return `${goal.current} / ${goal.target}`;
}

export default function TasksAside({ state, quests, today }: { state: GameState; quests: Quest[]; today: string }) {
  const now = new Date();
  const done = quests.filter((q) => q.done).length;
  const total = quests.length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const circ = 2 * Math.PI * 42;

  const weekStart = mondayOf(today);
  const weekEnd = addDays(weekStart, 6);
  const weekQuests = quests.filter((q) => {
    const day = questDay(q);
    return !!day && day >= weekStart && day <= weekEnd;
  });
  const weekTotal = weekQuests.length;

  const upcoming = quests
    .filter((q) => !q.done && questDay(q) === today)
    .sort((a, b) => (a.startsAt ?? a.dueAt ?? '').localeCompare(b.startsAt ?? b.dueAt ?? ''));

  const bySphere = spheres
    .map((s) => ({ sphere: s, count: weekQuests.filter((q) => q.sphere === s.id).length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
  const maxCount = bySphere[0]?.count ?? 0;

  const currentStreak = calcStreak(state.activeDates, now);

  const donutR = 32;
  const donutCirc = 2 * Math.PI * donutR;
  const donutTop = bySphere.slice(0, 5);
  const segments = donutTop.reduce<{ sphere: (typeof donutTop)[number]['sphere']; count: number; pct: number; dash: number; offset: number }[]>((acc, { sphere, count }) => {
    const frac = weekTotal ? count / weekTotal : 0;
    const offset = acc.length ? acc[acc.length - 1].offset + acc[acc.length - 1].dash : 0;
    acc.push({ sphere, count, pct: Math.round(frac * 100), dash: frac * donutCirc, offset });
    return acc;
  }, []);
  const leader = segments[0];
  const silentSpheres = spheres.length - bySphere.length;

  const weekCoins = quests
    .filter((q) => q.done && q.completedAt && q.completedAt.slice(0, 10) >= weekStart && q.completedAt.slice(0, 10) <= weekEnd)
    .reduce((sum, q) => sum + questCoins(q), 0);

  const activeGoals = state.goals
    .filter((g) => !isGoalDone(g))
    .map((g) => ({ goal: g, percent: Math.round(goalProgressValue(state, g)), sphere: spheres.find((s) => s.id === g.sphere) }))
    .sort((a, b) => b.percent - a.percent)
    .slice(0, 3);

  return (
    <aside className="tas" aria-label="Сводка">
      <section className="tas-card tas-progress">
        <svg viewBox="0 0 100 100" width="96" height="96" role="img" aria-label={`Выполнено ${done} из ${total}`}>
          <circle cx="50" cy="50" r="42" className="tas-ring-bg" />
          <circle cx="50" cy="50" r="42" className="tas-ring" strokeDasharray={`${(circ * percent) / 100} ${circ}`} transform="rotate(-90 50 50)" />
          <text x="50" y="57" textAnchor="middle">{percent}%</text>
        </svg>
        <div><strong>Прогресс</strong><span>Выполнено {done} из {total}</span></div>
      </section>

      <section className="tas-card">
        <div className="tas-row"><strong>Дальше сегодня</strong>{upcoming.length > 0 && <b className="tas-count">{upcoming.length}</b>}</div>
        {upcoming.length === 0 ? (
          <p>На сегодня задач без выполнения не осталось.</p>
        ) : (
          <ul className="tas-focus">
            {upcoming.slice(0, 4).map((q) => {
              const day = questDay(q) ?? today;
              const time = questTime(q);
              const sphere = spheres.find((s) => s.id === q.sphere);
              return (
                <li key={q.id}>
                  <span className="tas-focus-time">{time && <b>{time}</b>}{countdown(day, time, now)}</span>
                  <span className="tas-focus-name">{q.name}<small>{sphere?.name}</small></span>
                  <span className="tas-focus-dot" style={{ background: sphere?.color }} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="tas-card">
        <strong>Нагрузка недели</strong>
        {bySphere.length === 0 ? (
          <p>На этой неделе ещё нет запланированных задач.</p>
        ) : (
          <div className="tas-bars">
            {bySphere.slice(0, 4).map(({ sphere, count }) => (
              <div className="tas-bar-row" key={sphere.id}>
                <span className="tas-bar-sphere">{sphere.name}</span>
                <span className="tas-bar-track"><span className="tas-bar-fill" style={{ width: `${(count / maxCount) * 100}%`, background: sphere.color }} /></span>
                <span className="tas-bar-count">{count}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="tas-streak">
        <span><span aria-hidden="true">🔥</span>Задачи без пропуска</span>
        <b>{pluralDays(currentStreak)}</b>
      </div>

      <section className="tas-card">
        <strong>Сферы на этой неделе</strong>
        {weekTotal === 0 ? (
          <p>На этой неделе ещё нет запланированных задач.</p>
        ) : (
          <>
            <div className="tas-donut-wrap">
              <svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label="Доли сфер на этой неделе">
                <g transform="translate(44,44) rotate(-90)">
                  {segments.map((seg) => (
                    <circle key={seg.sphere.id} r={donutR} fill="none" stroke={seg.sphere.color} strokeWidth="14" strokeDasharray={`${seg.dash} ${donutCirc - seg.dash}`} strokeDashoffset={-seg.offset} />
                  ))}
                </g>
              </svg>
              <ul className="tas-legend">
                {segments.map((seg) => (
                  <li key={seg.sphere.id}><span className="tas-focus-dot" style={{ background: seg.sphere.color }} />{seg.sphere.name}<b>{seg.pct}%</b></li>
                ))}
              </ul>
            </div>
            {leader && (
              <p className="tas-insight">
                Перекос в «{leader.sphere.name}» — {leader.count} из {weekTotal} задач.
                {silentSpheres > 0 && ` Остальные ${silentSpheres} ${pluralSpheres(silentSpheres)} не представлены на этой неделе.`}
              </p>
            )}
          </>
        )}
      </section>

      <section className="tas-card">
        <strong>Лайфкоины недели</strong>
        <div className="tas-coins">{weekCoins}<span>за эту неделю</span></div>
        <p>Сумма наград за задачи, выполненные с понедельника.</p>
      </section>

      <section className="tas-card">
        <strong>Цели в работе</strong>
        {activeGoals.length === 0 ? (
          <p>Нет целей в работе — заведи первую на доске целей.</p>
        ) : (
          <div className="tas-goals">
            {activeGoals.map(({ goal, percent: p, sphere }) => (
              <div className="tas-goal" key={goal.id}>
                <div className="tas-goal-top"><span>{goal.name}</span><b>{goalFraction(state, goal)}</b></div>
                <span className="tas-goal-track"><span className="tas-goal-fill" style={{ width: `${p}%`, background: sphere?.color }} /></span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="tas-card">
        <strong>Как это работает</strong>
        <ol>{steps.map((t) => <li key={t}>{t}</li>)}</ol>
      </section>
    </aside>
  );
}

function pluralSpheres(count: number) {
  const n = Math.abs(count) % 100;
  const last = n % 10;
  if (n > 10 && n < 20) return 'сфер';
  if (last === 1) return 'сфера';
  if (last >= 2 && last <= 4) return 'сферы';
  return 'сфер';
}
