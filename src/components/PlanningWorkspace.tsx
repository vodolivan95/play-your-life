import { lazy, Suspense, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { dateKey, spheres } from '../game';
import type { GameState, Quest } from '../game';
import { addDays, mondayOf } from '../tasksCalendar';
import { planningDay, planningMetrics, planningSettings } from '../planningData';
import { applyWeekProposal, availableMinutes, changeTaskPlanning, inboxTask, moveTaskToDay, planningSummary, planningConflicts, proposeWeek, savePlanningSettings, setTaskProject, setTaskWorkflow, stuckCategoryLabels, stuckTasks, taskDay, visiblePlanningTask, executionOverview } from '../planner';
import type { WeekProposal } from '../planner';
import { updateTaskSettings } from '../taskSettings';
import { reorderTaskList } from '../planning';
import { dependentTasks, dependencyBlockers } from '../taskDependencies';
import './PlanningWorkspace.css';
import TaskReorderList from './TaskReorderList';
import { saveCustomQuest } from '../personalQuests';
const TaskCreationForm = lazy(() => import('./TaskCreationForm'));
const PlanningTimeline = lazy(() => import('./PlanningTimeline'));
const WeeklyReviewWizard = lazy(() => import('./WeeklyReviewWizard'));

type Scope = 'today' | 'tomorrow' | 'week' | 'month' | 'all' | 'inbox' | 'overdue' | 'archive';
type View = 'list' | 'kanban' | 'matrix' | 'timeline';
const scopes: [Scope, string][] = [['today', 'Сегодня'], ['tomorrow', 'Завтра'], ['week', 'Неделя'], ['month', 'Месяц'], ['all', 'Все задачи'], ['inbox', 'Входящие'], ['overdue', 'Просроченные'], ['archive', 'Архив']];
type QuickFilter = '' | 'attention' | 'oftenPostponed' | 'noDate' | 'project' | 'blocked';
// Быстрые фильтры «Контроля выполнения» (ТЗ «Этап 3», раздел 2.2). Независимы от вкладок периода:
// действуют на весь план владельца («часто переношу» должен работать «за всё время, независимо от
// выбранной даты календаря» — раздел 2.2 ТЗ), поэтому включение фильтра переводит scope в «all».
const quickFilters: [Exclude<QuickFilter, ''>, string][] = [
  ['attention', 'Требуют внимания'], ['oftenPostponed', 'Часто переношу'], ['noDate', 'Без даты'],
  ['project', 'Связанные с проектами'], ['blocked', 'Заблокированные'],
];
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
  const [project, setProject] = useState('');
  const [priority, setPriority] = useState('');
  const [doneFilter, setDoneFilter] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [taskDraft, setTaskDraft] = useState<Partial<Quest> | null>(null);
  const [batchPriority, setBatchPriority] = useState<NonNullable<Quest['priority']>>('normal');
  const [batchDay, setBatchDay] = useState(today);
  const [reason, setReason] = useState('');
  const [proposal, setProposal] = useState<WeekProposal | null>(null);
  const [review, setReview] = useState<'morning' | 'evening' | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [weeklyReviewOpen, setWeeklyReviewOpen] = useState(false);
  const settings = planningSettings(state);
  const [draftSettings, setDraftSettings] = useState(settings);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('');
  const [taskOrder, setTaskOrder] = useState<'planned' | 'manual'>('planned');
  const own = state.quests.filter((q) => !q.ownerId || q.ownerId === ownerId);
  const day = scope === 'tomorrow' ? addDays(today, 1) : scope === 'today' ? today : anchor;
  const start = scope === 'week' ? mondayOf(anchor) : scope === 'month' ? `${anchor.slice(0, 7)}-01` : day;
  const end = scope === 'week' ? addDays(start, 6) : scope === 'month' ? `${anchor.slice(0, 7)}-31` : day;
  const metrics = useMemo(() => planningMetrics(state), [state]);
  const stuck = useMemo(() => stuckTasks(state, own, today, settings, metrics), [state, own, today, settings, metrics]);
  const overview = useMemo(() => executionOverview(state, own, today, settings, metrics), [state, own, today, settings, metrics]);
  const oftenPostponedTask = (q: Quest) => (metrics.get(q.id)?.moves ?? 0) >= settings.moveWarning;
  const blockedTask = (q: Quest) => dependencyBlockers(state.quests, q).length > 0;
  const shown = own.filter((q) => {
    if (scope === 'archive' ? !q.planning?.archivedAt : !visiblePlanningTask(q)) return false;
    if (scope === 'inbox' && !inboxTask(q)) return false;
    const d = taskDay(q);
    if (scope === 'overdue' && (q.done || !d || d >= today)) return false;
    // Быстрые фильтры действуют на весь план «за всё время» (ТЗ «Этап 3», раздел 2.2), поэтому
    // окно периода («Сегодня»/«Неделя»/«Месяц») игнорируется, пока выбран быстрый фильтр.
    if (!quickFilter && ['today', 'tomorrow', 'week', 'month'].includes(scope) && (!d || d < start || d > end)) return false;
    if (quickFilter === 'oftenPostponed' && !(!q.done && oftenPostponedTask(q))) return false;
    if (quickFilter === 'noDate' && (q.done || d)) return false;
    if (quickFilter === 'project' && (q.done || !q.goalId)) return false;
    if (quickFilter === 'blocked' && (q.done || !blockedTask(q))) return false;
    if (quickFilter === 'attention' && !(!q.done && ((d && d < today) || oftenPostponedTask(q) || blockedTask(q)))) return false;
    return (!project || q.goalId === project) && (!sphere || q.sphere === sphere) && (!priority || (q.priority ?? 'normal') === priority)
      && (doneFilter === 'all' || q.done === (doneFilter === 'done'))
      && (!query.trim() || `${q.name} ${q.notes ?? ''}`.toLocaleLowerCase('ru-RU').includes(query.trim().toLocaleLowerCase('ru-RU')));
  }).sort(taskOrder === 'manual' ? () => 0 : (a, b) => Number(b.planning?.mainDay === day) - Number(a.planning?.mainDay === day)
    || Number(a.done) - Number(b.done) || (taskDay(a) ?? '9999').localeCompare(taskDay(b) ?? '9999') || a.name.localeCompare(b.name, 'ru'));
  const activeIds = selected.filter((id) => shown.some((q) => q.id === id));
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
    const blocked = dependencyBlockers(state.quests, q);
    return <div className={`pplan-task${q.done ? ' is-done' : ''}`}>
      <div className="pplan-task-top">
        <input type="checkbox" aria-label={`Выбрать: ${q.name}`} checked={activeIds.includes(q.id)} onChange={(e) => setSelected((ids) => e.target.checked ? [...new Set([...ids, q.id])] : ids.filter((id) => id !== q.id))} />
        <button type="button" className="pplan-name" onClick={() => onOpen(q.id)}>{q.name}</button>
        {!q.done && !q.planning?.archivedAt && <button type="button" aria-label={`${main ? 'Убрать из главных' : 'Главная задача'}: ${q.name}`} aria-pressed={main}
          onClick={() => apply((s) => changeTaskPlanning(s, q.id, { mainDay: main ? undefined : day }, ownerId))}>{main ? '★' : '☆'}</button>}
      </div>
      <small>{spheres.find((s) => s.id === q.sphere)?.name} · {taskDay(q) ? labelDay(taskDay(q)!) : 'Без даты'} · {q.estimateMinutes ? fmt(q.estimateMinutes) : 'Нет оценки'} · Факт: {fmt(metrics.get(q.id)?.minutes ?? 0)}</small>
      {blocked.length > 0 && !q.done && <p className="pplan-warning">Задача заблокирована: {blocked.map((d) => d.name).join(", ")}. Открой задачу, чтобы проверить зависимости.</p>}
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
    </div>;
  }
  function orderedList(list: Quest[], label: string) {
    return <TaskReorderList
      className="pplan-list"
      tasks={list}
      label={label}
      enabled={taskOrder === 'manual'}
      onReorder={(sourceId, targetId, placement) => apply((s) => reorderTaskList(s, list.map((task) => task.id), sourceId, targetId, placement), 'Порядок задач сохранён')}
      renderTask={card}
    />;
  }
  return <section className="pplan" aria-label="Мой план">
    <header className="pplan-head"><div><h2>Мой план</h2><p>Проекты, время и следующий шаг.</p></div><button type="button" onClick={() => setWeeklyReviewOpen(true)}>Недельный обзор</button><button type="button" onClick={() => { setDraftSettings(settings); setSettingsOpen((v) => !v); }}>Настройки плана</button></header>
    {weeklyReviewOpen && <Suspense fallback={null}><WeeklyReviewWizard state={state} onClose={() => setWeeklyReviewOpen(false)} onApply={apply} onOpenTask={onOpen} /></Suspense>}
    {!state.planningSettings && <p>Пока используется базовый бюджет: 8 часов по будням, резерв 20%. Уточни доступное время в настройках плана.</p>}
    {settingsOpen && <form className="pplan-panel" aria-label="Настройки плана" onSubmit={(e) => { e.preventDefault(); apply((s) => savePlanningSettings(s, draftSettings)); setSettingsOpen(false); }}>
      <h3>Доступное время и ограничения</h3><p>Рабочий день минус резерв. Расчёт использует часовой пояс устройства.</p>
      <div className="pplan-grid">{([['dailyMinutes', 'Доступно минут в день', 0, 1440], ['reservePercent', 'Резерв, %', 0, 90], ['mainLimit', 'Главных задач в день', 1, 20], ['moveWarning', 'Предупреждать после переносов', 1, 100], ['wipLimit', 'Лимит задач в работе', 1, 100]] as const).map(([key, label, min, max]) => <label key={key}>{label}<input type="number" required min={min} max={max} step={1} value={draftSettings[key]} onChange={(e) => setDraftSettings({ ...draftSettings, [key]: Number(e.target.value) })} /></label>)}</div>
      <fieldset><legend>Дни для планирования</legend><div className="pplan-row">{['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'].map((label, n) => <label key={n}><input type="checkbox" checked={draftSettings.weekdays.includes(n)} onChange={(e) => setDraftSettings({ ...draftSettings, weekdays: e.target.checked ? [...draftSettings.weekdays, n] : draftSettings.weekdays.filter((d) => d !== n) })} /> {label}</label>)}</div></fieldset>
      <div className="pplan-row"><button type="submit">Сохранить настройки</button><button type="button" onClick={() => setSettingsOpen(false)}>Отмена</button></div>
    </form>}
    <nav className="pplan-row" aria-label="Период плана">{scopes.map(([id, label]) => <button key={id} type="button" aria-pressed={scope === id && !quickFilter} onClick={() => { setScope(id); setQuickFilter(''); setSelected([]); }}>{label}{id === 'inbox' ? ` (${own.filter(inboxTask).length})` : ''}</button>)}</nav>
    <div className="pplan-stats" aria-label="Контроль выполнения">
      <button type="button" className="pplan-stat" onClick={() => { setScope('all'); setQuickFilter(''); setSelected([]); }}><b>{overview.totalActive}</b> Всего активных</button>
      <button type="button" className="pplan-stat" onClick={() => { setScope('today'); setQuickFilter(''); setSelected([]); }}><b>{overview.plannedToday}</b> На сегодня</button>
      <span><b>{overview.doneToday}</b> Выполнено сегодня</span>
      <button type="button" className="pplan-stat" onClick={() => { setScope('overdue'); setQuickFilter(''); setSelected([]); }}><b>{overview.overdue}</b> Просрочено</button>
      <button type="button" className="pplan-stat" onClick={() => { setScope('all'); setQuickFilter('oftenPostponed'); setSelected([]); }}><b>{overview.oftenPostponed}</b> Часто переносится</button>
      <button type="button" className="pplan-stat" onClick={() => { setScope('all'); setQuickFilter('blocked'); setSelected([]); }}><b>{overview.blocked}</b> Заблокировано</button>
      <button type="button" className="pplan-stat" onClick={() => { setScope('all'); setQuickFilter('noDate'); setSelected([]); }}><b>{overview.noDate}</b> Без даты</button>
      <button type="button" className="pplan-stat" onClick={() => { setScope('all'); setQuickFilter('project'); setSelected([]); }}><b>{overview.inActiveProjects}</b> По активным проектам</button>
    </div>
    <nav className="pplan-row" aria-label="Быстрые фильтры плана">
      {quickFilters.map(([id, label]) => <button key={id} type="button" aria-pressed={quickFilter === id} onClick={() => { setQuickFilter((v) => v === id ? '' : id); setScope('all'); setSelected([]); }}>{label}</button>)}
      <button type="button" aria-pressed={scope === 'all' && !quickFilter} onClick={() => { setScope('all'); setQuickFilter(''); setDoneFilter('open'); setSelected([]); }}>Все активные задачи</button>
    </nav>
    <div className="pplan-row">
      <label>Дата плана<input type="date" value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)} /></label>
      <label>Вид<select aria-label="Вид плана" value={view} onChange={(e) => setView(e.target.value as View)}><option value="list">Список</option><option value="kanban">Канбан</option><option value="matrix">Важность и срочность</option><option value="timeline">Шкала сроков</option></select></label>
      <label>Порядок задач<select aria-label="Сортировка задач плана" value={taskOrder} onChange={(e) => setTaskOrder(e.target.value as typeof taskOrder)}><option value="planned">По плану</option><option value="manual">Вручную</option></select></label>
      <button type="button" onClick={buildProposal}>Спланировать неделю</button>
      <button type="button" onClick={() => setReview('morning')}>Начать день</button><button type="button" onClick={() => setReview('evening')}>Завершить день</button>
    </div>
    {review && <div className="pplan-panel" role="region" aria-label={review === 'morning' ? 'Утренний обзор' : 'Вечерний обзор'}>
      <h3>{review === 'morning' ? 'Начать день' : 'Итоги дня'}</h3><p>Сегодня: {own.filter((q) => visiblePlanningTask(q) && planningDay(q.completedAt) === today && q.done).length} выполнено. Просрочено: {own.filter((q) => visiblePlanningTask(q) && !q.done && !!taskDay(q) && taskDay(q)! < today).length}. Главных задач: {own.filter((q) => visiblePlanningTask(q) && !q.done && q.planning?.mainDay === today).length}.</p>
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
    {stuck.length > 0 && <details className="pplan-panel" aria-label="Застрявшие задачи"><summary>Застрявшие задачи: {stuck.length}</summary>
      <p>Задачи, которые давно не продвигаются: часто переносятся, просрочены, заблокированы зависимостями, долго без подтверждённой активности или без уточнённого плана. Ничего не переносится и не меняется автоматически.</p>
      <ul className="pplan-list">{stuck.map((st) => {
        const q = own.find((t) => t.id === st.id)!;
        return <li key={st.id} className="pplan-stuck-item">
          <div className="pplan-task-top"><button type="button" className="pplan-name" onClick={() => onOpen(q.id)}>{q.name}</button></div>
          <small>{st.categories.map((c) => stuckCategoryLabels[c]).join(' · ')}{st.daysSinceActivity !== undefined ? ` · Последняя активность: ${st.daysSinceActivity} дн. назад` : ''}</small>
          {st.blockedBy.length > 0 && <p className="pplan-warning">Ожидает: {st.blockedBy.map((b) => b.name).join(', ')}.</p>}
          <div className="pplan-row">
            <button type="button" onClick={() => onOpen(q.id)}>Открыть</button>
            <button type="button" aria-pressed={!!q.planning?.needsReview} onClick={() => apply((s) => changeTaskPlanning(s, q.id, { needsReview: !q.planning?.needsReview }, ownerId))}>{q.planning?.needsReview ? '✓ Отмечена для пересмотра' : 'Отметить для пересмотра'}</button>
          </div>
        </li>;
      })}</ul>
    </details>}
    {summary.unknown > 0 && <p role="status">Без оценки времени: {summary.unknown}. Расчёт нагрузки неполный.</p>}
    {mainCount > settings.mainLimit && <p className="pplan-warning" role="status">Главных задач {mainCount}, выбранный лимит {settings.mainLimit}. Пересмотри фокус дня.</p>}
    {doingCount > settings.wipLimit && <p className="pplan-warning" role="status">В работе {doingCount} задач при лимите {settings.wipLimit}. Заверши начатое перед новыми задачами.</p>}
    {days.length > 0 && <div className="pplan-grid" aria-label="Нагрузка по дням">{days.map((d) => {
      const tasks = own.filter((q) => visiblePlanningTask(q) && taskDay(q) === d);
      const load = planningSummary(state, tasks, metrics); const capacity = availableMinutes(state, d);
      return <article key={d} className={`pplan-panel${load.remaining > capacity ? ' pplan-warning' : ''}`}><b>{labelDay(d)}</b><p>{tasks.filter((q) => !q.done).length} задач · {fmt(load.remaining)} / {fmt(capacity)}</p>{load.remaining > capacity && <p>План превышает доступное время на {fmt(load.remaining - capacity)}.</p>}</article>;
    })}</div>}
    <form className="pplan-row" onSubmit={(e) => { e.preventDefault(); setTaskDraft({ name: title, sphere: 'tasks', difficulty: 'Simple', dueAt: ['today', 'tomorrow'].includes(scope) ? day : undefined }); }}>
      <input aria-label="Быстрая задача" maxLength={100} required value={title} placeholder="Что нужно сделать?" onChange={(e) => setTitle(e.target.value)} /><button type="submit">Добавить задачу</button>
    </form>
    {taskDraft && <Suspense fallback={<p>Загрузка задачи…</p>}><TaskCreationForm state={state} initial={taskDraft}
      onClose={() => setTaskDraft(null)} onSave={(task, labels) => {
        onChange(current => {
          const next = saveCustomQuest({ ...current, taskLabels: labels }, task, ownerId);
          const created = next.quests.at(-1)!;
          return changeTaskPlanning(next, created.id, { inbox: !task.dueAt && !task.startsAt, workflow: task.dueAt || task.startsAt ? 'ready' : 'planned' }, ownerId);
        });
        setTitle(''); notify('Задача создана');
      }} /></Suspense>}
    <div className="pplan-row" aria-label="Фильтры плана"><input type="search" aria-label="Поиск в плане" value={query} placeholder="Поиск задач" onChange={(e) => setQuery(e.target.value)} />
      <select aria-label="Сфера плана" value={sphere} onChange={(e) => setSphere(e.target.value)}><option value="">Все сферы</option>{spheres.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
      <select aria-label="Проект плана" value={project} onChange={(e) => setProject(e.target.value)}><option value="">Все проекты</option>{state.goals.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
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
    {view === 'timeline' ? <Suspense fallback={<p>Загрузка шкалы…</p>}><PlanningTimeline state={state} quests={shown} start={['today', 'tomorrow', 'week', 'month'].includes(scope) ? start : anchor} end={scope === 'month' ? dateKey(new Date(Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7)), 0, 12)) : ['today', 'tomorrow', 'week'].includes(scope) ? end : addDays(anchor, 29)} onOpen={onOpen} onShift={(q, days) => {
      const dependents = dependentTasks(state.quests, q.id);
      apply((s) => {
        const current = s.quests.find((t) => t.id === q.id);
        if (!current || current.dueAt !== q.dueAt || current.startsAt !== q.startsAt) throw new Error('Задача изменилась. Повтори перенос.');
        return updateTaskSettings(s, q.id, { shiftDays: days, moveReason: 'Перенос на шкале сроков' });
      }, dependents.length ? `Задача перенесена. Проверь зависимые задачи (${dependents.length}): их сроки не менялись.` : 'Задача перенесена');
    }} /></Suspense> : shown.length === 0 ? <p>В этом представлении задач нет. Измени фильтры или добавь задачу.</p> : view === 'list' ? orderedList(shown, 'Задачи планировщика') :
      <div className="pplan-board">{(view === 'kanban' ? workflows.map(([id, label]) => ({ id, label, tasks: shown.filter((q) => (q.done ? 'done' : q.planning?.workflow ?? 'planned') === id) }))
        : [{ id: '11', label: 'Важно и срочно' }, { id: '10', label: 'Важно, не срочно' }, { id: '01', label: 'Срочно, не важно' }, { id: '00', label: 'Не важно, не срочно' }].map((g) => ({ ...g, tasks: shown.filter((q) => `${Number(!!q.planning?.important)}${Number(!!q.planning?.urgent)}` === g.id) })))
        .map((g) => <section key={g.id} className="pplan-panel"><h3>{g.label} · {g.tasks.length}</h3>{orderedList(g.tasks, `Задачи: ${g.label}`)}</section>)}</div>}
  </section>;
}
