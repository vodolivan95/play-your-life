import { useContext, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { spheres } from '../game';
import type { GameState } from '../game';
import { completeHabit, habitIcons, removeHabit, saveHabit, MAX_DAILY_HABIT_COINS } from '../personalQuests';
import type { Habit, HabitCompletion } from '../personalQuests';
import {
  dayStatus,
  doneDays,
  habitStats,
  isScheduled,
  lastDays,
  liveStreak,
  mondayIndex,
  monthCells,
  weekPercent,
  weekRows,
} from '../habitsView';
import type { CalendarCell } from '../habitsView';
import { TickTickHabitsContext } from '../tickTickContext';
import TickTickHabits from './TickTickHabits';
import { extraText, syncedText } from '../ticktickHabits';
import './HabitsPage.css';

const WEEK: [string, number][] = [['Пн', 1], ['Вт', 2], ['Ср', 3], ['Чт', 4], ['Пт', 5], ['Сб', 6], ['Вс', 0]];
const WEEK_LONG = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const RANGES = [['week', 'Неделя'], ['fortnight', '2 недели'], ['month', 'Месяц'], ['quarter', '3 месяца']] as const;
type Range = (typeof RANGES)[number][0];
const COINS = [0, 2, 5, MAX_DAILY_HABIT_COINS];

const sphereOf = (id: string) => spheres.find((s) => s.id === id) ?? spheres[0];
const iconOf = (id: string) => habitIcons.find((i) => i[0] === id)?.[1] ?? '✅';
const dayLabel = (day: string) => `${+day.slice(8)} ${MONTHS[+day.slice(5, 7) - 1]}`;
const daysWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'день' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'дня' : 'дней');

const Check = ({ size = 24 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
);
/** Огонёк-персонаж лучшей серии. */
function Flame() {
  return (
    <svg className="hb-flame" viewBox="0 0 100 122" width="88" height="107" aria-hidden="true">
      <defs>
        <linearGradient id="hbFlOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#D32F2F" /><stop offset=".5" stopColor="#F26B1D" /><stop offset="1" stopColor="#FF9A1F" /></linearGradient>
        <linearGradient id="hbFlIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFB22E" /><stop offset="1" stopColor="#FFE94D" /></linearGradient>
      </defs>
      <ellipse cx="50" cy="116" rx="30" ry="4.5" fill="#000" fillOpacity=".3" />
      <path d="M50 4C54 20 60 28 66 40L75 28C80 42 89 56 89 76C89 98 72 113 50 113C28 113 11 98 11 76C11 62 15 52 21 41L25 56L34 56C32 40 42 24 50 4Z" fill="url(#hbFlOut)" stroke="#8E1B12" strokeWidth="3" strokeLinejoin="round" />
      <path d="M50 42C60 58 79 66 79 83C79 99 66 107 50 107C34 107 21 99 21 83C21 66 40 58 50 42Z" fill="url(#hbFlIn)" />
      <path d="M31 70c4-5 9-5 13-2M56 68c4-3 9-3 13 2" stroke="#8E1B12" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <ellipse cx="40" cy="80" rx="7.5" ry="9" fill="#fff" stroke="#8E1B12" strokeWidth="2" /><ellipse cx="60" cy="80" rx="7.5" ry="9" fill="#fff" stroke="#8E1B12" strokeWidth="2" />
      <ellipse cx="41" cy="81" rx="4.2" ry="5.4" fill="#6B2418" /><ellipse cx="59" cy="81" rx="4.2" ry="5.4" fill="#6B2418" />
      <circle cx="42.5" cy="78.5" r="1.7" fill="#fff" /><circle cx="60.5" cy="78.5" r="1.7" fill="#fff" />
      <path d="M37 93Q50 101 63 93Q61 106 50 106Q39 106 37 93Z" fill="#E4505C" stroke="#8E1B12" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M39 94Q50 98 61 94" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}
function Ring({ done, total }: { done: number; total: number }) {
  const circ = 2 * Math.PI * 29;
  const dash = total ? (circ * done) / total : 0;
  return (
    <div className="hb-ring" role="img" aria-label={`Сегодня выполнено ${done} из ${total}`}>
      <svg viewBox="0 0 72 72" width="92" height="92" aria-hidden="true">
        <defs>
          <linearGradient id="hbRgS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7BE495" /><stop offset="1" stopColor="#1FB955" /></linearGradient>
          <radialGradient id="hbRgF" cx=".5" cy=".35" r=".8"><stop offset="0" stopColor="#2f4a4f" /><stop offset="1" stopColor="#1b2a3c" /></radialGradient>
        </defs>
        <circle cx="36" cy="36" r="29" fill="url(#hbRgF)" />
        <circle cx="36" cy="36" r="29" fill="none" stroke="#fff" strokeOpacity=".1" strokeWidth="8" />
        <circle cx="36" cy="36" r="29" fill="none" stroke="url(#hbRgS)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${dash.toFixed(1)} ${circ.toFixed(1)}`} transform="rotate(-90 36 36)" />
      </svg>
      <span>{done}/{total}</span>
    </div>
  );
}

type FormValue = { id?: string; title: string; iconId: string; sphere: string; weekdays: number[]; targetValue: number; unit: string; rewardCoins: number; locked: boolean };
const emptyForm = (): FormValue => ({ title: '', iconId: habitIcons[0][0], sphere: spheres[0].id, weekdays: [0, 1, 2, 3, 4, 5, 6], targetValue: 1, unit: 'раз', rewardCoins: 5, locked: false });

function HabitForm({ value, onClose, onSave }: { value: FormValue; onClose: () => void; onSave: (v: FormValue) => void }) {
  const [v, setV] = useState(value);
  const set = (patch: Partial<FormValue>) => setV((cur) => ({ ...cur, ...patch }));
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  const sp = sphereOf(v.sphere);
  const ok = v.title.trim().length > 0 && v.weekdays.length > 0 && v.targetValue > 0;
  return (
    <div className="hb-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="hb-form" role="dialog" aria-modal="true" aria-label={v.id ? 'Изменить привычку' : 'Новая привычка'} onSubmit={(e) => { e.preventDefault(); if (ok) onSave(v); }}>
        <header className="hb-form-top">
          <button type="button" className="hb-link" onClick={onClose}>Отмена</button>
          <strong>{v.id ? 'Изменить привычку' : 'Новая привычка'}</strong>
          <button type="submit" className="hb-link is-strong" disabled={!ok}>Готово</button>
        </header>
        <div className="hb-form-head">
          <span className="hb-form-icon" style={{ background: `linear-gradient(180deg, ${sp.color}, ${sp.color}cc)` }} aria-hidden="true">{iconOf(v.iconId)}</span>
          <label className="hb-field">
            <span>Название</span>
            <input type="text" value={v.title} maxLength={100} required aria-required="true" aria-invalid={!v.title.trim()} placeholder="Например, «Читать 20 страниц»" onChange={(e) => set({ title: e.target.value })} autoFocus />
            {!v.title.trim() && <small className="hb-note" role="status">Введите название привычки.</small>}
          </label>
        </div>
        <fieldset className="hb-group"><legend>Иконка</legend>
          <div className="hb-chips">
            {habitIcons.map(([id, icon, name]) => (
              <button key={id} type="button" className={`hb-chip hb-chip-icon${v.iconId === id ? ' is-on' : ''}`} aria-pressed={v.iconId === id} aria-label={name} title={name} onClick={() => set({ iconId: id })}>{icon}</button>
            ))}
          </div>
        </fieldset>
        <fieldset className="hb-group"><legend>Сфера жизни</legend>
          <div className="hb-chips">
            {spheres.map((s) => (
              <button key={s.id} type="button" className={`hb-chip${v.sphere === s.id ? ' is-on' : ''}`} aria-pressed={v.sphere === s.id} disabled={v.locked && v.sphere !== s.id} onClick={() => set({ sphere: s.id })}><i style={{ background: s.color }} />{s.name}</button>
            ))}
          </div>
          {v.locked && <p className="hb-note">Сфера и награда зафиксированы после первого выполнения.</p>}
        </fieldset>
        <fieldset className="hb-group"><legend>Расписание</legend>
          <div className="hb-days">
            {WEEK.map(([label, n]) => (
              <button key={n} type="button" className={`hb-day${v.weekdays.includes(n) ? ' is-on' : ''}`} aria-pressed={v.weekdays.includes(n)} onClick={() => set({ weekdays: v.weekdays.includes(n) ? v.weekdays.filter((d) => d !== n) : [...v.weekdays, n] })}>{label}</button>
            ))}
          </div>
        </fieldset>
        <div className="hb-form-row">
          <label className="hb-field"><span>Цель за день</span><input type="number" min={1} max={1000000} value={v.targetValue} onChange={(e) => set({ targetValue: Number(e.target.value) })} /></label>
          <label className="hb-field"><span>Единица</span><input type="text" value={v.unit} maxLength={30} onChange={(e) => set({ unit: e.target.value })} /></label>
        </div>
        <fieldset className="hb-group"><legend>Награда за день</legend>
          <div className="hb-levels">
            {COINS.map((c) => (
              <button key={c} type="button" className={`hb-level${v.rewardCoins === c ? ' is-on' : ''}`} aria-pressed={v.rewardCoins === c} disabled={v.locked && v.rewardCoins !== c} onClick={() => set({ rewardCoins: c })}><strong>{c}</strong><span>монет</span></button>
            ))}
          </div>
          <p className="hb-note">Каждое выполнение даёт ещё 5 XP в выбранную сферу.</p>
        </fieldset>
        {v.title.trim() && !ok && <p className="hb-note" role="status">{v.weekdays.length === 0 ? 'Выберите хотя бы один день расписания.' : 'Цель за день должна быть больше нуля.'}</p>}
        <button type="submit" className="hb-create" disabled={!ok}>{v.id ? 'Сохранить привычку' : 'Создать привычку'}</button>
      </form>
    </div>
  );
}

export default function HabitsPage({ state, onChange, ownerId, today, notify }: { state: GameState; onChange: Dispatch<SetStateAction<GameState>>; ownerId: string; today: string; notify: (s: string) => void }) {
  const [openId, setOpenId] = useState('');
  const [range, setRange] = useState<Range>('month');
  const [form, setForm] = useState<FormValue | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const history: HabitCompletion[] = useMemo(() => state.habitCompletions ?? [], [state.habitCompletions]);
  const habits = useMemo(() => (state.habits ?? []).filter((h) => h.ownerId === ownerId && h.isActive), [state.habits, ownerId]);
  // Дни, импортированные из TickTick, видны в календаре и сериях, но наград не дают.
  const tt = useContext(TickTickHabitsContext);
  const external = tt?.external;
  const [onlyTickTick, setOnlyTickTick] = useState(false);
  const linkOf = (h: Habit) => tt?.links.links[h.id];
  const remoteOf = (h: Habit) => tt?.remote.find((r) => r.ticktickHabitId === linkOf(h)?.ticktickHabitId);
  const doneMap = useMemo(() => new Map(habits.map((h) => [h.id, doneDays(h, history, external?.get(h.id))])), [habits, history, external]);
  const doneOf = (h: Habit) => doneMap.get(h.id) ?? new Set<string>();
  const dueToday = habits.filter((h) => isScheduled(h, today));
  const doneToday = dueToday.filter((h) => doneOf(h).has(today)).length;
  const streakOf = (h: Habit) => liveStreak(h, doneOf(h), today);
  const best = Math.max(0, ...habits.map(streakOf));
  const percent = weekPercent(habits, history, today, external);
  const open = habits.find((h) => h.id === openId);

  const run = (make: () => GameState, message?: string) => {
    try {
      onChange(make());
      if (message) notify(message);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Не удалось выполнить действие');
      return false;
    }
  };
  const complete = (h: Habit) => run(() => completeHabit(state, h.id, ownerId), `Привычка выполнена: ${h.title}`);
  const save = (v: FormValue) => {
    const ok = run(() => saveHabit(state, { id: v.id, title: v.title, sphere: v.sphere, iconId: v.iconId, targetValue: v.targetValue, unit: v.unit, weekdays: v.weekdays, rewardCoins: v.rewardCoins }, ownerId), v.id ? 'Привычка сохранена' : 'Привычка создана');
    if (ok) setForm(null);
  };
  const edit = (h: Habit) => setForm({ id: h.id, title: h.title, iconId: h.iconId, sphere: h.sphere, weekdays: h.weekdays, targetValue: h.targetValue, unit: h.unit, rewardCoins: h.rewardCoins, locked: h.rewardLocked });

  const cells = (): CalendarCell[] => {
    if (range === 'month') return monthCells(today);
    if (range === 'quarter') return weekRows(today, 13);
    return lastDays(today, range === 'week' ? 7 : 14).map((day) => ({ day, num: +day.slice(8), blank: false, future: false, isToday: day === today }));
  };
  const monthTitle = `${MONTHS_NOM[+today.slice(5, 7) - 1]} ${today.slice(0, 4)}`;
  const rangeTitle = { week: 'Последние 7 дней', fortnight: 'Последние 14 дней', month: monthTitle, quarter: 'Последние 3 месяца' }[range];
  const rangeHint = range === 'quarter' ? 'чем зеленее, тем больше выполнено' : 'точки — выполненные привычки';

  const dayCell = (c: CalendarCell) => {
    const dots = habits.flatMap((h) => {
      const status = dayStatus(h, doneOf(h), c.day, today);
      return status === 'done' || status === 'missed' || status === 'open' ? [{ h, done: status === 'done' }] : [];
    });
    const n = dots.filter((d) => d.done).length;
    const full = dots.length > 0 && n === dots.length && !c.future;
    if (range === 'quarter') {
      const level = dots.length ? Math.ceil((n / dots.length) * 3) : 0;
      return <div key={c.day} className={`hb-q hb-q${c.future ? 'f' : level}${c.isToday ? ' is-today' : ''}`} title={`${dayLabel(c.day)}: ${n} из ${dots.length}`}>{c.num === 1 ? MONTHS_NOM[+c.day.slice(5, 7) - 1].slice(0, 3) : c.num}</div>;
    }
    return (
      <div key={c.day} className={`hb-cell${c.isToday ? ' is-today' : ''}${full ? ' is-full' : ''}${c.future ? ' is-future' : ''}`} title={`${dayLabel(c.day)}: ${n} из ${dots.length}`}>
        {range !== 'month' && <small>{WEEK_LONG[mondayIndex(c.day)].slice(0, 2)}</small>}
        <span>{c.num}</span>
        <span className="hb-dots">{dots.map((d) => <i key={d.h.id} style={{ background: d.done ? sphereOf(d.h.sphere).color : undefined }} />)}</span>
      </div>
    );
  };

  /* ───── окно привычки ───── */
  if (open) {
    const sp = sphereOf(open.sphere);
    const done = doneOf(open);
    const stats = habitStats(open, history, today, 90, external?.get(open.id));
    const streak = streakOf(open);
    const monthDone = monthCells(today).filter((c) => !c.blank && done.has(c.day)).length;
    const monthSoFar = monthCells(today).filter((c) => !c.blank && !c.future && isScheduled(open, c.day)).length;
    const due = isScheduled(open, today);
    const doneNow = done.has(today);
    const sched = open.weekdays.length === 7 ? 'каждый день' : open.weekdays.length === 5 && ![0, 6].some((d) => open.weekdays.includes(d)) ? 'по будням' : WEEK.filter(([, n]) => open.weekdays.includes(n)).map(([l]) => l).join(', ');
    return (
      <div className="hb-page hb-detail">
        <button type="button" className="hb-back" onClick={() => { setOpenId(''); setConfirmDelete(false); }}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>Привычки
        </button>
        <header className="hb-d-head">
          <span className="hb-d-icon" style={{ background: `linear-gradient(180deg, ${sp.color}, ${sp.color}cc)` }} aria-hidden="true">{iconOf(open.iconId)}</span>
          <div className="hb-d-title"><h1>{open.title}</h1><span><i style={{ background: sp.color }} />{sp.name} · {sched} · цель {open.targetValue} {open.unit}</span>
            {linkOf(open) && <span className="tth-synced">Источник: TickTick{tt?.lastSyncAt ? ` · Синхронизировано: ${syncedText(tt.lastSyncAt)}` : ''}</span>}</div>
          <button type="button" className={`hb-d-check${doneNow ? ' is-done' : ''}`} aria-pressed={doneNow} disabled={doneNow || !due} onClick={() => complete(open)}>
            <Check size={22} />{doneNow ? 'Выполнено сегодня' : due ? 'Отметить сегодня' : 'Сегодня не по расписанию'}
          </button>
        </header>
        <section className="hb-d-stats">
          <div><small>Серия</small><strong className="is-fire">{streak} {daysWord(streak)}</strong></div>
          <div><small>Лучшая серия</small><strong>{Math.max(open.bestStreak, streak)} {daysWord(Math.max(open.bestStreak, streak))}</strong></div>
          <div><small>В этом месяце</small><strong>{monthDone} из {monthSoFar}</strong></div>
          <div><small>Награда за день</small><strong className="is-xp">+{open.rewardXp} XP{open.rewardCoins ? ` · ${open.rewardCoins} 🪙` : ''}</strong></div>
        </section>
        <div className="hb-d-grid">
          <section className="hb-card hb-d-cal" aria-label="Календарь привычки">
            <strong>{monthTitle}</strong>
            <div className="hb-cal-head">{WEEK.map(([l]) => <span key={l}>{l}</span>)}</div>
            <div className="hb-cal-grid hb-cal-big">
              {monthCells(today).map((c, i) => {
                if (c.blank) return <i key={`b${i}`} className="hb-cal-blank" aria-hidden="true" />;
                const status = dayStatus(open, done, c.day, today);
                return <div key={c.day} className={`hb-d-day is-${status}${c.isToday ? ' is-today' : ''}`} style={status === 'done' ? { background: sp.color, borderColor: sp.color } : undefined}>{c.num}</div>;
              })}
            </div>
          </section>
          <aside className="hb-d-side">
            <section className="hb-card"><strong>Расписание</strong>
              <div className="hb-days is-static">{WEEK.map(([l, n]) => <span key={n} className={`hb-day${open.weekdays.includes(n) ? ' is-on' : ''}`} style={open.weekdays.includes(n) ? { background: sp.color } : undefined}>{l}</span>)}</div>
              <dl className="hb-dl"><div><dt>Цель за день</dt><dd>{open.targetValue} {open.unit}</dd></div><div><dt>Сфера</dt><dd>{sp.name}</dd></div></dl>
            </section>
            {linkOf(open) && remoteOf(open) && extraText(remoteOf(open)!) && (
              <section className="hb-card"><strong>Из TickTick</strong>
                <p className="hb-note">{extraText(remoteOf(open)!)}</p>
              </section>
            )}
            <div className="hb-d-actions">
              <button type="button" className="hb-btn" onClick={() => edit(open)}>Изменить</button>
              <button type="button" className="hb-btn is-danger" onClick={() => run(() => saveHabit(state, { ...open, isActive: false }, ownerId), 'Привычка в архиве') && setOpenId('')}>В архив</button>
            </div>
            {!confirmDelete ? <button type="button" className="hb-btn is-ghost" onClick={() => setConfirmDelete(true)}>Удалить навсегда</button> : (
              <div className="hb-confirm" role="alertdialog" aria-label="Удалить привычку">
                <p>Удалить «{open.title}» и её историю? Уже выплаченные награды останутся.</p>
                <div><button type="button" className="hb-btn is-danger" onClick={() => { if (run(() => removeHabit(state, open.id, ownerId), 'Привычка удалена')) { setOpenId(''); setConfirmDelete(false); } }}>Удалить</button><button type="button" className="hb-btn" onClick={() => setConfirmDelete(false)}>Отмена</button></div>
              </div>
            )}
          </aside>
        </div>
        <section className="hb-card hb-stats" aria-label="Статистика привычки">
          <div className="hb-stats-head"><strong>Статистика</strong><span>последние 90 дней</span></div>
          <div className="hb-tiles">
            <div><small>Выполнено</small><b>{stats.done} из {stats.scheduled}</b></div>
            <div><small>Процент</small><b className="is-green">{stats.percent}%</b></div>
            <div><small>Пропусков</small><b className="is-red">{stats.missed}</b></div>
            <div><small>Лучший день</small><b>{stats.bestWeekday >= 0 ? WEEK_LONG[stats.bestWeekday] : '—'}</b></div>
            <div><small>В неделю</small><b>{stats.perWeek}</b></div>
            <div><small>Заработано</small><b className="is-xp">{stats.xp} XP</b></div>
          </div>
          <div className="hb-charts">
            <div><h3>По дням недели</h3>
              <div className="hb-bars">{stats.weekdayPercent.map((p, i) => <div key={i}><span>{p}%</span><i style={{ height: `${Math.max(4, p)}px`, background: p >= 50 ? sp.color : undefined }} /><small>{WEEK[i][0]}</small></div>)}</div>
            </div>
            <div><h3>Динамика по неделям</h3>
              <div className="hb-bars is-weeks">{stats.weeks.map((w) => <div key={w.start}><span>{w.percent}%</span><i style={{ height: `${Math.max(4, w.percent)}px`, background: w.percent >= 50 ? sp.color : undefined }} /><small>{+w.start.slice(8)} {MONTHS[+w.start.slice(5, 7) - 1].slice(0, 3)}</small></div>)}</div>
            </div>
          </div>
        </section>
        {form && <HabitForm value={form} onClose={() => setForm(null)} onSave={save} />}
      </div>
    );
  }

  /* ───── список ───── */
  const left = dueToday.length - doneToday;
  return (
    <div className="hb-page">
      <header className="hb-head">
        <div><h1>Привычки</h1><p>Маленькие шаги к большим переменам.</p></div>
        <button type="button" className="hb-add" onClick={() => setForm(emptyForm())}>＋ Новая привычка</button>
      </header>
      <section className="hb-summary" aria-label="Сводка">
        <div className="hb-sum"><Ring done={doneToday} total={dueToday.length} /><div><strong>Сегодня</strong><span>{!dueToday.length ? 'На сегодня ничего не запланировано' : left === 0 ? 'Все привычки выполнены' : `Осталось ${left}`}</span></div></div>
        <div className="hb-sum is-flame"><Flame /><div><strong>{best} {daysWord(best)}</strong><span>Лучшая серия сейчас</span></div></div>
        <div className="hb-sum"><span className="hb-sum-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="3.5" /><path d="M8 3v4M16 3v4M3.5 10h17" /><path d="M8.5 15l2.3 2.3 4.7-5" /></svg></span><div><strong>{percent}%</strong><span>Выполнено за неделю</span></div></div>
      </section>
      <TickTickHabits habits={habits} onArchive={(id) => { const h = (state.habits ?? []).find((x) => x.id === id); if (h) run(() => saveHabit(state, { ...h, isActive: false }, ownerId), 'Привычка скрыта'); }} />
      {!habits.length ? (
        <section className="hb-empty"><h2>Привычек пока нет</h2><p>Создай первую: выбери сферу, дни и награду, а игра будет считать серии и показывать календарь.</p><button type="button" className="hb-add" onClick={() => setForm(emptyForm())}>＋ Новая привычка</button></section>
      ) : (
        <div className="hb-body">
          <section className="hb-list" aria-label="Привычки">
            <div className="hb-list-head"><span>Привычка</span><span>7 дней</span><span>Серия</span><span /></div>
            {tt && Object.keys(tt.links.links).length > 0 && <button type="button" className="tth-filter" aria-pressed={onlyTickTick} onClick={() => setOnlyTickTick(!onlyTickTick)}>Только TickTick</button>}
            {habits.filter((h) => !onlyTickTick || linkOf(h)).map((h) => {
              const sp = sphereOf(h.sphere);
              const done = doneOf(h);
              const due = isScheduled(h, today);
              const doneNow = done.has(today);
              const streak = streakOf(h);
              return (
                <div key={h.id} className={`hb-row${doneNow ? ' is-done' : ''}`}>
                  <button type="button" className="hb-row-main" onClick={() => setOpenId(h.id)} aria-label={`Открыть: ${h.title}`}>
                    <span className="hb-row-icon" style={{ background: `linear-gradient(180deg, ${sp.color}, ${sp.color}cc)` }} aria-hidden="true">{iconOf(h.iconId)}</span>
                    <span className="hb-row-text"><strong>{h.title}{linkOf(h) && <span className="tth-source" title={tt?.lastSyncAt ? `Синхронизировано: ${syncedText(tt.lastSyncAt)}` : undefined}>TickTick</span>}</strong><small><i style={{ background: sp.color }} />{sp.name}</small></span>
                    <span className="hb-row-days" aria-hidden="true">{lastDays(today, 7).map((day) => <i key={day} className={`is-${dayStatus(h, done, day, today)}${day === today ? ' is-today' : ''}`} />)}</span>
                    <span className="hb-row-streak"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 2.5c.9 3.2 4.3 4.3 4.3 8.3a4.3 4.3 0 0 1-8.6 0c0-2.1 1-3.4 2.2-4.3 0 2 1 2.5 1.2 2.5.2-2.2-.9-3.7.9-6.5z" fill="currentColor" /></svg>{streak}</span>
                  </button>
                  <button type="button" className={`hb-check${doneNow ? ' is-done' : ''}`} aria-pressed={doneNow} aria-label={doneNow ? `Выполнено: ${h.title}` : due ? `Отметить: ${h.title}` : `Сегодня не по расписанию: ${h.title}`} disabled={doneNow || !due} onClick={() => complete(h)}><Check /></button>
                </div>
              );
            })}
          </section>
          <aside className="hb-card hb-cal" aria-label="Календарь привычек">
            <div className="hb-seg" role="group" aria-label="Период">
              {RANGES.map(([id, label]) => <button key={id} type="button" aria-pressed={range === id} className={range === id ? 'is-on' : ''} onClick={() => setRange(id)}>{label}</button>)}
            </div>
            <div className="hb-cal-title"><strong>{rangeTitle}</strong><span>{rangeHint}</span></div>
            {(range === 'month' || range === 'quarter') && <div className="hb-cal-head">{WEEK.map(([l]) => <span key={l}>{l}</span>)}</div>}
            <div className={`hb-cal-grid is-${range}`}>{cells().map((c, i) => c.blank ? <i key={`b${i}`} className="hb-cal-blank" aria-hidden="true" /> : dayCell(c))}</div>
            {range !== 'quarter' && <div className="hb-legend">{habits.map((h) => <span key={h.id}><i style={{ background: sphereOf(h.sphere).color }} />{h.title}</span>)}</div>}
          </aside>
        </div>
      )}
      {form && <HabitForm value={form} onClose={() => setForm(null)} onSave={save} />}
    </div>
  );
}
