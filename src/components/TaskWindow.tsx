import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { difficulties, spheres } from '../game';
import type { GameState, Quest } from '../game';
import { isGoalTask, saveStage } from '../planning';
import {
  canChangeDifficulty,
  difficultyLabels,
  dueFor,
  duePreset,
  repeatLabels,
  taskContribution,
  updateTaskSettings,
} from '../taskSettings';
import type { DuePreset, TaskPatch } from '../taskSettings';
import './TaskWindow.css';

const duePresets: [Exclude<DuePreset, 'date'>, string][] = [
  ['today', 'Сегодня'],
  ['tomorrow', 'Завтра'],
  ['week', 'На неделе'],
  ['none', 'Без срока'],
];
function fmtDate(value?: string) {
  if (!value) return '';
  // Срок без времени ('YYYY-MM-DD') — просто дата, полдень нужен только чтобы не зацепить
  // соседние сутки при разборе. Срок со временем — настоящий момент: берём его как есть и
  // показываем в календарном дне браузера, а не вырезаем первые 10 символов строки UTC —
  // иначе ночные часы могли бы показать соседние сутки (та же причина, что и в ticktick.ts).
  const bare = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const d = bare ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}
/** Срок с конкретным временем выполнения (не просто 'YYYY-MM-DD') — часы:минуты, иначе пусто. */
function clockOf(value?: string) {
  if (!value || /^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
  return hh === '00' && mm === '00' ? '' : `${hh}:${mm}`;
}
/** Календарный день срока (локальный), годится и для даты, и для момента со временем. */
function dayOf(value?: string) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Задаёт время выполнения, сохраняя день срока; пустое время возвращает к обычной дате без времени. */
function withTime(dueAt: string, time: string) {
  const day = dayOf(dueAt);
  return time ? `${day}T${time}` : day;
}
export default function TaskWindow({ taskId, state, today, onChange, onClose, onAdvanced, onProgress, onDelete, notify }: {
  taskId: string;
  state: GameState;
  today: string;
  onChange: Dispatch<SetStateAction<GameState>>;
  onClose: () => void;
  onAdvanced?: (q: Quest) => void;
  onProgress?: (q: Quest) => void;
  onDelete?: (q: Quest) => void;
  notify: (s: string) => void;
}) {
  const task = state.quests.find((q) => q.id === taskId);
  const [name, setName] = useState(task?.name ?? ''),
    [notes, setNotes] = useState(task?.notes ?? ''),
    [adding, setAdding] = useState(false),
    [draft, setDraft] = useState(''),
    [picking, setPicking] = useState(false),
    [sub, setSub] = useState('');
  if (!task) return null;
  const c = taskContribution(state, task),
    sphere = spheres.find((s) => s.id === task.sphere),
    inGoal = isGoalTask(state, task),
    preset = duePreset(task.dueAt, today),
    linked = !!task.tickTickSharedAt,
    locked = task.done;
  function patch(p: TaskPatch, message?: string) {
    try {
      onChange(updateTaskSettings(state, task!.id, p));
      if (message) notify(message);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  function addStage() {
    try {
      const next = saveStage(state, task!.goalId!, { name: draft, status: 'active' });
      const created = next.goals.find((g) => g.id === task!.goalId)?.stages?.slice(-1)[0];
      onChange(created ? updateTaskSettings(next, task!.id, { stageId: created.id }) : next);
      setDraft('');
      setAdding(false);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  const ring = Math.min(100, Math.round((c.xp / 50) * 100));
  return (
    <div className="pyl-overlay twin-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section className="twin" role="dialog" aria-modal="true" aria-labelledby="twin-title">
        <header className="twin-head">
          <div className="twin-ring" style={{ ['--p' as string]: ring }} aria-label={`Награда: ${c.xp} XP`}>
            <b>+{c.xp}</b>
            <small>XP</small>
          </div>
          <div>
            <small>{sphere ? `${sphere.icon} ${sphere.name}` : 'Сфера'} · 🪙 {c.coins}</small>
            <h2 id="twin-title">{task.name}</h2>
          </div>
          <button type="button" className="twin-close" onClick={onClose} aria-label="Закрыть">✕</button>
        </header>
        <div className="twin-stats">
          <div><small>В сферу</small><b>+{c.xp} XP</b><span>{sphere?.name ?? ''}</span></div>
          <div><small>В цель</small><b>{c.goal ? `${c.goalShare}%` : '—'}</b><span>{c.goal ? c.goal.name : 'вне цели'}</span></div>
          <div><small>В этап</small><b>{c.stage ? c.stage.name : '—'}</b><span>{c.stage ? `${c.stageTasks} задач в этапе` : 'без этапа'}</span></div>
        </div>
        <div className="twin-body">
          <label className="twin-field">Название
            <input value={name} maxLength={100} disabled={locked} onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() !== task.name && patch({ name })} />
          </label>
          {inGoal && (
            <div className="twin-field" role="group" aria-label="Этап">
              <span>Этап цели «{c.goal?.name}»</span>
              <div className="twin-chips">
                <button type="button" aria-pressed={!task.stageId} onClick={() => patch({ stageId: null })}>Без этапа</button>
                {(c.goal?.stages ?? []).map((s) => (
                  <button key={s.id} type="button" aria-pressed={task.stageId === s.id} onClick={() => patch({ stageId: s.id })}>{s.name}</button>
                ))}
                {!adding && <button type="button" className="twin-add" onClick={() => setAdding(true)}>＋ Добавить этап</button>}
              </div>
              {adding && (
                <form className="twin-inline" onSubmit={(e) => { e.preventDefault(); addStage(); }}>
                  <input value={draft} maxLength={100} autoFocus placeholder="Название этапа" aria-label="Название нового этапа" onChange={(e) => setDraft(e.target.value)} />
                  <button className="primary-button" disabled={!draft.trim()}>Создать этап</button>
                  <button type="button" className="text-button" onClick={() => { setAdding(false); setDraft(''); }}>Отмена</button>
                </form>
              )}
            </div>
          )}
          <div className="twin-field" role="group" aria-label="Сложность">
            <span>Сложность</span>
            <div className="twin-chips">
              {Object.entries(difficulties).map(([id, xp]) => (
                <button key={id} type="button" aria-pressed={task.difficulty === id}
                  disabled={!canChangeDifficulty(task) && task.difficulty !== id}
                  onClick={() => patch({ difficulty: id })}>{difficultyLabels[id]} · {xp} XP</button>
              ))}
            </div>
            {!canChangeDifficulty(task) && <small>Сложность зафиксирована: задача начата или создана системой.</small>}
          </div>
          {linked ? (
            <div className="twin-field" role="group" aria-label="Плановая дата">
              <span>Плановая дата</span>
              <p>
                {task.startsAt && task.dueAt && dayOf(task.startsAt) !== dayOf(task.dueAt)
                  ? `${fmtDate(task.startsAt)} — ${fmtDate(task.dueAt)}`
                  : task.dueAt ? fmtDate(task.dueAt) : 'Без даты в TickTick'}
              </p>
              <small>Дата берётся из TickTick при каждом обмене; поменять можно только там.</small>
              {task.dueAt && (
                <label className="twin-time">Время выполнения
                  <input type="time" aria-label="Время выполнения" value={clockOf(task.dueAt)}
                    onChange={(e) => patch({ dueAt: withTime(task.dueAt!, e.target.value) })} />
                </label>
              )}
              <small>Время — в обе стороны с TickTick; без времени задача показана на весь день.</small>
            </div>
          ) : (
            <div className="twin-field" role="group" aria-label="Срок">
              <span>Срок</span>
              <div className="twin-chips">
                {duePresets.map(([id, label]) => (
                  <button key={id} type="button" aria-pressed={preset === id && !picking}
                    onClick={() => { setPicking(false); patch({ dueAt: dueFor(id, today) }); }}>{label}</button>
                ))}
                <button type="button" aria-pressed={preset === 'date' || picking} onClick={() => setPicking(true)}>Выбрать дату</button>
              </div>
              {(picking || preset === 'date') && (
                <>
                  <input type="date" aria-label="Дата выполнения" value={dayOf(task.dueAt)}
                    onChange={(e) => e.target.value && patch({ dueAt: withTime(e.target.value, clockOf(task.dueAt)) })} />
                  <label className="twin-time">Время выполнения
                    <input type="time" aria-label="Время выполнения" value={clockOf(task.dueAt)}
                      onChange={(e) => task.dueAt && patch({ dueAt: withTime(task.dueAt, e.target.value) })} />
                  </label>
                </>
              )}
            </div>
          )}
          <div className="twin-field" role="group" aria-label="Дедлайн">
            <span>Дедлайн</span>
            <div className="twin-chips">
              <input type="date" aria-label="Дата дедлайна" value={task.deadlineAt?.slice(0, 10) ?? ''}
                onChange={(e) => patch({ deadlineAt: e.target.value || null })} />
              {task.deadlineAt && (
                <button type="button" onClick={() => patch({ deadlineAt: null })}>Убрать дедлайн</button>
              )}
            </div>
            <small>Свой срок в игре — не связан с TickTick.</small>
          </div>
          <div className="twin-field" role="group" aria-label="Повтор">
            <span>Повтор</span>
            <div className="twin-chips">
              {repeatLabels.map(([id, label]) => (
                <button key={label} type="button" aria-pressed={(task.repeat ?? null) === id} onClick={() => patch({ repeat: id })}>{label}</button>
              ))}
            </div>
            {task.repeat && <small>После выполнения появится следующая задача с новым сроком.</small>}
          </div>
          <div className="twin-field" role="group" aria-label="Подзадачи">
            <span>Подзадачи{task.subtasks?.length ? ` · ${task.subtasks.filter((t) => t.done).length} из ${task.subtasks.length}` : ''}</span>
            <ul className="twin-subs">
              {(task.subtasks ?? []).map((t) => (
                <li key={t.id}>
                  <label><input type="checkbox" checked={t.done} onChange={() => patch({ subtasks: task.subtasks!.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) })} /> <span className={t.done ? 'is-done' : ''}>{t.title}</span></label>
                  <button type="button" aria-label={`Удалить подзадачу ${t.title}`} onClick={() => patch({ subtasks: task.subtasks!.filter((x) => x.id !== t.id) })}>✕</button>
                </li>
              ))}
            </ul>
            <form className="twin-inline" onSubmit={(e) => { e.preventDefault(); if (!sub.trim()) return; patch({ subtasks: [...(task.subtasks ?? []), { id: crypto.randomUUID(), title: sub, done: false }] }); setSub(''); }}>
              <input value={sub} maxLength={100} placeholder="Новая подзадача" aria-label="Новая подзадача" onChange={(e) => setSub(e.target.value)} />
              <button className="secondary-button" disabled={!sub.trim()}>＋ Добавить</button>
            </form>
          </div>
          <label className="twin-field">Заметка
            <textarea rows={3} value={notes} maxLength={2000} disabled={locked} onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes.trim() !== (task.notes ?? '') && patch({ notes })} />
          </label>
          <div className="twin-sync">
            <div>
              <b>Синхронизация с TickTick</b>
              <small>Включено по умолчанию: название, срок, заметка, выполнение и удаление идут в обе стороны, когда TickTick подключён.</small>
            </div>
            <button type="button" role="switch" aria-checked={task.tickTickSync !== false}
              aria-label="Синхронизация с TickTick"
              onClick={() => patch({ sync: task.tickTickSync === false })}><i /></button>
          </div>
        </div>
        <footer className="twin-foot">
          {task.sourceType === 'USER_CREATED' && onAdvanced && (
            <button type="button" className="text-button" onClick={() => { onClose(); onAdvanced(task); }}>Расширенные настройки</button>
          )}
          {onDelete && <button type="button" className="text-button" onClick={() => onDelete(task)}>Удалить</button>}
          {onProgress && !task.done && <button type="button" className="secondary-button" onClick={() => onProgress(task)}>Продолжить</button>}
          <button type="button" className="primary-button" onClick={onClose}>Готово</button>
        </footer>
      </section>
    </div>
  );
}
