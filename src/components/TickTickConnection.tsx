import { useContext, useState } from 'react';
import { TickTickContext } from '../tickTickContext';
import { spheres } from '../game';
export default function TickTickConnection({ demo }: { demo: boolean }) {
  const manager = useContext(TickTickContext);
  const [url, setUrl] = useState(
    () =>
      manager?.connection?.url ??
      import.meta.env.VITE_TICKTICK_BRIDGE_URL ??
      '',
  );
  const [error, setError] = useState('');
  if (!manager) return null;
  async function action(fn: () => Promise<void>) {
    try {
      setError('');
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Проверь подключение.');
    }
  }
  const c = manager.connection;
  return (
    <section className="ticktick-account">
      <div className="eyebrow">ТВОЙ АККАУНТ. ОБЩИЙ ПЛАН.</div>
      <h3>Синхронизация TickTick</h3>
      <p className="muted">
        Связанные задачи, названия, заметки, приоритеты и сроки обновляются в
        обоих приложениях. Выполнение в TickTick приносит XP здесь один раз.
      </p>
      {demo ? (
        <p className="score-note">
          Начни личную игру, чтобы подключить свои задачи. Демо не отправляется
          в аккаунт.
        </p>
      ) : (
        <>
          <label>
            Адрес сервера подключения
            <input
              type="url"
              placeholder="https://play-your-life-ticktick.…workers.dev"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
          <p className="score-note">
            Для подключения нужен настроенный сервер. Пароль TickTick вводится
            только на сайте TickTick.
          </p>
          <div className="account-buttons">
            <button
              className="primary-button"
              disabled={manager.busy || !url}
              onClick={() => action(() => manager.configure(url))}
            >
              Подключить аккаунт
            </button>
            {c && (
              <button
                className="secondary-button"
                disabled={manager.busy}
                onClick={() => action(manager.refresh)}
              >
                Проверить подключение
              </button>
            )}
          </div>
          {c && (
            <>
              <label>
                Список для синхронизации
                <select
                  value={c.projectId}
                  disabled={manager.busy || !manager.projects.length}
                  onChange={(e) => {
                    if (
                      Object.keys(c.links).length &&
                      !window.confirm(
                        'Сменить список? Связи сбросятся; активные задачи будут переданы в новый список.',
                      )
                    )
                      return;
                    manager.update({
                      projectId: e.target.value,
                      links: {},
                      dismissed: [],
                    });
                  }}
                >
                  <option value="">Выбрать список TickTick</option>
                  {c.projectId &&
                    !manager.projects.some((p) => p.id === c.projectId) && (
                      <option value={c.projectId}>Выбранный список</option>
                    )}
                  {manager.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Сфера для новых задач из TickTick
                <select
                  value={c.sphereId}
                  onChange={(e) => manager.update({ sphereId: e.target.value })}
                >
                  {spheres.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.icon} {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="include-shared">
                <input
                  type="checkbox"
                  checked={c.auto}
                  onChange={(e) => manager.update({ auto: e.target.checked })}
                />
                Обновлять автоматически, пока приложение открыто
              </label>
              <label className="include-shared">
                <input
                  type="checkbox"
                  checked={c.deleteRemote}
                  onChange={(e) => {
                    if (
                      e.target.checked &&
                      !window.confirm(
                        'Удалённые здесь связанные задачи также будут удаляться из выбранного списка TickTick. Включить?',
                      )
                    )
                      return;
                    manager.update({ deleteRemote: e.target.checked });
                  }}
                />
                Удалять в TickTick задачи, удалённые здесь
              </label>
              <p className="score-note">
                Новые активные задачи выбранного списка появятся здесь как
                квесты Medium. Цели и этапы хранятся в PLAY YOUR LIFE. При
                одновременном изменении текста сохраняется вариант плана;
                выполненное действие остаётся выполненным.
              </p>
              <div className="account-buttons">
                <button
                  className="secondary-button"
                  disabled={manager.busy || !c.projectId}
                  onClick={() => action(manager.sync)}
                >
                  {manager.busy ? 'Обновляю…' : 'Синхронизировать сейчас'}
                </button>
                <button
                  className="text-button"
                  disabled={manager.busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Отключить синхронизацию? Задачи сохранятся в обоих приложениях.',
                      )
                    )
                      void action(manager.disconnect);
                  }}
                >
                  Отключить
                </button>
              </div>
              {c.lastSync && (
                <small>
                  Последнее обновление:{' '}
                  {new Date(c.lastSync).toLocaleString('ru-RU')}
                </small>
              )}
            </>
          )}
        </>
      )}
      {(error || manager.status) && (
        <p className="transfer-message" role="status">
          {error || manager.status}
        </p>
      )}
    </section>
  );
}
