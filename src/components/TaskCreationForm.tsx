import type { Dispatch, SetStateAction } from 'react';
import { saveGoal, saveStage, saveTask } from '../planning';
import { useEffect, useRef, useState } from 'react';
import { dateKey, difficulties } from '../game';
import type { GameState, Quest, TaskLabel } from '../game';
import { validateTaskEditorFields } from '../taskEditor';
import TaskWindow from './TaskWindow';

export type TaskInput = Partial<Quest> & Pick<Quest, 'name' | 'sphere' | 'difficulty'>;
/** The same editor as existing tasks, backed by an isolated draft until commit. */
export default function TaskCreationForm({ quest, initial, state, taskLabels, onClose, onSave, submitLabel, scopeSphere, onGlobalChange }: {
  quest?: Quest; initial?: Partial<Quest>; state: GameState; taskLabels?: TaskLabel[];
  onClose: () => void; onSave: (task: TaskInput, labels: TaskLabel[]) => void | Promise<void>;
  submitLabel?: string; scopeSphere?: string; onGlobalChange?: Dispatch<SetStateAction<GameState>>;
}) {
  const base = quest ?? initial;
  const [draft, setDraft] = useState<Quest>(() => ({
    name: '', sphere: 'tasks', difficulty: 'Medium', xp: 20, done: false, sourceType: 'USER_CREATED',
    ...base, id: quest?.id ?? crypto.randomUUID(),
  }));
  const [initialLabels] = useState(taskLabels ?? state.taskLabels ?? []);
  const [draftLabels, setLabels] = useState(initialLabels);
  const labels = [...(state.taskLabels ?? []), ...draftLabels.filter(label => !initialLabels.some(old => old.id === label.id) && !state.taskLabels?.some(old => old.id === label.id))];
  const dialog = useRef<HTMLDialogElement>(null);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  function view(current: Quest): GameState {
    return { ...state, taskLabels: labels, quests: [...state.quests.filter(q => q.id !== current.id), current] };
  }
  return <dialog className="task-editor-draft" ref={dialog} aria-label={submitLabel ?? (quest ? 'Изменить задачу' : 'Создать задачу')}
    onCancel={e => { e.preventDefault(); e.stopPropagation(); }}>
    <TaskWindow taskId={draft.id} state={view(draft)} today={dateKey()} draftMode
      scopeSphere={scopeSphere} submitLabel={submitLabel ?? (quest ? 'Сохранить задачу' : 'Создать задачу')}
      notify={setNotice} onClose={onClose} notice={notice}
      onChange={action => setDraft(current => {
        const next = typeof action === 'function' ? action(view(current)) : action;
        return next.quests.find(q => q.id === current.id) ?? current;
      })}
      onNewProject={onGlobalChange ? title => {
        const next = saveGoal(state, { name: title, sphere: draft.sphere, target: 100, reward: 100, progressMode: 'tasks' });
        const goal = next.goals.find(g => !state.goals.some(old => old.id === g.id))!;
        onGlobalChange(next); setDraft(q => ({ ...q, goalId: goal.id, stageId: undefined }));
      } : undefined}
      onNewStage={onGlobalChange && draft.goalId ? title => {
        const next = saveStage(state, draft.goalId!, { name: title, status: 'active' });
        const stage = next.goals.find(g => g.id === draft.goalId)!.stages!.at(-1)!;
        onGlobalChange(next); setDraft(q => ({ ...q, stageId: stage.id }));
      } : undefined}
      draftLabels={labels} onDraftLabels={setLabels}
      onSaveDraft={async q => {
        validateTaskEditorFields(q);
        if (!q.name.trim()) throw new Error('Добавь название задачи.');
        const input: TaskInput = { ...q, xp: difficulties[q.difficulty as keyof typeof difficulties] };
        if (!quest) delete input.id;
        saveTask({ ...state, taskLabels: labels }, input);
        await onSave(input, labels);
        onClose();
      }} />
  </dialog>;
}
