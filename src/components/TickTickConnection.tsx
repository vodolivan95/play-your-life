import { useContext, useState } from 'react';
import { TickTickContext } from '../tickTickContext';
import { spheres } from '../game';
import { hasTickTickTargets } from '../ticktick';
export default function TickTickConnection({ demo }: { demo: boolean }) {
  const manager = useContext(TickTickContext);
  const sharedUrl = import.meta.env.VITE_TICKTICK_BRIDGE_URL?.trim() ?? '';
  const [url, setUrl] = useState(() => manager?.connection?.url ?? sharedUrl);
  const [error, setError] = useState('');
  if (!manager) return null;
  const c = manager.connection;
  const ready = manager.connected;
  const selected = Object.values(c?.sphereLists ?? {}).filter(Boolean).length;
  async function action(fn: () => Promise<void>) {
    try { setError(''); await fn(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Проверьте подключение.'); }
  }
  return <section className="ticktick-account" aria-label="Настройки TickTick">
    <div className="ticktick-heading"><div><div className="eyebrow">ИНТЕГРАЦИИ АККАУНТА</div><h3>Мой TickTick</h3></div><span className={`ticktick-badge ${ready ? 'is-connected' : ''}`}>{manager.busy ? 'Проверяем…' : ready ? 'Подключён' : 'Не подключён'}</span></div>
    <p className="muted">Подключите свой аккаунт и выберите, какие списки TickTick соответствуют вашим сферам жизни.</p>
    {demo || (!manager.signedIn && !c) ? <p className="score-note">Войдите или зарегистрируйтесь в PLAY YOUR LIFE, чтобы настроить личную синхронизацию. Демо и игра на устройстве не передаются в TickTick.</p> : <>
      {!sharedUrl && <div className="ticktick-setup-note"><strong>Подключение сайта ещё не настроено</strong><p>Владелец сайта должен один раз опубликовать сервер подключения. После настройки пользователи смогут подключать свои аккаунты этой кнопкой.</p><a href="https://github.com/vodolivan95/play-your-life/blob/main/docs/TICKTICK-SETUP.md" target="_blank" rel="noreferrer">Инструкция по настройке →</a></div>}
      {(!sharedUrl || (c && c.url !== sharedUrl)) && <details className="ticktick-server-settings"><summary>Дополнительные настройки сервера</summary><label>Адрес сервера подключения<input type="url" placeholder="https://play-your-life-ticktick.…workers.dev" value={url} disabled={manager.busy} onChange={e => setUrl(e.target.value)} /></label><p className="score-note">Только публичный адрес сервера. Пароль вводится на сайте TickTick; ключи приложения здесь не нужны.</p></details>}
      <div className="account-buttons">
        <button className="primary-button" disabled={manager.busy || !url || !manager.signedIn} onClick={() => {
          if (ready && !window.confirm('Повторный вход может подключить другой TickTick. Сопоставление списков потребуется настроить заново; задачи сохранятся. Продолжить?')) return;
          void action(() => manager.configure(url));
        }}>{ready ? 'Переподключить TickTick' : 'Подключить TickTick'}</button>
        {c && <button className="secondary-button" disabled={manager.busy} onClick={() => {
          if (manager.dirty && !window.confirm('Обновить настройки из аккаунта? Несохранённый выбор списков на этом устройстве будет заменён.')) return;
          void action(manager.refresh);
        }}>Обновить подключение</button>}
      </div>
      {!ready && <p className="score-note">После разрешения доступа на сайте TickTick вы вернётесь сюда. Подключение подтверждается загрузкой ваших списков, затем можно настроить обмен.</p>}
      {c && ready && <>
        {c.auth !== 'firebase' && <p className="score-note">Это прежнее подключение на устройстве. Войдите в PLAY YOUR LIFE и переподключите TickTick для сохранения настроек в аккаунте.</p>}
        <div className="sphere-list-mappings">
          <div className="ticktick-mapping-heading"><h4>Сфера жизни → мой список TickTick</h4><span>{selected} из {spheres.length}</span></div>
          <p className="muted">Названия могут отличаться: например, «Спорт» → «Мои тренировки». Сфера без выбранного списка не отправляет новые задачи.</p>
          <button className="text-button" disabled={manager.busy || !manager.projects.length} onClick={manager.suggest}>Предложить совпадения по названиям</button>
          {!manager.projects.length && <p className="score-note">Нет доступных списков задач. Создайте список в TickTick и обновите подключение. Списки заметок не подходят для обмена задачами.</p>}
          {spheres.map(sphere => {
            const id = c.sphereLists?.[sphere.id] ?? '';
            const missing = Boolean(id && !manager.projects.some(p => p.id === id));
            return <label className="sphere-list-mapping" key={sphere.id}><span>{sphere.icon} {sphere.name}</span><select aria-label={`Список TickTick: ${sphere.name}`} value={id} disabled={manager.busy} onChange={e => manager.update({ sphereLists: { ...c.sphereLists, [sphere.id]: e.target.value } })}>
              <option value="">Не синхронизировать</option>
              {missing && <option value={id}>Сохранённый список недоступен</option>}
              {manager.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>{missing && <small>Выберите доступный список или отключите эту сферу.</small>}</label>;
          })}
        </div>
        <label className="include-shared"><input type="checkbox" checked={c.auto} disabled={manager.busy} onChange={e => manager.update({ auto: e.target.checked })} />Обновлять автоматически, пока приложение открыто</label>
        <label className="include-shared"><input type="checkbox" checked={c.deleteRemote} disabled={manager.busy} onChange={e => {
          if (e.target.checked && !window.confirm('Удалённые здесь связанные задачи также будут удаляться в TickTick. Включить?')) return;
          manager.update({ deleteRemote: e.target.checked });
        }} />Удалять в TickTick связанные задачи, удалённые здесь</label>
        <p className="score-note">Передаются конкретные задачи ваших целей. Уже связанные задачи сохраняют свой список: новый выбор применяется к новым задачам. Посторонние задачи TickTick, самостоятельные квесты и привычки не импортируются. Цели и этапы остаются в PLAY YOUR LIFE.</p>
        {manager.dirty && <p className="ticktick-unsaved" role="status">Есть несохранённые настройки. Обмен приостановлен до сохранения.</p>}
        <div className="account-buttons">
          <button className="primary-button" disabled={manager.busy || !manager.dirty || spheres.some(s => c.sphereLists?.[s.id] && !manager.projects.some(p => p.id === c.sphereLists?.[s.id]))} onClick={() => void action(manager.save)}>Сохранить настройки</button>
          <button className="secondary-button" disabled={manager.busy || manager.dirty || !hasTickTickTargets(c)} onClick={() => void action(() => manager.sync())}>Синхронизировать сейчас</button>
        </div>
        {c.lastSync && <small>Последняя попытка обмена: {new Date(c.lastSync).toLocaleString('ru-RU')}</small>}
      </>}
      {c && <button className="text-button" disabled={manager.busy} onClick={() => {
        if (window.confirm('Отключить TickTick для этого подключения? Задачи и прогресс сохранятся.')) void action(manager.disconnect);
      }}>Отключить TickTick</button>}
    </>}
    {(error || manager.status) && <p className="transfer-message" role="status">{error || manager.status}</p>}
  </section>;
}
