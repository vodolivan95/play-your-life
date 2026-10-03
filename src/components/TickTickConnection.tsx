import { useContext, useState } from 'react';
import { TickTickContext } from '../tickTickContext';
import { spheres } from '../game';
import {
  hasTickTickTargets,
  matchSphereLists,
  tickTickListNames,
} from '../ticktick';
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
        Новые подзадачи целей отправляются в список TickTick своей сферы:
        здоровье — в «Здоровье», английский — в выбранный список английского.
        Цели, проекты и этапы остаются в PLAY YOUR LIFE. Выполнение подзадачи в
        TickTick обновляет её прогресс здесь.
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
              <div className="sphere-list-mappings">
                <h4>Сфера жизни → список TickTick</h4>
                <p className="muted">
                  Выбери, куда отправлять конкретные подзадачи каждой сферы.
                </p>
                <button
                  className="text-button"
                  disabled={manager.busy || !manager.projects.length}
                  onClick={() =>
                    manager.update({
                      sphereLists: matchSphereLists(
                        manager.projects,
                        c.sphereLists,
                      ),
                    })
                  }
                >
                  Сопоставить по названиям
                </button>
                {spheres.map((sphere) => {
                  const projectId = c.sphereLists?.[sphere.id] ?? '';
                  return (
                    <label className="sphere-list-mapping" key={sphere.id}>
                      <span>
                        {sphere.icon} {sphere.name}
                      </span>
                      <select
                        aria-label={`Список TickTick: ${sphere.name}`}
                        value={projectId}
                        disabled={manager.busy || !manager.projects.length}
                        onChange={(e) =>
                          manager.update({
                            sphereLists: {
                              ...c.sphereLists,
                              [sphere.id]: e.target.value,
                            },
                          })
                        }
                      >
                        <option value="">
                          Не подключено · {tickTickListNames[sphere.id]}
                        </option>
                        {projectId &&
                          !manager.projects.some((p) => p.id === projectId) && (
                            <option value={projectId}>
                              Сохранённый список (проверь доступ)
                            </option>
                          )}
                        {manager.projects.map((project) => (
                          <option key={project.id} value={project.id}>
                            {project.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
                <p className="score-note">
                  Список «Работа» пока не связан со сферой. Без сопоставления
                  новые задачи сферы остаются здесь. Уже отправленные задачи
                  сохраняют свой список и связь; смена сопоставления применяется
                  к новым задачам.
                </p>
              </div>
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
                        'Удалённые здесь связанные задачи также будут удаляться из своих списков TickTick. Включить?',
                      )
                    )
                      return;
                    manager.update({ deleteRemote: e.target.checked });
                  }}
                />
                Удалять в TickTick задачи, удалённые здесь
              </label>
              <p className="score-note">
                Передаются только задачи, привязанные к целям. Самостоятельные
                квесты и посторонние задачи TickTick не участвуют в обмене.
                Проекты и крупные цели в TickTick не создаются. При
                одновременном изменении текста сохраняется вариант плана;
                выполненное действие остаётся выполненным.
              </p>
              <div className="account-buttons">
                <button
                  className="secondary-button"
                  disabled={manager.busy || !hasTickTickTargets(c)}
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
