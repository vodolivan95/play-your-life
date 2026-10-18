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
export default function TaskWindow({ taskId, state, today, onChange, onClose, onAdvanced, notify }: {
  taskId: string;
  state: GameState;
  today: string;
  onChange: Dispatch<SetStateAction<GameState>>;
  onClose: () => void;
  onAdvanced?: (q: Quest) => void;
  notify: (s: string) => void;
}) {
  const task = state.quests.find((q) => q.id === taskId);
  const [name, setName] = useState(task?.name ?? ''),
    [notes, setNotes] = useState(task?.notes ?? ''),
    [adding, setAdding] = useState(false),
    [draft, setDraft] = useState(''),
    [picking, setPicking] = useState(false);
  if (!task) return null;
  const c = taskContribution(state, task),
    sphere = spheres.find((s) => s.id === task.sphere),
    inGoal = isGoalTask(state, task),
    preset = duePreset(task.dueAt, today),
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
              <input type="date" aria-label="Дата выполнения" value={task.dueAt?.slice(0, 10) ?? ''}
                onChange={(e) => e.target.value && patch({ dueAt: e.target.value })} />
            )}
          </div>
          <label className="twin-field">Заметка
            <textarea rows={3} value={notes} maxLength={2000} disabled={locked} onChange={(e) => setNotes(e.target.value)}
              onBlur={() => notes.trim() !== (task.notes ?? '') && patch({ notes })} />
          </label>
          <div className="twin-sync">
            <div>
              <b>Синхронизация с TickTick</b>
              <small>{inGoal ? 'Название, срок, заметка и отметка о выполнении идут в обе стороны.' : 'Передаются задачи внутри целей: добавь задачу в цель.'}</small>
            </div>
            <button type="button" role="switch" aria-checked={!!task.tickTickSharedAt} disabled={!inGoal}
              aria-label="Синхронизация с TickTick"
              onClick={() => patch({ shared: !task.tickTickSharedAt })}><i /></button>
          </div>
        </div>
        <footer className="twin-foot">
          {task.sourceType === 'USER_CREATED' && onAdvanced && (
            <button type="button" className="text-button" onClick={() => { onClose(); onAdvanced(task); }}>Расширенные настройки</button>
          )}
          <button type="button" className="primary-button" onClick={onClose}>Готово</button>
        </footer>
      </section>
    </div>
  );
}
