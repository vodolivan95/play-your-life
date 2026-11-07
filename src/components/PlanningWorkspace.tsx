import { useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { spheres } from '../game';
import type { GameState, Quest } from '../game';
import { addDays, mondayOf } from '../tasksCalendar';
import { planningDay, planningMetrics, planningSettings } from '../planningData';
import { applyWeekProposal, availableMinutes, changeTaskPlanning, inboxTask, moveTaskToDay, planningSummary, planningConflicts, proposeWeek, quickPlanningTask, savePlanningSettings, setTaskProject, setTaskWorkflow, taskDay, visiblePlanningTask } from '../planner';
import type { WeekProposal } from '../planner';
import { updateTaskSettings } from '../taskSettings';
import './PlanningWorkspace.css';

type Scope = 'today' | 'tomorrow' | 'week' | 'month' | 'all' | 'inbox' | 'overdue' | 'archive';
type View = 'list' | 'kanban' | 'matrix';
const scopes: [Scope, string][] = [['today', 'Сегодня'], ['tomorrow', 'Завтра'], ['week', 'Неделя'], ['month', 'Месяц'], ['all', 'Все задачи'], ['inbox', 'Входящие'], ['overdue', 'Просроченные'], ['archive', 'Архив']];
const workflows = [['planned', 'Запланировано'], ['ready', 'К выполнению'], ['doing', 'В работе'], ['waiting', 'Ожидает'], ['done', 'Завершено']] as const;
const fmt = (n: number) => n >= 60 ? `${Math.floor(n / 60)} ч ${n % 60 ? `${n % 60} мин` : ''}`.trim() : `${n} мин`;
const labelDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });

export default function PlanningWorkspace({ state, ownerId, today, onChange, onOpen, notify }: {
  state: GameState; ownerId: string; today: string; onChange: Dispatch<SetStateAction<GameState>>; onOpen: (id: string) => void; notify: (s: string) => void;
}) {
  const [scope, setScope] = useState<Scope>('today');
  const [view, setView] = useState<View>('list');
  const [anchor, setAnchor] = useState(today);
  const [query, setQuery] = useState('');
  const [sphere, setSphere] = useState('');
  const [priority, setPriority] = useState('');
  const [doneFilter, setDoneFilter] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [batchPriority, setBatchPriority] = useState<NonNullable<Quest['priority']>>('normal');
  const [batchDay, setBatchDay] = useState(today);
  const [reason, setReason] = useState('');
  const [proposal, setProposal] = useState<WeekProposal | null>(null);
  const [review, setReview] = useState<'morning' | 'evening' | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settings = planningSettings(state);
  const [draftSettings, setDraftSettings] = useState(settings);
  const own = state.quests.filter((q) => !q.ownerId || q.ownerId === ownerId);
  const day = scope === 'tomorrow' ? addDays(today, 1) : scope === 'today' ? today : anchor;
  const start = scope === 'week' ? mondayOf(anchor) : scope === 'month' ? `${anchor.slice(0, 7)}-01` : day;
  const end = scope === 'week' ? addDays(start, 6) : scope === 'month' ? `${anchor.slice(0, 7)}-31` : day;
  const shown = own.filter((q) => {
    if (scope === 'archive' ? !q.planning?.archivedAt : !visiblePlanningTask(q)) return false;
    if (scope === 'inbox' && !inboxTask(q)) return false;
    const d = taskDay(q);
    if (scope === 'overdue' && (q.done || !d || d >= today)) return false;
    const completedHere = q.done && ['today', 'tomorrow'].includes(scope) && planningDay(q.completedAt) === day;
    const mainHere = !q.done && ['today', 'tomorrow'].includes(scope) && q.planning?.mainDay === day;
    if (['today', 'tomorrow', 'week', 'month'].includes(scope) && !completedHere && !mainHere && (!d || d < start || d > end)) return false;
    return (!sphere || q.sphere === sphere) && (!priority || (q.priority ?? 'normal') === priority)
      && (doneFilter === 'all' || q.done === (doneFilter === 'done'))
      && (!query.trim() || `${q.name} ${q.notes ?? ''}`.toLocaleLowerCase('ru-RU').includes(query.trim().toLocaleLowerCase('ru-RU')));
  }).sort((a, b) => Number(b.planning?.mainDay === day) - Number(a.planning?.mainDay === day)
    || Number(a.done) - Number(b.done) || (taskDay(a) ?? '9999').localeCompare(taskDay(b) ?? '9999') || a.name.localeCompare(b.name, 'ru'));
  const activeIds = selected.filter((id) => shown.some((q) => q.id === id));
  const metrics = useMemo(() => planningMetrics(state), [state]);
  const summary = planningSummary(state, shown, metrics);
  const conflicts = planningConflicts(shown);
  const mainCount = own.filter((q) => visiblePlanningTask(q) && !q.done && q.planning?.mainDay === day).length;
  const doingCount = own.filter((q) => visiblePlanningTask(q) && !q.done && q.planning?.workflow === 'doing').length;
  const days = scope === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(start, i)) : ['today', 'tomorrow'].includes(scope) ? [day] : [];
  function apply(action: (s: GameState) => GameState, message = 'План сохранён') {
    onChange((s) => { try { const next = action(s); queueMicrotask(() => notify(message)); return next; } catch (e) { queueMicrotask(() => notify((e as Error).message)); return s; } });
  }
  function batch(action: (s: GameState, q: Quest) => GameState) {
    const ids = [...activeIds];
    apply((s) => ids.reduce((next, id) => { const q = next.quests.find((q) => q.id === id); if (!q) throw new Error('Список изменился. Выбери задачи заново.'); return action(next, q); }, s));
  }
  function buildProposal() {
    try { setProposal(proposeWeek(state, activeIds.length ? activeIds : shown.filter((q) => !q.done).map((q) => q.id), anchor, ownerId)); }
    catch (e) { notify((e as Error).message); }
  }
  function card(q: Quest) {
    const moves = metrics.get(q.id)?.moves ?? 0;
    const main = q.planning?.mainDay === day;
    return <li key={q.id} className={`pplan-task${q.done ? ' is-done' : ''}`}>
      <div className="pplan-task-top">
        <input type="checkbox" aria-label={`Выбрать: ${q.name}`} checked={activeIds.includes(q.id)} onChange={(e) => setSelected((ids) => e.target.checked ? [...new Set([...ids, q.id])] : ids.filter((id) => id !== q.id))} />
        <button type="button" className="pplan-name" onClick={() => onOpen(q.id)}>{q.name}</button>
        {!q.done && !q.planning?.archivedAt && <button type="button" aria-label={`${main ? 'Убрать из главных' : 'Главная задача'}: ${q.name}`} aria-pressed={main}
          onClick={() => apply((s) => changeTaskPlanning(s, q.id, { mainDay: main ? undefined : day }, ownerId))}>{main ? '★' : '☆'}</button>}
      </div>
      <small>{spheres.find((s) => s.id === q.sphere)?.name} · {taskDay(q) ? labelDay(taskDay(q)!) : 'Без даты'} · {q.estimateMinutes ? fmt(q.estimateMinutes) : 'Нет оценки'} · Факт: {fmt(metrics.get(q.id)?.minutes ?? 0)}</small>
      {moves >= settings.moveWarning && <p className="pplan-warning">Переносов: {moves}. Открой задачу, чтобы уменьшить объём или добавить подзадачи.</p>}
      {!q.planning?.archivedAt && <div className="pplan-row">
        <label className="pplan-sr">Статус: {q.name}</label>
        <select aria-label={`Статус: ${q.name}`} value={q.done ? 'done' : q.planning?.workflow ?? 'planned'} onChange={(e) => apply((s) => setTaskWorkflow(s, q.id, e.target.value as Parameters<typeof setTaskWorkflow>[2], ownerId))}>
          {workflows.map(([id, text]) => <option value={id} key={id}>{text}</option>)}
        </select>
        {!q.done && <>
          <input type="date" aria-label={`Плановая дата: ${q.name}`} value={taskDay(q) ?? ''} onChange={(e) => { const value = e.target.value; apply((s) => moveTaskToDay(s, q.id, value || null, ownerId, reason)); }} />
          <select aria-label={`Приоритет: ${q.name}`} value={q.priority ?? 'normal'} onChange={(e) => { const value = e.target.value as Quest['priority']; apply((s) => updateTaskSettings(s, q.id, { priority: value })); }}>
            <option value="high">Высокий</option><option value="normal">Обычный</option><option value="low">Низкий</option>
          </select>
          {scope === 'inbox' && <select aria-label={`Проект: ${q.name}`} value={q.goalId ?? ''} onChange={(e) => { const value = e.target.value; apply((s) => setTaskProject(s, q.id, value || null, ownerId)); }}>
            <option value="">Без проекта</option>{state.goals.filter((g) => g.sphere === q.sphere).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>}
          <label><input type="checkbox" checked={!!q.planning?.important} onChange={(e) => { const value = e.target.checked; apply((s) => changeTaskPlanning(s, q.id, { important: value }, ownerId)); }} /> Важно</label>
          <label><input type="checkbox" checked={!!q.planning?.urgent} onChange={(e) => { const value = e.target.checked; apply((s) => changeTaskPlanning(s, q.id, { urgent: value }, ownerId)); }} /> Срочно</label>
          {inboxTask(q) && <button type="button" onClick={() => apply((s) => changeTaskPlanning(s, q.id, { inbox: false }, ownerId))}>Разобрано</button>}
        </>}
      </div>}
      {q.planning?.archivedAt && <button type="button" onClick={() => apply((s) => changeTaskPlanning(s, q.id, { archivedAt: undefined }, ownerId))}>Восстановить</button>}
    </li>;
  }
  return <section className="pplan" aria-label="Мой план">
    <header className="pplan-head"><div><h2>Мой план</h2><p>Проекты, время и следующий шаг.</p></div><button type="button" onClick={() => { setDraftSettings(settings); setSettingsOpen((v) => !v); }}>Настройки плана</button></header>
    {!state.planningSettings && <p>Пока используется базовый бюджет: 8 часов по будням, резерв 20%. Уточни доступное время в настройках плана.</p>}
    {settingsOpen && <form className="pplan-panel" aria-label="Настройки плана" onSubmit={(e) => { e.preventDefault(); apply((s) => savePlanningSettings(s, draftSettings)); setSettingsOpen(false); }}>
      <h3>Доступное время и ограничения</h3><p>Рабочий день минус резерв. Расчёт использует часовой пояс устройства.</p>
      <div className="pplan-grid">{([['dailyMinutes', 'Доступно минут в день', 0, 1440], ['reservePercent', 'Резерв, %', 0, 90], ['mainLimit', 'Главных задач в день', 1, 20], ['moveWarning', 'Предупреждать после переносов', 1, 100], ['wipLimit', 'Лимит задач в работе', 1, 100]] as const).map(([key, label, min, max]) => <label key={key}>{label}<input type="number" required min={min} max={max} step={1} value={draftSettings[key]} onChange={(e) => setDraftSettings({ ...draftSettings, [key]: Number(e.target.value) })} /></label>)}</div>
      <fieldset><legend>Дни для планирования</legend><div className="pplan-row">{['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'].map((label, n) => <label key={n}><input type="checkbox" checked={draftSettings.weekdays.includes(n)} onChange={(e) => setDraftSettings({ ...draftSettings, weekdays: e.target.checked ? [...draftSettings.weekdays, n] : draftSettings.weekdays.filter((d) => d !== n) })} /> {label}</label>)}</div></fieldset>
      <div className="pplan-row"><button type="submit">Сохранить настройки</button><button type="button" onClick={() => setSettingsOpen(false)}>Отмена</button></div>
    </form>}
    <nav className="pplan-row" aria-label="Период плана">{scopes.map(([id, label]) => <button key={id} type="button" aria-pressed={scope === id} onClick={() => { setScope(id); setSelected([]); }}>{label}{id === 'inbox' ? ` (${own.filter(inboxTask).length})` : ''}</button>)}</nav>
    <div className="pplan-row">
      <label>Дата плана<input type="date" value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)} /></label>
      <label>Вид<select aria-label="Вид плана" value={view} onChange={(e) => setView(e.target.value as View)}><option value="list">Список</option><option value="kanban">Канбан</option><option value="matrix">Важность и срочность</option></select></label>
      <button type="button" onClick={buildProposal}>Спланировать неделю</button>
      <button type="button" onClick={() => setReview('morning')}>Начать день</button><button type="button" onClick={() => setReview('evening')}>Завершить день</button>
    </div>
    {review && <div className="pplan-panel" role="region" aria-label={review === 'morning' ? 'Утренний обзор' : 'Вечерний обзор'}>
      <h3>{review === 'morning' ? 'Начать день' : 'Итоги дня'}</h3><p>Сегодня: {own.filter((q) => visiblePlanningTask(q) && taskDay(q) === today && q.done).length} выполнено. Просрочено: {own.filter((q) => visiblePlanningTask(q) && !q.done && !!taskDay(q) && taskDay(q)! < today).length}. Главных задач: {own.filter((q) => visiblePlanningTask(q) && !q.done && q.planning?.mainDay === today).length}.</p>
      <p>{review === 'morning' ? 'Открой «Сегодня» или «Просроченные», выбери главные задачи звёздочкой и проверь нагрузку.' : 'Для оставшихся задач выбери дату, верни во входящие массовым действием или оставь просроченными. Ничего не переносится автоматически.'}</p>
      <div className="pplan-row"><button type="button" onClick={() => { setScope('today'); setReview(null); }}>Открыть сегодня</button><button type="button" onClick={() => { setScope('overdue'); setReview(null); }}>Разобрать просроченные</button><button type="button" onClick={() => setReview(null)}>Закрыть обзор</button></div>
    </div>}
    {proposal && <div className="pplan-panel" role="region" aria-label="Предложение плана недели"><h3>Предложение на неделю {labelDay(mondayOf(proposal.anchor))}</h3>
      <p>Из выбранных задач или текущего списка. Учтены оценки, доступные дни, резерв и уже назначенные задачи. До подтверждения даты не меняются.</p>
      <ul>{proposal.assignments.map((a) => <li key={a.id}>{state.quests.find((q) => q.id === a.id)?.name} → {labelDay(a.day)}</li>)}</ul>
      {proposal.unplaced.length > 0 && <div role="status"><p>Не распределено: {proposal.unplaced.length}. Не хватает оценки или доступного времени, либо проект на паузе. Задачи остаются на месте.</p><ul>{proposal.unplaced.map((id) => <li key={id}>{state.quests.find((q) => q.id === id)?.name}</li>)}</ul></div>}
      <div className="pplan-row"><button type="button" disabled={!proposal.assignments.length} onClick={() => { apply((s) => applyWeekProposal(s, proposal, ownerId)); setProposal(null); }}>Подтвердить план недели</button><button type="button" onClick={() => setProposal(null)}>Отменить предложение</button></div>
    </div>}
    <div className="pplan-stats" aria-label="Сводка плана"><span><b>{summary.done}/{summary.count}</b> Выполнено · {summary.percent}%</span><span><b>{fmt(summary.plan)}</b> План</span><span><b>{fmt(summary.remaining)}</b> Осталось</span><span><b>{fmt(summary.fact)}</b> Учтено всего по этим задачам</span></div>
    {conflicts.length > 0 && <details className="pplan-panel"><summary>Пересечения интервалов: {conflicts.length}</summary><p>Пересечения разрешены. Открой задачу, чтобы изменить время.</p><ul>{conflicts.map(([a, b]) => <li key={`${a.id}:${b.id}`}><button type="button" onClick={() => onOpen(a.id)}>{a.name}</button> пересекается с <button type="button" onClick={() => onOpen(b.id)}>{b.name}</button></li>)}</ul></details>}
    {summary.unknown > 0 && <p role="status">Без оценки времени: {summary.unknown}. Расчёт нагрузки неполный.</p>}
    {mainCount > settings.mainLimit && <p className="pplan-warning" role="status">Главных задач {mainCount}, выбранный лимит {settings.mainLimit}. Пересмотри фокус дня.</p>}
    {doingCount > settings.wipLimit && <p className="pplan-warning" role="status">В работе {doingCount} задач при лимите {settings.wipLimit}. Заверши начатое перед новыми задачами.</p>}
    {days.length > 0 && <div className="pplan-grid" aria-label="Нагрузка по дням">{days.map((d) => {
      const tasks = own.filter((q) => visiblePlanningTask(q) && taskDay(q) === d);
      const load = planningSummary(state, tasks, metrics); const capacity = availableMinutes(state, d);
      return <article key={d} className={`pplan-panel${load.remaining > capacity ? ' pplan-warning' : ''}`}><b>{labelDay(d)}</b><p>{tasks.filter((q) => !q.done).length} задач · {fmt(load.remaining)} / {fmt(capacity)}</p>{load.remaining > capacity && <p>План превышает доступное время на {fmt(load.remaining - capacity)}.</p>}</article>;
    })}</div>}
    <form className="pplan-row" onSubmit={(e) => { e.preventDefault(); apply((s) => quickPlanningTask(s, title, ownerId, ['today', 'tomorrow'].includes(scope) ? day : undefined), 'Задача создана'); setTitle(''); }}>
      <input aria-label="Быстрая задача" maxLength={100} required value={title} placeholder="Что нужно сделать?" onChange={(e) => setTitle(e.target.value)} /><button type="submit">Добавить задачу</button>
    </form>
    <div className="pplan-row" aria-label="Фильтры плана"><input type="search" aria-label="Поиск в плане" value={query} placeholder="Поиск задач" onChange={(e) => setQuery(e.target.value)} />
      <select aria-label="Сфера плана" value={sphere} onChange={(e) => setSphere(e.target.value)}><option value="">Все сферы</option>{spheres.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <select aria-label="Приоритет плана" value={priority} onChange={(e) => setPriority(e.target.value)}><option value="">Все приоритеты</option><option value="high">Высокий</option><option value="normal">Обычный</option><option value="low">Низкий</option></select>
      <select aria-label="Выполнение плана" value={doneFilter} onChange={(e) => setDoneFilter(e.target.value)}><option value="all">Все статусы</option><option value="open">Невыполненные</option><option value="done">Выполненные</option></select>
    </div>
    <div className="pplan-panel"><div className="pplan-row"><button type="button" onClick={() => setSelected(activeIds.length === shown.length ? [] : shown.map((q) => q.id))}>Выбрать все показанные</button><span>Выбрано: {activeIds.length}</span></div>
      {activeIds.length > 0 && <div className="pplan-row"><label>Новая дата<input type="date" required value={batchDay} onChange={(e) => setBatchDay(e.target.value)} /></label><label>Причина переноса<input maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <button type="button" onClick={() => batch((s, q) => moveTaskToDay(s, q.id, batchDay, ownerId, reason))}>Перенести выбранные ({activeIds.length})</button>
        <label>Новый приоритет<select value={batchPriority} onChange={(e) => setBatchPriority(e.target.value as NonNullable<Quest['priority']>)}><option value="high">Высокий</option><option value="normal">Обычный</option><option value="low">Низкий</option></select></label>
        <button type="button" onClick={() => batch((s, q) => updateTaskSettings(s, q.id, { priority: batchPriority }))}>Изменить приоритет выбранных</button>
        <button type="button" onClick={() => batch((s, q) => moveTaskToDay(s, q.id, null, ownerId, reason))}>Вернуть во входящие</button>
        <button type="button" onClick={() => { if (window.confirm(`Завершить выбранные задачи: ${activeIds.length}?`)) batch((s, q) => setTaskWorkflow(s, q.id, 'done', ownerId)); }}>Завершить выбранные</button>
        <button type="button" onClick={() => { if (window.confirm(`Архивировать выбранные задачи: ${activeIds.length}?`)) batch((s, q) => changeTaskPlanning(s, q.id, { archivedAt: new Date().toISOString() }, ownerId)); }}>Архивировать выбранные</button>
      </div>}
    </div>
    {shown.length === 0 ? <p>В этом представлении задач нет. Измени фильтры или добавь задачу.</p> : view === 'list' ? <ul className="pplan-list">{shown.map(card)}</ul> :
      <div className="pplan-board">{(view === 'kanban' ? workflows.map(([id, label]) => ({ id, label, tasks: shown.filter((q) => (q.done ? 'done' : q.planning?.workflow ?? 'planned') === id) }))
        : [{ id: '11', label: 'Важно и срочно' }, { id: '10', label: 'Важно, не срочно' }, { id: '01', label: 'Срочно, не важно' }, { id: '00', label: 'Не важно, не срочно' }].map((g) => ({ ...g, tasks: shown.filter((q) => `${Number(!!q.planning?.important)}${Number(!!q.planning?.urgent)}` === g.id) })))
        .map((g) => <section key={g.id} className="pplan-panel"><h3>{g.label} · {g.tasks.length}</h3><ul className="pplan-list">{g.tasks.map(card)}</ul></section>)}</div>}
  </section>;
}
