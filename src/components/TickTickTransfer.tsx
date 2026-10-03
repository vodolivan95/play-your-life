import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameState, Quest } from '../game';
import { isGoalTask, planTransferText, taskTransferText } from '../planning';
import Icon from './Icon';
import TickTickConnection from './TickTickConnection';
export default function TickTickTransfer({
  state,
  tasks,
  onChange,
}: {
  state: GameState;
  tasks: Quest[];
  onChange: Dispatch<SetStateAction<GameState>>;
}) {
  const [message, setMessage] = useState('');
  const [includeShared, setIncludeShared] = useState(false);
  const available = tasks.filter(
    (q) =>
      !q.done && isGoalTask(state, q) && (includeShared || !q.tickTickSharedAt),
  );
  const text = planTransferText(available, state);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setMessage('Список скопирован. Вставь его в TickTick и проверь даты.');
    } catch {
      setMessage('Выдели текст ниже и скопируй вручную.');
    }
  }
  async function share(task: Quest) {
    if (!navigator.share) {
      try {
        await navigator.clipboard.writeText(taskTransferText(task, state));
        setMessage('Задача скопирована. Открой TickTick и вставь её.');
      } catch {
        setMessage('Скопируй задачу из списка ниже.');
      }
      return;
    }
    try {
      await navigator.share({
        title: task.name,
        text: taskTransferText(task, state),
      });
      setMessage('Проверь сохранение задачи и её срок в TickTick.');
    } catch (e) {
      if (!(e instanceof Error && e.name === 'AbortError'))
        setMessage('Меню передачи недоступно. Используй копирование.');
    }
  }
  return (
    <div className="ticktick-transfer">
      <TickTickConnection demo={state.profile.mode === 'demo'} />
      <div className="eyebrow">ПЛАН РЯДОМ С ТОБОЙ</div>
      <h2>Передать в TickTick</h2>
      <p className="muted">
        Передай подзадачу цели через меню телефона: выбери TickTick и сохрани
        её. На компьютере скопируй список и добавь задачи в TickTick.
      </p>
      <p className="score-note">
        Передаётся конкретная задача; название цели и этапа — только пояснение в
        заметке. Проверь даты при сохранении. Для автоматического обмена
        подключи аккаунт выше.
      </p>
      <label className="include-shared">
        <input
          type="checkbox"
          checked={includeShared}
          onChange={(e) => setIncludeShared(e.target.checked)}
        />
        Включать уже перенесённые задачи
      </label>
      {available.map((task) => (
        <div className="transfer-task" key={task.id}>
          <strong>{task.name}</strong>
          <div>
            <button className="secondary-button" onClick={() => share(task)}>
              Передать задачу <Icon name="arrow" size={15} />
            </button>
            <button
              className="text-button"
              onClick={() => {
                onChange((s) => ({
                  ...s,
                  quests: s.quests.map((q) =>
                    q.id === task.id
                      ? { ...q, tickTickSharedAt: new Date().toISOString() }
                      : q,
                  ),
                }));
                setMessage('Отмечено как перенесённое.');
              }}
            >
              Я добавил в TickTick ✓
            </button>
          </div>
        </div>
      ))}
      {available.length === 0 && (
        <p className="empty">Нет новых подзадач целей для передачи.</p>
      )}
      {available.length > 0 && (
        <>
          <button className="primary-button submit-button" onClick={copy}>
            Скопировать весь список
          </button>
          <label>
            Текст для передачи
            <textarea readOnly rows={7} value={text} />
          </label>
        </>
      )}
      <a
        className="secondary-button open-ticktick"
        href="https://ticktick.com/webapp/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Открыть TickTick ↗
      </a>
      {message && (
        <p className="transfer-message" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
