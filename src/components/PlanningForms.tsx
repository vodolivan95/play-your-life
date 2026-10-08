import { useState } from 'react';
import type { FormEvent } from 'react';
import { difficulties, spheres } from '../game';
import type { GameState, Goal, GoalStage, Quest } from '../game';
import {
  durationEnd,
  formatDate,
  localDateTime,
  preserveDateInput,
  toISO,
} from '../planning';
import type { DurationUnit } from '../planning';
import Icon from './Icon';
import ProjectImagePicker from './ProjectImagePicker';

export function GoalForm({
  initial,
  sphereId = 'english',
  onSave,
}: {
  initial?: Goal;
  sphereId?: string;
  onSave: (
    goal: Pick<Goal, 'name' | 'sphere' | 'target' | 'reward'> & Partial<Goal>,
  ) => void;
}) {
  const [image, setImage] = useState(initial?.image);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageSphere, setImageSphere] = useState(initial?.sphere ?? sphereId);
  const [start, setStart] = useState(
    initial?.startsAt
      ? localDateTime(new Date(initial.startsAt))
      : initial
        ? ''
        : localDateTime(),
  );
  const [end, setEnd] = useState(
    initial?.dueAt
      ? localDateTime(new Date(initial.dueAt))
      : initial
        ? ''
        : localDateTime(
            new Date(durationEnd(new Date().toISOString(), 3, 'months')),
          ),
  );
  const [mode, setMode] = useState(
    initial ? (initial.progressMode ?? 'manual') : 'tasks',
  );
  const [amount, setAmount] = useState('3');
  const [unit, setUnit] = useState<DurationUnit>('months');
  const [error, setError] = useState('');
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (imageBusy) return;
    const data = new FormData(e.currentTarget);
    try {
      onSave({
        id: initial?.id,
        image,
        name: String(data.get('name')).trim(),
        sphere: String(data.get('sphere')),
        description: String(data.get('description')),
        motivation: String(data.get('motivation')),
        achievementTitle: String(data.get('achievementTitle')),
        rarity:
          (String(data.get('rarity') || '') as Goal['rarity']) || undefined,
        target: mode === 'tasks' ? 100 : Number(data.get('target')),
        reward: Number(data.get('reward')),
        progressMode: mode,
        startsAt: preserveDateInput(start, initial?.startsAt),
        dueAt: preserveDateInput(end, initial?.dueAt),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Проверь данные.');
    }
  }
  function applyDuration() {
    try {
      setEnd(
        localDateTime(
          new Date(durationEnd(toISO(start) ?? '', Number(amount), unit)),
        ),
      );
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Проверь срок.');
    }
  }
  return (
    <form className="planning-form" onSubmit={submit}>
      <div className="eyebrow">НАПРАВЛЕНИЕ ТВОЕЙ ЖИЗНИ</div>
      <h2>{initial ? 'Настроить цель' : 'Новая цель'}</h2>
      <ProjectImagePicker
        image={image}
        onChange={setImage}
        onBusy={setImageBusy}
        sphere={imageSphere}
        banner
      />
      <label>
        Название
        <input
          name="name"
          autoFocus
          required
          maxLength={100}
          defaultValue={initial?.name ?? ''}
          placeholder="Что важно изменить в своей жизни?"
        />
      </label>
      <label>
        Сфера жизни
        <select
          name="sphere"
          defaultValue={initial?.sphere ?? sphereId}
          onChange={(e) => setImageSphere(e.target.value)}
        >
          {spheres.map((s) => (
            <option value={s.id} key={s.id}>
              {s.icon} {s.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Краткое описание
        <textarea
          name="description"
          maxLength={2000}
          rows={3}
          defaultValue={initial?.description ?? ''}
          placeholder="Как изменится моя жизнь, когда я её достигну?"
        />
      </label>
      <label>
        Почему эта цель важна для меня
        <textarea
          name="motivation"
          maxLength={2000}
          defaultValue={initial?.motivation ?? ''}
          rows={3}
        />
      </label>
      <label>
        Название достижения
        <input
          name="achievementTitle"
          maxLength={100}
          defaultValue={initial?.achievementTitle ?? ''}
        />
      </label>
      <label>
        Редкость
        <select name="rarity" defaultValue={initial?.rarity ?? ''}>
          <option value="">Не задана</option>
          <option value="common">Обычная</option>
          <option value="rare">Редкая</option>
          <option value="epic">Эпическая</option>
          <option value="legendary">Легендарная</option>
        </select>
      </label>
      <div className="planning-dates">
        <label>
          Начало
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          Закончить до
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      <div className="duration-control">
        <label>
          Промежуток
          <input
            aria-label="Количество времени"
            type="number"
            min="1"
            max="1200"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label>
          Единица
          <select
            aria-label="Единица времени"
            value={unit}
            onChange={(e) => setUnit(e.target.value as DurationUnit)}
          >
            <option value="hours">Часы</option>
            <option value="days">Дни</option>
            <option value="weeks">Недели</option>
            <option value="months">Месяцы</option>
          </select>
        </label>
        <button
          type="button"
          className="secondary-button"
          onClick={applyDuration}
        >
          Задать срок
        </button>
      </div>
      <div className="duration-presets">
        {[
          { label: '2 часа', n: 2, u: 'hours' },
          { label: '1 день', n: 1, u: 'days' },
          { label: 'Неделя', n: 1, u: 'weeks' },
          { label: '3 месяца', n: 3, u: 'months' },
          { label: 'Год', n: 12, u: 'months' },
        ].map((p) => (
          <button
            type="button"
            key={p.label}
            onClick={() => {
              setAmount(String(p.n));
              setUnit(p.u as DurationUnit);
              try {
                setEnd(
                  localDateTime(
                    new Date(
                      durationEnd(toISO(start) ?? '', p.n, p.u as DurationUnit),
                    ),
                  ),
                );
                setError('');
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Выбери начало.');
              }
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <label>
        Как считать прогресс
        <select
          aria-label="Способ прогресса"
          value={mode}
          onChange={(e) => setMode(e.target.value as 'manual' | 'tasks')}
        >
          <option value="manual">Числовой результат</option>
          <option value="tasks">По выполненным задачам</option>
        </select>
      </label>
      {mode === 'manual' ? (
        <label>
          Целевое значение
          <input
            name="target"
            type="number"
            min="1"
            max="1000000"
            required
            defaultValue={
              initial?.progressMode === 'tasks'
                ? (initial.manualProgress?.target ?? 100)
                : (initial?.target ?? 100)
            }
          />
        </label>
      ) : (
        <p className="score-note">
          Прогресс растёт по выполненным задачам цели. Каждый шаг приносит свой
          XP, достижение всей цели — отдельную награду.
        </p>
      )}
      <label>
        Награда за цель
        <select name="reward" defaultValue={initial?.reward ?? 200}>
          {[100, 200, 300, 400, 500].map((xp) => (
            <option value={xp} key={xp}>
              {xp} XP
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={imageBusy}
        className="primary-button submit-button"
      >
        {initial ? 'Сохранить цель' : 'Создать цель'}
        <Icon name="arrow" size={17} />
      </button>
    </form>
  );
}
export function StageForm({
  goal,
  initial,
  onSave,
}: {
  goal: Goal;
  initial?: GoalStage;
  onSave: (
    stage: Omit<GoalStage, 'id'> & { id?: string },
    position?: number,
  ) => void;
}) {
  const [error, setError] = useState('');
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    try {
      onSave(
        {
          ...initial,
          id: initial?.id,
          name: String(data.get('name')).trim(),
          description: String(data.get('description')),
          startsAt: preserveDateInput(
            String(data.get('start')),
            initial?.startsAt,
          ),
          dueAt: preserveDateInput(String(data.get('end')), initial?.dueAt),
          status: String(data.get('status')) as GoalStage['status'],
          completionMode: String(
            data.get('completionMode'),
          ) as GoalStage['completionMode'],
          completionCondition: String(data.get('condition')),
          prerequisiteId: String(data.get('prerequisite')) || undefined,
          achievementTitle: String(data.get('achievementTitle')),
          rarity:
            (String(data.get('rarity') || '') as GoalStage['rarity']) ||
            undefined,
        },
        Number(data.get('position')) - 1,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Проверь данные.');
    }
  }
  return (
    <form className="planning-form" onSubmit={submit}>
      <div className="eyebrow">БОЛЬШАЯ ЦЕЛЬ. ПОНЯТНЫЕ ЭТАПЫ.</div>
      <h2>{initial ? 'Изменить этап' : 'Новый этап'}</h2>
      <p className="muted">{goal.name}</p>
      <label>
        Название этапа
        <input
          autoFocus
          name="name"
          required
          maxLength={100}
          defaultValue={initial?.name ?? ''}
        />
      </label>
      <label>
        Описание этапа
        <textarea
          name="description"
          maxLength={2000}
          defaultValue={initial?.description ?? ''}
        />
      </label>
      <div className="planning-dates">
        <label>
          Начало этапа
          <input
            type="datetime-local"
            name="start"
            defaultValue={
              initial?.startsAt ? localDateTime(new Date(initial.startsAt)) : ''
            }
          />
        </label>
        <label>
          Закончить этап до
          <input
            type="datetime-local"
            name="end"
            defaultValue={
              initial?.dueAt ? localDateTime(new Date(initial.dueAt)) : ''
            }
          />
        </label>
      </div>
      <label>
        Порядковый номер
        <input
          name="position"
          type="number"
          min={1}
          max={(goal.stages?.length ?? 0) + (initial ? 0 : 1)}
          defaultValue={
            initial
              ? (goal.stages?.findIndex((s) => s.id === initial.id) ?? 0) + 1
              : (goal.stages?.length ?? 0) + 1
          }
          required
        />
      </label>
      <label>
        Статус
        <select
          name="status"
          defaultValue={
            initial?.status === 'completed'
              ? 'completed'
              : (initial?.status ??
                (goal.stages?.length ? 'planned' : 'active'))
          }
        >
          <option value="planned">Запланирован</option>
          <option value="active">В процессе</option>
          <option value="paused">Приостановлен</option>
          <option value="locked">Заблокирован</option>
          {initial?.status === 'completed' && (
            <option value="completed">Завершён</option>
          )}
        </select>
      </label>
      <label>
        Условия завершения
        <select
          name="completionMode"
          defaultValue={initial?.completionMode ?? 'tasks'}
        >
          <option value="tasks">Все обязательные задачи</option>
          <option value="manual">Ручное подтверждение результата</option>
        </select>
      </label>
      <label>
        Описание результата
        <textarea
          name="condition"
          maxLength={2000}
          defaultValue={initial?.completionCondition ?? ''}
        />
      </label>
      <label>
        Сначала завершить
        <select
          name="prerequisite"
          defaultValue={initial?.prerequisiteId ?? ''}
        >
          <option value="">Без зависимости</option>
          {goal.stages
            ?.filter((s) => s.id !== initial?.id)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
      </label>
      <fieldset>
        <legend>Награды</legend>
        <p className="muted">
          XP и Life Coins складываются из наград задач. Завершение этапа не
          начисляет их повторно.
        </p>
        <label>
          Название достижения
          <input
            name="achievementTitle"
            maxLength={100}
            defaultValue={initial?.achievementTitle ?? ''}
          />
        </label>
        <label>
          Редкость
          <select name="rarity" defaultValue={initial?.rarity ?? ''}>
            <option value="">Не задана</option>
            <option value="common">Обычная</option>
            <option value="rare">Редкая</option>
            <option value="epic">Эпическая</option>
            <option value="legendary">Легендарная</option>
          </select>
        </label>
      </fieldset>
      <p className="score-note">
        Даты можно оставить пустыми. Срок цели: {formatDate(goal.dueAt)}.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button type="submit" className="primary-button submit-button">
        Сохранить этап
      </button>
    </form>
  );
}
export function TaskForm({
  state,
  goalId,
  stageId,
  initial,
  anchor,
  onSave,
}: {
  state: GameState;
  anchor?: string;
  goalId?: string;
  stageId?: string;
  initial?: Quest;
  onSave: (
    task: Pick<Quest, 'name' | 'sphere' | 'difficulty'> & Partial<Quest>,
  ) => void;
}) {
  const [chosenGoal, setChosenGoal] = useState(initial?.goalId ?? goalId ?? '');
  const [chosenStage, setChosenStage] = useState(
    initial?.stageId ?? stageId ?? '',
  );
  const goal = state.goals.find((g) => g.id === chosenGoal);
  const stage = goal?.stages?.find((s) => s.id === chosenStage);
  const [sphereId, setSphereId] = useState(initial?.sphere ?? 'tasks');
  const earliest = stage?.startsAt ?? goal?.startsAt;
  const latest = stage?.dueAt ?? goal?.dueAt;
  const [dateSources, setDateSources] = useState(() => {
    if (initial) return { start: initial.startsAt, end: initial.dueAt };
    const requested = anchor
      ? new Date(`${anchor}T09:00:00`).toISOString()
      : new Date().toISOString();
    const start =
      earliest && new Date(earliest) > new Date(requested)
        ? earliest
        : requested;
    return {
      start,
      end: new Date(
        Math.min(
          Date.parse(start) + 30 * 60000,
          latest ? Date.parse(latest) : Infinity,
        ),
      ).toISOString(),
    };
  });
  const [start, setStart] = useState(
    dateSources.start ? localDateTime(new Date(dateSources.start)) : '',
  );
  const [end, setEnd] = useState(
    dateSources.end ? localDateTime(new Date(dateSources.end)) : '',
  );
  const [error, setError] = useState('');
  function updateParent(nextGoal: string, nextStage: string) {
    setChosenGoal(nextGoal);
    setChosenStage(nextStage);
    const g = state.goals.find((item) => item.id === nextGoal);
    const s = g?.stages?.find((item) => item.id === nextStage);
    const from = s?.startsAt ?? g?.startsAt,
      to = s?.dueAt ?? g?.dueAt;
    const first =
      from && new Date(from) > new Date() ? from : new Date().toISOString();
    const last = new Date(
      Math.min(Date.parse(first) + 30 * 60000, to ? Date.parse(to) : Infinity),
    ).toISOString();
    setDateSources({ start: first, end: last });
    setStart(localDateTime(new Date(first)));
    setEnd(localDateTime(new Date(last)));
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    try {
      onSave({
        ...initial,
        id: initial?.id,
        required: data.get('required') === 'on',
        weight: Number(data.get('weight')),
        name: String(data.get('name')).trim(),
        sphere: goal?.sphere ?? String(data.get('sphere')),
        difficulty: String(data.get('difficulty')),
        goalId: chosenGoal || undefined,
        stageId: chosenStage || undefined,
        startsAt: preserveDateInput(start, dateSources.start),
        dueAt: preserveDateInput(end, dateSources.end),
        estimateMinutes:
          Number(data.get('estimate')) * Number(data.get('estimateUnit')),
        priority: String(data.get('priority')) as Quest['priority'],
        notes: String(data.get('notes')),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Проверь задачу.');
    }
  }
  return (
    <form className="planning-form" onSubmit={submit}>
      <div className="eyebrow">СЛЕДУЮЩИЙ РЕАЛЬНЫЙ ШАГ</div>
      <h2>{initial ? 'Изменить задачу' : 'Новая задача'}</h2>
      <label>
        Название задачи
        <input
          autoFocus
          name="name"
          required
          maxLength={100}
          defaultValue={initial?.name ?? ''}
          placeholder="Конкретное действие, которое приблизит цель"
        />
      </label>
      <label>
        Цель
        <select
          aria-label="Связать с целью"
          value={chosenGoal}
          onChange={(e) => updateParent(e.target.value, '')}
        >
          <option value="">Самостоятельная задача</option>
          {state.goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      {goal && (
        <label>
          Этап
          <select
            aria-label="Этап задачи"
            value={chosenStage}
            onChange={(e) => updateParent(chosenGoal, e.target.value)}
          >
            <option value="">Без этапа</option>
            {(goal.stages ?? []).map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Сфера
        <select
          name="sphere"
          disabled={!!goal}
          value={goal?.sphere ?? sphereId}
          onChange={(e) => setSphereId(e.target.value)}
        >
          {spheres.map((s) => (
            <option value={s.id} key={s.id}>
              {s.icon} {s.name}
            </option>
          ))}
        </select>
      </label>
      <div className="planning-dates">
        <label>
          Когда начать
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          Срок задачи
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>
      <div className="planning-dates">
        <label>
          Выделить времени
          <input
            name="estimate"
            type="number"
            required
            min="1"
            max="43200"
            defaultValue={initial?.estimateMinutes ?? 30}
          />
        </label>
        <label>
          Единица
          <select name="estimateUnit">
            <option value="1">Минуты</option>
            <option value="60">Часы</option>
            <option value="1440">Дни</option>
          </select>
        </label>
      </div>
      <label>
        Приоритет
        <select name="priority" defaultValue={initial?.priority ?? 'normal'}>
          <option value="low">Без спешки</option>
          <option value="normal">Обычный</option>
          <option value="high">Главный фокус</option>
        </select>
      </label>
      <label>
        Сложность
        <select
          name="difficulty"
          defaultValue={initial?.difficulty ?? 'Medium'}
        >
          {Object.entries(difficulties).map(([name, xp]) => (
            <option key={name} value={name}>
              {name} — {xp} XP
            </option>
          ))}
        </select>
      </label>
      <label>
        Что нужно сделать
        <textarea
          name="notes"
          maxLength={2000}
          rows={3}
          defaultValue={initial?.notes ?? ''}
          placeholder="Подробности и критерий готовности"
        />
      </label>
      {goal && (
        <p className="score-note">
          Задача относится к сфере цели. Срок цели: {formatDate(goal.dueAt)}.
        </p>
      )}
      <label className="gw-check-label">
        <input
          type="checkbox"
          name="required"
          defaultChecked={initial?.required !== false}
        />
        Обязательная задача
      </label>
      <label>
        Вес в прогрессе
        <input
          name="weight"
          type="number"
          min="0.1"
          max="1000"
          step="0.1"
          defaultValue={initial?.weight ?? 1}
          required
        />
      </label>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button className="primary-button submit-button" type="submit">
        Сохранить задачу
      </button>
    </form>
  );
}
