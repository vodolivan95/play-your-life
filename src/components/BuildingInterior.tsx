import { MAX_SPHERE_LEVEL, sphereProgress } from '../sphereProgress';
import { useState } from 'react';
import type { GameState } from '../game';
import { spheres } from '../game';
import {
  buildingState,
  buyCityDecor,
  changeBuildingStyle,
  cityDecor,
  placeCityDecor,
  upgradeBuilding,
} from '../city';
import type { CityStyle } from '../city';
import RoomScene from './RoomScene';
import './BuildingInterior.css';
const names: Record<string, string> = {
  health: 'Центр здоровья',
  sport: 'Спортивный клуб',
  growth: 'Библиотека знаний',
  english: 'Языковая академия',
  finance: 'Банк возможностей',
  together: 'Дом общих дел',
  driving: 'Автошкола',
  tasks: 'Мастерская планов',
  hobby: 'Дом творчества',
};
const tiers = ['Базовое здание', 'Обустроенное здание', 'Резиденция мастера'];
export default function BuildingInterior({
  id,
  state,
  onChange,
  notify,
  onBack,
  onSphere,
}: {
  id: string;
  state: GameState;
  onChange: (state: GameState) => void;
  notify: (message: string) => void;
  onBack: () => void;
  onSphere: () => void;
}) {
  const b = buildingState(state, id);
  const s = spheres.find((s) => s.id === id)!;
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [tab, setTab] = useState<'improve' | 'decorate'>('improve');
  const cost = b.tier === 1 ? 60 : 120;
  const sphereLevel = sphereProgress(state.spheres[id].xp).level;
  const ready = state.coins >= cost && sphereLevel >= b.tier + 1;
  function act(action: () => GameState, message: string) {
    try {
      onChange(action());
      notify(message);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Не удалось изменить здание.');
    }
  }
  return (
    <section className="building-interior">
      <div className="building-topbar">
        <button className="text-button" onClick={onBack}>
          ← Вернуться в город
        </button>
        <span className="city-balance">🪙 {state.coins} монет</span>
      </div>
      <div className="building-title">
        <div>
          <span className="eyebrow">
            {s.name.toUpperCase()} · ТВОЁ ПРОСТРАНСТВО
          </span>
          <h2>
            {s.icon} {names[id]}
          </h2>
          <p>
            {tiers[b.tier - 1]} · Улучшение {b.tier}/3 · Уровень сферы{' '}
            {sphereLevel} / {MAX_SPHERE_LEVEL}
          </p>
        </div>
        <button className="secondary-button" onClick={onSphere}>
          Сфера и квесты →
        </button>
      </div>
      <div className="building-workspace">
        <div className="building-scene-wrap">
          <RoomScene id={id} building={b} icon={s.icon} />
          {b.slots.map((item, slot) => {
            const decor = cityDecor.find((x) => x.id === item);
            return (
              <button
                key={slot}
                className={`building-decor-slot slot-${slot} ${item ? 'occupied' : ''}`}
                aria-label={`Место ${slot + 1}${decor ? `: ${decor.name}` : ''}`}
                title={
                  selectedItem
                    ? `Поставить ${cityDecor.find((x) => x.id === selectedItem)?.name}`
                    : 'Выбери предмет справа, затем нажми на место'
                }
                onClick={() => {
                  if (selectedItem) {
                    act(
                      () => placeCityDecor(state, id, selectedItem, slot),
                      'Предмет установлен.',
                    );
                    setSelectedItem(null);
                  } else if (item) {
                    act(
                      () => placeCityDecor(state, id, null, slot),
                      'Предмет убран в инвентарь.',
                    );
                  }
                }}
              >
                <span>{decor?.icon ?? '＋'}</span>
                {!item && <small>Место {slot + 1}</small>}
              </button>
            );
          })}
          <div className="building-scene-tip">
            {selectedItem
              ? 'Нажми на место в окружении, чтобы поставить предмет.'
              : 'Купленные предметы можно переставлять. Нажми на предмет в сцене, чтобы убрать его.'}
          </div>
        </div>
        <aside className="building-editor">
          <div className="building-edit-tabs">
            <button
              className={tab === 'improve' ? 'selected' : ''}
              onClick={() => setTab('improve')}
            >
              Улучшения
            </button>
            <button
              className={tab === 'decorate' ? 'selected' : ''}
              onClick={() => setTab('decorate')}
            >
              Окружение
            </button>
          </div>
          {tab === 'improve' ? (
            <>
              <h3>Развивай своё здание</h3>
              <p>
                Новые уровни сферы открывают улучшения. Монеты за квесты
                превращаются в детали твоего острова.
              </p>
              <div className="building-tier-track">
                {tiers.map((title, i) => (
                  <div
                    key={title}
                    className={b.tier >= i + 1 ? 'unlocked' : ''}
                  >
                    <b>{i + 1}</b>
                    <span>
                      {title}
                      <small>
                        {i === 0
                          ? 'Старт'
                          : i === 1
                            ? 'Свет, зелень и отделка'
                            : 'Золотые акценты и терраса'}
                      </small>
                    </span>
                    {b.tier >= i + 1 && <span>✓</span>}
                  </div>
                ))}
              </div>
              {b.tier < 3 ? (
                <>
                  <button
                    className="primary-button"
                    disabled={!ready}
                    onClick={() =>
                      act(
                        () => upgradeBuilding(state, id, b.tier),
                        'Здание улучшено!',
                      )
                    }
                  >
                    Улучшить · {cost} 🪙
                  </button>
                  {!ready && (
                    <small className="building-requirement">
                      {sphereLevel < b.tier + 1
                        ? `Нужен уровень сферы ${b.tier + 1}. `
                        : ''}
                      {state.coins < cost
                        ? `Не хватает ${cost - state.coins} монет.`
                        : ''}
                    </small>
                  )}
                </>
              ) : (
                <p className="building-max">
                  ✦ Максимальное улучшение достигнуто
                </p>
              )}
              <h3>Оформление</h3>
              <div className="building-style-options">
                {(
                  [
                    ['coastal', 'Морской', '#83c7f1'],
                    ['tropical', 'Тропический', '#7cb69a'],
                    ['modern', 'Современный', '#9c92dc'],
                  ] as [CityStyle, string, string][]
                ).map(([style, title, color]) => (
                  <button
                    key={style}
                    className={b.style === style ? 'selected' : ''}
                    aria-pressed={b.style === style}
                    onClick={() =>
                      act(
                        () => changeBuildingStyle(state, id, style),
                        'Оформление изменено.',
                      )
                    }
                  >
                    <i style={{ background: color }} />
                    {title}
                    {b.style === style && ' ✓'}
                  </button>
                ))}
              </div>
              <small>Смена оформления бесплатна.</small>
            </>
          ) : (
            <>
              <h3>Обустроить окружение</h3>
              <p>
                Выбери предмет и поставь его на свободное место. Купленный
                предмет можно перемещать без повторной оплаты.
              </p>
              <div className="building-decor-shop">
                {cityDecor.map((item) => {
                  const owned = b.owned.includes(item.id);
                  return (
                    <div
                      className={selectedItem === item.id ? 'selected' : ''}
                      key={item.id}
                    >
                      <span>{item.icon}</span>
                      <div>
                        <strong>{item.name}</strong>
                        <small>
                          {owned ? 'В инвентаре' : `${item.price} монет`}
                        </small>
                      </div>
                      <button
                        disabled={!owned && state.coins < item.price}
                        onClick={() => {
                          if (owned) {
                            setSelectedItem(item.id);
                          } else {
                            try {
                              onChange(buyCityDecor(state, id, item.id));
                              setSelectedItem(item.id);
                              notify(
                                'Предмет куплен. Выбери место в окружении.',
                              );
                            } catch (e) {
                              notify(
                                e instanceof Error
                                  ? e.message
                                  : 'Не удалось купить.',
                              );
                            }
                          }
                        }}
                      >
                        {owned ? 'Поставить' : 'Купить'}
                      </button>
                    </div>
                  );
                })}
              </div>
              {selectedItem && (
                <button
                  className="text-button"
                  onClick={() => setSelectedItem(null)}
                >
                  Отменить размещение
                </button>
              )}
            </>
          )}
          <p className="building-local-note">
            Изменения сохраняются в твоей игре. Улучшения не начисляют XP и не
            меняют уровень сферы.
          </p>
        </aside>
      </div>
    </section>
  );
}
