import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { difficulties, spheres } from '../game';
import type { Quest, TaskLabel } from '../game';
import { localDateTime, preserveDateInput } from '../planning';
import { virtualRewards } from '../personalQuests';
import { inspectQuestPhoto } from '../questPhoto';
import { TASK_LABEL_LIMIT, TASK_LABEL_NAME_LIMIT } from '../taskLabels';
import GameArt from './GameArt';
import './TaskCreationForm.css';

type TaskInput = Partial<Quest> & Pick<Quest, 'name' | 'sphere' | 'difficulty'>;

const difficultyNames: Record<string, string> = {
  Micro: 'Мини',
  Simple: 'Простая',
  Medium: 'Обычная',
  Hard: 'Сложная',
  'Very Hard': 'Очень сложная',
};
const priorities: [NonNullable<Quest['priority']>, string][] = [
  ['low', 'Низкий'],
  ['normal', 'Обычный'],
  ['high', 'Высокий'],
];

function toDateTimeInput(value?: string) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00`;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : localDateTime(date);
}

function fromDateTimeInput(value: string, original?: string) {
  if (!value) return undefined;
  if (original?.length === 10 && value === `${original}T00:00`) return original;
  return preserveDateInput(value, original);
}

export default function TaskCreationForm({
  quest,
  initial,
  taskLabels = [],
  onClose,
  onSave,
}: {
  quest?: Quest;
  initial?: Partial<Quest>;
  taskLabels?: TaskLabel[];
  onClose: () => void;
  onSave: (task: TaskInput, labels: TaskLabel[]) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const base = quest ?? initial;
  const [name, setName] = useState(base?.name ?? '');
  const [notes, setNotes] = useState(base?.notes ?? '');
  const [sphere, setSphere] = useState(base?.sphere ?? 'health');
  const [difficulty, setDifficulty] = useState(base?.difficulty ?? 'Medium');
  const [priority, setPriority] = useState<NonNullable<Quest['priority']>>(base?.priority ?? 'normal');
  const [startsAt, setStartsAt] = useState(toDateTimeInput(base?.startsAt));
  const [dueAt, setDueAt] = useState(toDateTimeInput(base?.dueAt));
  const [rewardCoins, setRewardCoins] = useState(base?.rewardCoins ?? 0);
  const [virtualRewardId, setVirtualRewardId] = useState(base?.virtualRewardId ?? '');
  const [selectedLabelId, setSelectedLabelId] = useState(base?.labelId ?? '');
  const [labels, setLabels] = useState<TaskLabel[]>(taskLabels);
  const [labelDraft, setLabelDraft] = useState('');
  const [addingLabel, setAddingLabel] = useState(false);
  const [photo, setPhoto] = useState('');
  const [coverImage, setCoverImage] = useState(quest?.coverImage);
  const [error, setError] = useState('');
  const locked = quest?.rewardLocked || (quest?.currentValue ?? 0) > 0;
  const xp = difficulties[difficulty as keyof typeof difficulties] ?? difficulties.Medium;

  useEffect(() => {
    dialog.current?.showModal();
    const element = dialog.current;
    return () => element?.close();
  }, []);
  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo);
  }, [photo]);

  async function choosePhoto(file?: File) {
    if (!file) return;
    try {
      await inspectQuestPhoto(file);
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.src = url;
      try {
        await image.decode();
        if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 40000000)
          throw new Error('Изображение слишком большое: максимум 40 мегапикселей.');
        setPhoto((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return url;
        });
      } catch (e) {
        URL.revokeObjectURL(url);
        throw e;
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function createLabel() {
    const labelName = labelDraft.trim();
    if (!labelName) {
      setError('Введи название метки.');
      return;
    }
    if (labelName.length > TASK_LABEL_NAME_LIMIT) {
      setError(`Название метки — не более ${TASK_LABEL_NAME_LIMIT} символов.`);
      return;
    }
    const existing = labels.find((label) => label.name.toLocaleLowerCase('ru-RU') === labelName.toLocaleLowerCase('ru-RU'));
    if (existing) {
      setSelectedLabelId(existing.id);
      setLabelDraft('');
      setAddingLabel(false);
      setError('');
      return;
    }
    if (labels.length >= TASK_LABEL_LIMIT) {
      setError(`Можно создать не более ${TASK_LABEL_LIMIT} меток.`);
      return;
    }
    const created = { id: crypto.randomUUID(), name: labelName };
    setLabels((current) => [...current, created]);
    setSelectedLabelId(created.id);
    setLabelDraft('');
    setAddingLabel(false);
    setError('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const cleanName = name.trim();
      if (!cleanName) throw new Error('Добавь название задачи.');
      if (cleanName.length > 100) throw new Error('Название задачи — не более 100 символов.');
      if (!spheres.some((item) => item.id === sphere)) throw new Error('Выбери сферу жизни.');
      if (!Number.isSafeInteger(rewardCoins) || rewardCoins < 0 || rewardCoins > 100)
        throw new Error('Лайфкоины: от 0 до 100 целых.');
      if (startsAt) preserveDateInput(startsAt, base?.startsAt);
      if (dueAt) preserveDateInput(dueAt, base?.dueAt);
      if (startsAt && dueAt && new Date(startsAt).getTime() > new Date(dueAt).getTime())
        throw new Error('Дедлайн раньше начала задачи.');
      if (selectedLabelId && !labels.some((label) => label.id === selectedLabelId))
        throw new Error('Выбери существующую метку или создай новую.');
      onSave({
        ...quest,
        ...initial,
        name: cleanName,
        notes: notes.trim() || undefined,
        sphere,
        difficulty,
        priority,
        startsAt: fromDateTimeInput(startsAt, base?.startsAt),
        dueAt: fromDateTimeInput(dueAt, base?.dueAt),
        rewardCoins,
        virtualRewardId: virtualRewardId || undefined,
        labelId: selectedLabelId || undefined,
        coverImage,
      }, labels);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Проверь данные задачи.');
    }
  }

  return (
    <dialog
      ref={dialog}
      className="pyl-quest-dialog task-create-dialog"
      aria-labelledby="task-create-title"
      onCancel={onClose}
    >
      <form className="task-create-form" onSubmit={submit}>
        <header className="task-create-head">
          <div>
            <span className="task-create-eyebrow">ТВОЙ СЛЕДУЮЩИЙ ШАГ</span>
            <h2 id="task-create-title">{quest ? 'Изменить задачу' : 'Создать задачу'}</h2>
          </div>
          <button type="button" className="task-create-close" aria-label="Закрыть" onClick={onClose}>×</button>
        </header>

        <div className="task-create-scroll">
          <div className="task-create-layout">
            <section className="task-create-main">
              <label>
                Название задачи
                <input autoFocus required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Пробежать вечером" />
              </label>
              <label>
                Описание
                <textarea maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Что поможет тебе выполнить этот шаг?" />
              </label>
              <fieldset className="task-create-spheres">
                <legend>Сфера жизни</legend>
                <div className="task-create-sphere-grid">
                  {spheres.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={sphere === item.id}
                      disabled={!!locked && sphere !== item.id}
                      className={sphere === item.id ? 'is-selected' : ''}
                      onClick={() => setSphere(item.id)}
                    >
                      <span className="task-create-sphere-icon"><GameArt kind={item.id} /></span>
                      <span>{item.name}</span>
                    </button>
                  ))}
                </div>
                {locked && <small>Сфера зафиксирована после начала выполнения.</small>}
              </fieldset>
              <div className="task-create-photo-area">
                {(photo || coverImage) ? (
                  <div className="task-create-photo-preview">
                    <img src={photo || coverImage} alt="Предпросмотр фото задачи" />
                    <button type="button" onClick={() => { setPhoto(''); setCoverImage(undefined); }}>Удалить фото</button>
                  </div>
                ) : (
                  <label className="task-create-photo-button">
                    <span>＋</span> Добавить фото
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { void choosePhoto(e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                )}
                <small>Фото доступно для предпросмотра; на карточке задачи останется иллюстрация сферы.</small>
              </div>
            </section>

            <aside className="task-create-options">
              <fieldset className="task-create-group">
                <legend>Сложность</legend>
                <div className="task-create-segmented task-create-difficulty">
                  {Object.entries(difficulties).map(([id, amount]) => (
                    <button key={id} type="button" className="task-create-difficulty-option" aria-pressed={difficulty === id} disabled={!!locked && difficulty !== id} onClick={() => setDifficulty(id)}>
                      <span>{difficultyNames[id]}</span><small>{amount} XP</small>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="task-create-dates">
                <label>
                  <span>Начало</span>
                  <input aria-label="Дата и время начала" type="datetime-local" value={startsAt} max={dueAt || undefined} onChange={(e) => setStartsAt(e.target.value)} />
                </label>
                <label>
                  <span>Дедлайн</span>
                  <input aria-label="Дата и время дедлайна" type="datetime-local" value={dueAt} min={startsAt || undefined} onChange={(e) => setDueAt(e.target.value)} />
                </label>
              </div>

              <fieldset className="task-create-group">
                <legend>Приоритет</legend>
                <div className="task-create-segmented task-create-priority">
                  {priorities.map(([value, label]) => (
                    <button key={value} type="button" aria-pressed={priority === value} onClick={() => setPriority(value)}>{label}</button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="task-create-group task-create-labels">
                <legend>Метка</legend>
                <div className="task-create-label-list">
                  <button type="button" aria-pressed={!selectedLabelId} className={!selectedLabelId ? 'is-selected' : ''} onClick={() => setSelectedLabelId('')}>Без метки</button>
                  {labels.map((label) => (
                    <button key={label.id} type="button" aria-pressed={selectedLabelId === label.id} className={selectedLabelId === label.id ? 'is-selected' : ''} onClick={() => setSelectedLabelId(label.id)}>{label.name}</button>
                  ))}
                </div>
                {addingLabel ? (
                  <div className="task-create-new-label">
                    <input aria-label="Название новой метки" maxLength={TASK_LABEL_NAME_LIMIT} value={labelDraft} onChange={(e) => setLabelDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createLabel(); } }} placeholder="Например, Дом" />
                    <button type="button" onClick={createLabel}>Добавить</button>
                  </div>
                ) : (
                  <button type="button" className="task-create-add-label" disabled={labels.length >= TASK_LABEL_LIMIT} onClick={() => setAddingLabel(true)}>＋ Создать метку</button>
                )}
              </fieldset>

              <section className="task-create-reward" aria-label="Награда за задачу">
                <div className="task-create-reward-top">
                  <div className="task-create-reward-summary">
                    <span className="task-create-xp-ring" role="img" aria-label={`Награда ${xp} XP`}>
                      <svg viewBox="0 0 64 64" aria-hidden="true"><circle className="task-create-xp-track" cx="32" cy="32" r="27" /><circle className="task-create-xp-progress" cx="32" cy="32" r="27" /></svg>
                      <span><b>+{xp}</b><small>XP</small></span>
                    </span>
                    <span className="task-create-reward-copy"><strong>Награда за шаг</strong><small>XP начисляется за выполненную задачу</small></span>
                  </div>
                  <label>Лайфкоины
                    <input aria-label="Лайфкоины за задачу" type="number" min={0} max={100} step={1} value={rewardCoins} disabled={!!locked} onChange={(e) => setRewardCoins(e.target.valueAsNumber)} />
                  </label>
                </div>
                {locked && <small>Награда зафиксирована после начала прогресса.</small>}
                <label className="task-create-virtual-reward">Дополнительная награда
                  <select aria-label="Виртуальная награда" value={virtualRewardId} disabled={!!locked} onChange={(e) => setVirtualRewardId(e.target.value)}>
                    <option value="">Без предмета</option>
                    {virtualRewards.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
                  </select>
                </label>
              </section>
            </aside>
          </div>
          {error && <p role="alert" className="task-create-error">{error}</p>}
        </div>

        <footer className="task-create-footer">
          <button type="button" className="task-create-cancel" onClick={onClose}>Отмена</button>
          <button type="submit" className="task-create-submit">{quest ? 'Сохранить задачу' : 'Создать задачу'} <span aria-hidden="true">→</span></button>
        </footer>
      </form>
    </dialog>
  );
}
