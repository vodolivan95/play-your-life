import { useRef, useState } from 'react';
import type { GameState } from '../game';
import { getRecoveryRaw, getStorageProblem } from '../game';
import { backupText, restoreBackup, recoveryStorageKey } from '../backup';
import { dateKey } from '../game';
import './DataBackup.css';

function download(text: string, filename: string) {
  const href = URL.createObjectURL(
    new Blob([text], { type: 'application/json;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
export default function DataBackup({
  state,
  connected,
  userId,
  onRestore,
  onNotify,
}: {
  state: GameState;
  connected: boolean;
  userId?: string;
  onRestore: (state: GameState) => void;
  onNotify: (message: string) => void;
}) {
  const [pending, setPending] = useState<GameState | null>(null);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [previous] = useState(() => {
    try {
      return localStorage.getItem(userId ? `play-your-life-account:${userId}:recovery` : recoveryStorageKey);
    } catch {
      return null;
    }
  });
  function apply(next: GameState) {
    try {
      onRestore(next);
      setPending(null);
      setError('');
      onNotify('Игра восстановлена. XP и прогресс сохранены из копии.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось восстановить игру.',
      );
    }
  }
  return (
    <section className="panel backup-panel">
      <h2>Твой план под защитой</h2>
      <p>
        Сохрани проекты, задачи, XP и итоги месяца в файл. Его можно
        восстановить в другом браузере или на другом устройстве.
      </p>
      <div className="backup-actions">
        <button
          className="primary-button"
          onClick={() => {
            download(backupText(state), `play-your-life-${dateKey()}.json`);
            onNotify('Резервная копия скачана');
          }}
        >
          Скачать резервную копию
        </button>
        <button
          className="secondary-button"
          disabled={reading || connected}
          onClick={() => input.current?.click()}
        >
          Восстановить из файла
        </button>
      </div>
      <input
        ref={input}
        type="file"
        tabIndex={-1}
        accept=".json,application/json"
        aria-label="Файл резервной копии"
        className="sr-only"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          setPending(null);
          setError('');
          if (!file) return;
          setReading(true);
          try {
            if (file.size > 10 * 1024 * 1024)
              throw new Error('Выбери файл размером до 10 МБ.');
            setPending(restoreBackup(await file.text()));
          } catch (err) {
            setError(
              err instanceof Error
                ? err.message
                : 'Не удалось прочитать копию.',
            );
          } finally {
            setReading(false);
          }
        }}
      />
      {previous && (
        <button
          className="text-button"
          onClick={() =>
            download(previous, `play-your-life-previous-${dateKey()}.json`)
          }
        >
          Скачать предыдущую копию
        </button>
      )}
      {reading && <p role="status">Читаю резервную копию…</p>}
      {connected && (
        <p className="backup-note">
          Перед восстановлением отключи TickTick в плане жизни, чтобы
          импортированный план не отправился автоматически.
        </p>
      )}
      <small className="backup-note">
        Подключение TickTick хранится отдельно и в файл не включается. Резервная
        копия содержит твои личные записи — храни её у себя.
      </small>
      {pending && (
        <div className="backup-preview">
          <h3>Проверенная копия: {pending.profile.name}</h3>
          <p>
            {pending.goals.length} проектов · {pending.quests.length} задач ·{' '}
            {pending.xp} XP
          </p>
          <p>
            Эта копия заменит текущую игру. Текущая версия останется в браузере
            как предыдущая копия.
          </p>
          <div className="backup-actions">
            <button
              className="primary-button"
              disabled={connected}
              onClick={() => apply(pending)}
            >
              Восстановить эту копию
            </button>
            <button className="text-button" onClick={() => setPending(null)}>
              Отмена
            </button>
          </div>
        </div>
      )}
      {!userId && getStorageProblem() && (
        <div className="backup-recovery">
          <p>{!userId && getStorageProblem()}</p>
          <div className="backup-actions">
            <button
              className="secondary-button"
              onClick={() =>
                download(
                  (getRecoveryRaw() ?? ''),
                  `play-your-life-recovery-${dateKey()}.json`,
                )
              }
            >
              Скачать исходные данные
            </button>
            <button
              className="text-button"
              disabled={connected}
              onClick={() => {
                if (
                  window.confirm(
                    'Сохранить текущую игру вместо нечитаемых данных? Исходные данные останутся в браузере как предыдущая копия.',
                  )
                )
                  apply(state);
              }}
            >
              Использовать текущую игру
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="backup-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}


