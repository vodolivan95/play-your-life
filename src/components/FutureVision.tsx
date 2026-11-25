import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import './FutureVision.css';

/**
 * «Моё будущее» (0.91.0, этап 1 из ТЗ «PLAY YOUR LIFE 2.0 — Моё будущее»).
 * Каркас: четыре вкладки и переключатель горизонта. Расчёты пока не подключены,
 * поэтому никаких цифр, процентов и дат здесь не выводится — только честные пояснения.
 */

type Tab = 'picture' | 'spheres' | 'scenarios' | 'history';
type Horizon = 1 | 3 | 5;

const tabs: { id: Tab; label: string; hint: string }[] = [
  { id: 'picture', label: 'Картина будущего', hint: 'Общий прогноз жизни через 1, 3 и 5 лет.' },
  { id: 'spheres', label: 'Сферы жизни', hint: 'Подробный прогноз развития каждой из двенадцати сфер.' },
  { id: 'scenarios', label: 'Сценарии будущего', hint: 'Сравнение вариантов развития и симулятор «Что будет, если…».' },
  { id: 'history', label: 'История развития', hint: 'Архив прогнозов, сравнение с фактом и точность прогнозов.' },
];

const horizons: Horizon[] = [1, 3, 5];

const NOT_ENOUGH = 'Недостаточно данных для достоверного расчёта. Прогноз носит предварительный характер.';

const blocks: Record<Tab, string[]> = {
  picture: [
    'Главная карточка «Твоя жизнь через {h} {word}» с описанием возможного состояния жизни.',
    'Блок «Чего ты можешь достичь»: достижения, связанная сфера, срок и условия.',
    'Карта развития сфер, ключевые события на временной шкале, риски и рекомендации «Что изменить сегодня».',
  ],
  spheres: [
    'Девять карточек сфер с текущим состоянием и индикатором динамики.',
    'Подробный прогноз сферы: сегодня, через год, через три и пять лет.',
    'Взаимосвязи сфер и блок «Что необходимо сделать».',
  ],
  scenarios: [
    'Три сценария: инерционный, текущий темп и ускоренное развитие.',
    'Интерактивный симулятор с отдельным временным состоянием. Реальные задачи и привычки не меняются.',
    'Сохранение сценариев для повторного сравнения.',
  ],
  history: [
    'Ежемесячные снимки прогноза, которые не перезаписываются.',
    'Сравнение текущего прогноза с прошлыми снимками.',
    'Проверка прогноза по фактическим результатам и хронология жизненного пути.',
  ],
};

const wordFor = (h: Horizon) => (h === 1 ? 'год' : h === 3 ? 'года' : 'лет');

export default function FutureVision() {
  const [tab, setTab] = useState<Tab>('picture');
  const [horizon, setHorizon] = useState<Horizon>(3);

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (next === null) return;
    event.preventDefault();
    setTab(tabs[next].id);
    document.getElementById(`fv-tab-${tabs[next].id}`)?.focus();
  };

  const current = tabs.find((item) => item.id === tab) ?? tabs[0];

  return (
    <section className="fv" aria-label="Моё будущее">
      <header className="fv-head">
        <h2>🔭 Моё будущее</h2>
        <p>Узнай, к чему ведут твои действия</p>
      </header>

      <div className="fv-tabs" role="tablist" aria-label="Разделы прогноза">
        {tabs.map((item, index) => (
          <button
            key={item.id}
            id={`fv-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls="fv-panel"
            tabIndex={tab === item.id ? 0 : -1}
            className={tab === item.id ? 'active' : ''}
            onClick={() => setTab(item.id)}
            onKeyDown={(event) => onTabKey(event, index)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="fv-horizon" role="radiogroup" aria-label="Горизонт прогноза">
        {horizons.map((h) => (
          <button
            key={h}
            type="button"
            role="radio"
            aria-checked={horizon === h}
            className={horizon === h ? 'active' : ''}
            onClick={() => setHorizon(h)}
          >
            Через {h} {wordFor(h)}
          </button>
        ))}
      </div>

      <div id="fv-panel" role="tabpanel" aria-labelledby={`fv-tab-${tab}`} className="fv-panel">
        <article className="fv-card fv-notice">
          <h3>{current.label}</h3>
          <p>{current.hint}</p>
          <p className="fv-status">{NOT_ENOUGH}</p>
        </article>

        <article className="fv-card">
          <h3>Что здесь появится</h3>
          <ul>
            {blocks[tab].map((line) => (
              <li key={line}>{line.replace('{h}', String(horizon)).replace('{word}', wordFor(horizon))}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
