import { useContext } from 'react';
import { spheres } from '../game';
import type { Quest } from '../game';
import { TickTickContext } from '../tickTickContext';
import './TasksAside.css';

const steps = [
  'Задача из TickTick приходит во входящие, пока ты её не разберёшь.',
  'Ты выбираешь сферу, цель и этап. Цель можно создать на месте.',
  'Отметка в игре отмечает задачу и в TickTick. Награда приходит один раз.',
  'Цели и этапы живут только в игре и в TickTick не уходят.',
];

export default function TasksAside({ quests, connected, onSettings }: { quests: Quest[]; connected: boolean; onSettings?: () => void }) {
  const manager = useContext(TickTickContext);
  const done = quests.filter((q) => q.done).length;
  const total = quests.length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const circ = 2 * Math.PI * 42;
  const lists = Object.entries(manager?.connection?.sphereLists ?? {}).filter(([, id]) => id);
  const names = new Map((manager?.projects ?? []).map((p) => [p.id, p.name]));
  const last = manager?.connection?.lastSync;
  return (
    <aside className="tas" aria-label="Сводка">
      <section className="tas-card tas-progress">
        <svg viewBox="0 0 100 100" width="96" height="96" role="img" aria-label={`Выполнено ${done} из ${total}`}>
          <circle cx="50" cy="50" r="42" className="tas-ring-bg" />
          <circle cx="50" cy="50" r="42" className="tas-ring" strokeDasharray={`${(circ * percent) / 100} ${circ}`} transform="rotate(-90 50 50)" />
          <text x="50" y="57" textAnchor="middle">{percent}%</text>
        </svg>
        <div><strong>Прогресс</strong><span>Выполнено {done} из {total}</span></div>
      </section>
      <section className="tas-card">
        <div className="tas-row"><strong>TickTick</strong><b className={connected ? 'is-ok' : ''}>{connected ? 'Подключён' : 'Не подключён'}</b></div>
        {connected && lists.map(([sid, id]) => {
          const sphere = spheres.find((s) => s.id === sid);
          return (
            <div key={sid} className="tas-list"><span>{names.get(id) ?? 'Список'}</span><b>{sphere?.icon} {sphere?.name}</b></div>
          );
        })}
        {connected && (
          <dl className="tas-stats">
            <dt>Последнее обновление</dt><dd>{last ? new Date(last).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</dd>
            <dt>Ждут выбора</dt><dd>{manager?.incoming.length ?? 0}</dd>
            <dt>Связано задач</dt><dd>{Object.keys(manager?.connection?.links ?? {}).length}</dd>
          </dl>
        )}
        <p>Берём задачи на ближайшие 4 месяца. Повторяющиеся задачи далёкого будущего не подтягиваются.</p>
        {connected && (
          <div className="tas-actions">
            <button type="button" disabled={manager?.busy || manager?.inboxBusy} onClick={() => { void manager?.refresh(); void manager?.loadIncoming(); }}>Обновить</button>
            {onSettings && <button type="button" onClick={onSettings}>Настроить</button>}
          </div>
        )}
      </section>
      <section className="tas-card">
        <strong>Как это работает</strong>
        <ol>{steps.map((t) => <li key={t}>{t}</li>)}</ol>
      </section>
    </aside>
  );
}
