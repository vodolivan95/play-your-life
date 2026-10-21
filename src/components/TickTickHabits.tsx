import { useContext, useState } from 'react';
import { spheres } from '../game';
import type { Habit } from '../personalQuests';
import { TickTickHabitsContext } from '../tickTickContext';
import { extraText, lookbackChoices, syncedText } from '../ticktickHabits';
import './TickTickHabits.css';

const WEEK: [string, number][] = [['Пн', 1], ['Вт', 2], ['Ср', 3], ['Чт', 4], ['Пт', 5], ['Сб', 6], ['Вс', 0]];
const REWARD_COINS = [0, 1, 2, 3, 4, 5];
const lookbackLabel = (days: number) => (days === 0 ? 'Весь период' : `${days} дней`);
const scheduleText = (weekdays: number[]) => (weekdays.length === 7 ? 'каждый день' : WEEK.filter(([, n]) => weekdays.includes(n)).map(([l]) => l).join(', '));
export default function TickTickHabits({ habits, onArchive }: { habits: Habit[]; onArchive: (id: string) => void }) {
  const tt = useContext(TickTickHabitsContext);
  const [panel, setPanel] = useState<'' | 'import' | 'map'>('');
  const [picked, setPicked] = useState<Record<string, { on: boolean; sphere: string; rewardCoins: number }>>({});
  const [lookback, setLookback] = useState(90);
  const [map, setMap] = useState<Record<string, string>>({});
  if (!tt) return null;
  const reauth = tt.code === 'TICKTICK_AUTH_REQUIRED';
  const status = reauth ? 'Требуется повторная авторизация' : tt.connected ? 'Подключён' : 'Не подключён';
  const fresh = tt.candidates.filter((c) => c.state === 'new');
  const skipped = tt.candidates.filter((c) => c.state === 'unsupported');
  const choice = (id: string, sphere: string | null) => picked[id] ?? { on: true, sphere: sphere ?? '', rewardCoins: 0 };
  const chosen = fresh.map((c) => ({ c, v: choice(c.remote.ticktickHabitId, c.sphere) }));
  const ready = chosen.filter(({ v }) => v.on && v.sphere);
  const missing = chosen.filter(({ v }) => v.on && !v.sphere).length;
  const brokenLinks = Object.entries(tt.links.links).filter(([id, l]) => (l.status === 'archived' || l.status === 'deleted') && habits.some((h) => h.id === id));
  const titleOf = (id: string) => habits.find((h) => h.id === id)?.title ?? 'Привычка';
  const openImport = () => { setPanel('import'); if (!tt.loaded) void tt.load(); };
  const openMap = () => { setPanel('map'); setMap(tt.links.sectionMap); if (!tt.loaded) void tt.load(); };
  return (
    <section className="tth" aria-label="TickTick">
      <div className="tth-head">
        <div><strong>TickTick</strong><span className={`tth-badge${tt.connected && !reauth ? ' is-on' : ''}`}>{tt.busy ? 'Проверяем…' : status}</span></div>
        {tt.lastSyncAt && <small>Последняя синхронизация: {syncedText(tt.lastSyncAt)}</small>}
      </div>
      {!tt.connected && <p className="tth-note">Подключите TickTick: «Профиль → Мой TickTick». После подключения здесь можно импортировать привычки и историю отметок.</p>}
      <div className="tth-actions">
        <button type="button" className="hb-btn" disabled={!tt.connected || tt.busy} title={tt.connected ? undefined : 'Подключите TickTick'} onClick={openImport}>Импортировать привычки</button>
        <button type="button" className="hb-btn" disabled={!tt.connected || tt.busy} title={tt.connected ? undefined : 'Подключите TickTick'} onClick={() => void tt.refreshCheckins()}>Обновить check-in</button>
        <button type="button" className="hb-btn" disabled={!tt.connected || tt.busy} title={tt.connected ? undefined : 'Подключите TickTick'} onClick={openMap}>Настроить соответствия</button>
      </div>
      {(tt.waiting > 0 || tt.failed > 0 || tt.linksDirty) && (
        <p className="tth-warn" role="status">
          {tt.failed > 0 ? 'Локально сохранено, TickTick пока не обновлён.' : tt.waiting > 0 ? 'Отметки отправляются в TickTick…' : 'Связи с TickTick пока не сохранены на сервере. Повторю автоматически.'}
          {tt.failed > 0 && <button type="button" className="hb-btn" onClick={tt.retry}>Повторить</button>}
        </p>
      )}
      {tt.conflicts.length > 0 && (
        <div className="tth-box" role="group" aria-label="Конфликты отметок">
          <strong>Отметки расходятся</strong>
          {tt.conflicts.map((c) => (
            <div key={`${c.localId}:${c.day}`} className="tth-conflict">
              <span>«{c.title}» — {c.day.slice(8)}.{c.day.slice(5, 7)}.{c.day.slice(0, 4)}<small>PLAY YOUR LIFE: выполнено · TickTick: не выполнено</small></span>
              <button type="button" className="hb-btn" disabled={tt.busy} onClick={() => void tt.resolveConflict(c)}>Оставить выполнено</button>
            </div>
          ))}
          <small>Выполненный день нельзя отменить: награда за него уже выплачена.</small>
        </div>
      )}
      {brokenLinks.length > 0 && (
        <div className="tth-box" role="group" aria-label="Привычки, изменённые в TickTick">
          <strong>Изменения в TickTick</strong>
          {brokenLinks.map(([id, l]) => (
            <div key={id} className="tth-conflict">
              <span>«{titleOf(id)}» {l.status === 'deleted' ? 'удалена в TickTick' : 'в архиве TickTick'}<small>История и XP сохранены.</small></span>
              <span className="tth-pair">
                <button type="button" className="hb-btn" disabled={tt.busy} onClick={() => onArchive(id)}>Скрыть</button>
                <button type="button" className="hb-btn" disabled={tt.busy} onClick={() => void tt.unlink(id)}>Оставить локально</button>
              </span>
            </div>
          ))}
          <small>Удалить привычку здесь можно в её окне: «Удалить навсегда».</small>
        </div>
      )}
      {panel === 'import' && (
        <div className="tth-box" role="group" aria-label="Импорт привычек">
          <div className="tth-row">
            <strong>Новые привычки TickTick</strong>
            <label className="tth-select">История<select value={lookback} onChange={(e) => setLookback(Number(e.target.value))}>{lookbackChoices.map((d) => <option key={d} value={d}>{lookbackLabel(d)}</option>)}</select></label>
          </div>
          {!tt.loaded && <p className="tth-note">Загружаю привычки…</p>}
          {tt.loaded && !fresh.length && !skipped.length && <p className="tth-note">Новых привычек для импорта нет.</p>}
          {chosen.map(({ c, v }) => (
            <div key={c.remote.ticktickHabitId} className="tth-item tth-item-col">
              <div className="tth-item">
                <label className="tth-check"><input type="checkbox" checked={v.on} onChange={(e) => setPicked({ ...picked, [c.remote.ticktickHabitId]: { ...v, on: e.target.checked } })} />
                  <span>{c.remote.name}<small>{c.schedule.supported ? scheduleText(c.schedule.weekdays) : ''} · цель {c.remote.goal} {c.remote.unit === 'Count' ? 'раз' : c.remote.unit}{c.remote.sectionName ? ` · раздел «${c.remote.sectionName}»` : ''}{extraText(c.remote) ? ` · ${extraText(c.remote)}` : ''}</small></span></label>
                <label className="tth-select">Сфера<select value={v.sphere} onChange={(e) => setPicked({ ...picked, [c.remote.ticktickHabitId]: { ...v, sphere: e.target.value } })}>
                  <option value="">Без сферы — выберите</option>{spheres.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
              </div>
              {v.on && (
                <fieldset className="tth-reward" aria-label={`Награда за «${c.remote.name}»`}>
                  <legend>Награда за выполнение</legend>
                  <div className="hb-levels tth-levels">
                    {REWARD_COINS.map((n) => (
                      <button key={n} type="button" className={`hb-level${v.rewardCoins === n ? ' is-on' : ''}`} aria-pressed={v.rewardCoins === n} onClick={() => setPicked({ ...picked, [c.remote.ticktickHabitId]: { ...v, rewardCoins: n } })}>
                        <strong>{n}</strong><span>лайфкоин{n === 1 ? '' : 'ов'}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
          ))}
          {missing > 0 && <p className="tth-warn" role="status">Для {missing} {missing === 1 ? 'привычки' : 'привычек'} нет сферы: выберите её вручную или настройте соответствия разделов.</p>}
          {skipped.map((c) => (
            <p key={c.remote.ticktickHabitId} className="tth-note">«{c.remote.name}» не импортируется: расписание {c.schedule.supported ? '' : `«${c.schedule.raw}» `}не поддерживается игрой. Исходное правило не подменяется.</p>
          ))}
          <div className="tth-actions">
            <button type="button" className="hb-btn is-primary" disabled={tt.busy || !ready.length} onClick={() => void tt.importHabits(ready.map(({ c, v }) => ({ id: c.remote.ticktickHabitId, sphere: v.sphere, rewardCoins: v.rewardCoins })), lookback).then(() => setPanel(''))}>Импортировать{ready.length ? ` (${ready.length})` : ''}</button>
            <button type="button" className="hb-btn" disabled={tt.busy || !chosen.length} onClick={() => setPicked(Object.fromEntries(chosen.map(({ c, v }) => [c.remote.ticktickHabitId, { ...v, on: true }])))}>Выбрать все</button>
            <button type="button" className="hb-btn" onClick={() => setPanel('')}>Пропустить</button>
          </div>
          <small>Импортируются привычки и история отметок. Лайфкоины и XP за прошлые дни не начисляются; лайфкоины за выполнение — по выбору выше (0–5, можно без награды), XP начисляется за отметки здесь.</small>
        </div>
      )}
      {panel === 'map' && (
        <div className="tth-box" role="group" aria-label="Соответствие разделов сферам">
          <strong>Раздел TickTick → сфера PLAY YOUR LIFE</strong>
          {!tt.loaded && <p className="tth-note">Загружаю разделы…</p>}
          {tt.loaded && !tt.sections.length && <p className="tth-note">В TickTick нет разделов привычек.</p>}
          {tt.sections.map((s) => {
            const value = map[s.id] ?? map[s.name.toLowerCase()] ?? '';
            return <label key={s.id} className="tth-select tth-map">{s.name || s.id}<select value={value} onChange={(e) => setMap({ ...map, [s.id]: e.target.value })}>
              <option value="">По умолчанию / без сферы</option>{spheres.map((sp) => <option key={sp.id} value={sp.id}>{sp.name}</option>)}</select></label>;
          })}
          <div className="tth-actions">
            <button type="button" className="hb-btn is-primary" disabled={tt.busy} onClick={() => void tt.saveSectionMap(Object.fromEntries(Object.entries(map).filter(([, v]) => v))).then(() => setPanel(''))}>Сохранить соответствия</button>
            <button type="button" className="hb-btn" onClick={() => setPanel('')}>Закрыть</button>
          </div>
        </div>
      )}
      {(tt.message || tt.code) && <p className="tth-msg" role="status">{tt.message}{tt.code && <small> Код: {tt.code}</small>}</p>}
    </section>
  );
}
