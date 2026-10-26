import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { GameState, Goal } from '../game.ts';
import { skillTreeOf } from '../skillTree.ts';
import { completeProjectReview } from '../skillPractice.ts';
import './ProjectCompletionDialog.css';

export default function ProjectCompletionDialog({
  state,
  goal,
  onSave,
  onClose,
  onNotify,
}: {
  state: GameState;
  goal: Goal;
  onSave: (next: GameState) => void;
  onClose: () => void;
  onNotify: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const tree = skillTreeOf(state, goal.sphere);
  const [skillName, setSkillName] = useState('');
  const [whatWorked, setWhatWorked] = useState('');
  const [challenge, setChallenge] = useState('');
  const [takeaway, setTakeaway] = useState('');
  const [placement, setPlacement] = useState<'continue' | 'branch' | 'new'>(tree.nodes.length ? 'continue' : 'new');
  const [parentNodeId, setParentNodeId] = useState(tree.nodes.at(-1)?.id ?? '');
  const [branchName, setBranchName] = useState('');

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const next = completeProjectReview(state, goal.id, {
        whatWorked,
        challenge,
        takeaway,
        skillName,
        placement,
        parentNodeId: placement === 'new' ? undefined : parentNodeId,
        branchName: placement === 'new' ? branchName || skillName : undefined,
      });
      onSave(next);
      onNotify(`Навык «${skillName.trim()}» добавлен в дерево сферы.`);
      onClose();
    } catch (error) {
      onNotify(error instanceof Error ? error.message : 'Не удалось сохранить итоги проекта.');
    }
  }

  return (
    <dialog
      ref={dialog}
      className="project-review-dialog"
      aria-label={`Итоги проекта: ${goal.name}`}
      onCancel={onClose}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <form className="project-review-form" onSubmit={submit}>
        <button type="button" className="project-review-close" aria-label="Закрыть" onClick={onClose}>×</button>
        <p className="project-review-eyebrow">ПРОЕКТ ЗАВЕРШЁН</p>
        <h2>Подведём итоги</h2>
        <p className="project-review-project">{goal.name}</p>
        <label>
          Что получилось лучше всего?
          <textarea value={whatWorked} maxLength={500} rows={2} onChange={(event) => setWhatWorked(event.target.value)} />
        </label>
        <label>
          Что было самым сложным?
          <textarea value={challenge} maxLength={500} rows={2} onChange={(event) => setChallenge(event.target.value)} />
        </label>
        <label>
          Что возьмёшь с собой в следующий проект?
          <textarea value={takeaway} maxLength={500} rows={2} onChange={(event) => setTakeaway(event.target.value)} />
        </label>
        <label className="project-review-skill">
          Какой навык ты приобрёл?
          <input autoFocus required value={skillName} maxLength={40} placeholder="Например, уверенно вести переговоры" onChange={(event) => setSkillName(event.target.value)} />
        </label>
        <fieldset className="project-review-placement">
          <legend>Как добавить его в дерево?</legend>
          <label>
            <span>Расположение</span>
            <select value={placement} onChange={(event) => setPlacement(event.target.value as typeof placement)}>
              {tree.nodes.length > 0 && <>
                <option value="continue">Продолжить линию</option>
                <option value="branch">Создать ответвление</option>
              </>}
              <option value="new">Начать новую ветку</option>
            </select>
          </label>
          {placement === 'new' ? (
            <label>
              <span>Название ветки</span>
              <input value={branchName} maxLength={40} placeholder={skillName || 'Направление навыков'} onChange={(event) => setBranchName(event.target.value)} />
            </label>
          ) : (
            <label>
              <span>{placement === 'branch' ? 'Ответвиться от навыка' : 'Продолжить после навыка'}</span>
              <select required value={parentNodeId} onChange={(event) => setParentNodeId(event.target.value)}>
                {tree.nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {tree.branches.find((branch) => branch.id === node.branchId)?.name} · {node.name} · ярус {node.tier}
                  </option>
                ))}
              </select>
            </label>
          )}
          <small>Новый навык появится снизу и будет расти вверх от повторной практики.</small>
        </fieldset>
        <button className="project-review-submit" type="submit">Сохранить итоги и навык</button>
      </form>
    </dialog>
  );
}
