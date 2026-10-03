import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  blankReflection,
  monthKey,
  monthLabel,
  monthlySummary,
  moveMonth,
  saveReflection,
  validMonth,
} from '../monthly';
import type { GameState, MonthReflection } from '../game';
import Icon from './Icon';

const prompts = [
  {
    id: 'highlights',
    label: 'Чем я горжусь',
    hint: 'Даже маленькая победа заслуживает места в твоей истории.',
    placeholder: 'Что получилось? Что удалось сделать впервые?',
  },
  {
    id: 'challenges',
    label: 'Что было непросто',
    hint: 'Заметь трудности без осуждения себя.',
    placeholder: 'Что мешало? Где хотелось бы больше поддержки?',
  },
  {
    id: 'lessons',
    label: 'Что я понял о себе',
    hint: 'Опыт становится ценным, когда ты замечаешь выводы.',
    placeholder: 'Какая привычка помогла? Что стоит изменить?',
  },
  {
    id: 'nextMonth',
    label: 'Мой фокус на следующий месяц',
    hint: 'Выбери главное. Не нужно менять всё сразу.',
    placeholder: 'На чём я сосредоточусь? Какой будет первый шаг?',
  },
] as const;
const moods = [
  { icon: '🌧️', label: 'Тяжёлый' },
  { icon: '🌦️', label: 'Неровный' },
  { icon: '🌤️', label: 'Спокойный' },
  { icon: '☀️', label: 'Хороший' },
  { icon: '✨', label: 'Отличный' },
];
export default function MonthlyReview({
  state,
  onChange,
  onSaved,
  storageError,
}: {
  state: GameState;
  onChange: Dispatch<SetStateAction<GameState>>;
  onSaved: () => void;
  storageError: boolean;
}) {
  const [month, setMonth] = useState(monthKey);
  const summary = monthlySummary(state, month);
  const reflection = state.monthlyReflections?.[month] ?? blankReflection();
  const hasNotes = !!(
    reflection.highlights.trim() ||
    reflection.challenges.trim() ||
    reflection.lessons.trim() ||
    reflection.nextMonth.trim() ||
    reflection.mood
  );
  const canFinish = hasNotes && reflection.status !== 'completed';
  function edit(changes: Partial<MonthReflection>) {
    onChange((s) => saveReflection(s, month, { ...changes, status: 'draft' }));
  }
  const scoreAverage = (field: 'before' | 'after') => {
    const values = summary.sphereResults.map((s) => s[field]);
    return values.every((v) => v !== null)
      ? (
          values.reduce<number>((sum, v) => sum + (v ?? 0), 0) / values.length
        ).toFixed(1)
      : '—';
  };
  return (
    <div className="monthly-review">
      <div className="month-toolbar">
        <div className="month-navigation">
          <button
            className="icon-button outlined"
            aria-label="Предыдущий месяц"
            onClick={() => setMonth(moveMonth(month, -1))}
          >
            ←
          </button>
          <label>
            <span className="sr-only">Выбрать месяц</span>
            <input
              type="month"
              aria-label="Выбрать месяц"
              value={month}
              max={monthKey()}
              onChange={(e) => {
                if (validMonth(e.target.value) && e.target.value <= monthKey())
                  setMonth(e.target.value);
              }}
            />
          </label>
          <button
            className="icon-button outlined"
            disabled={month >= monthKey()}
            aria-label="Следующий месяц"
            onClick={() => setMonth(moveMonth(month, 1))}
          >
            <Icon name="arrow" size={17} />
          </button>
        </div>
        <span
          className={`review-state ${reflection.status === 'completed' ? 'completed' : ''}`}
        >
          {reflection.status === 'completed'
            ? '✓ Обзор завершён'
            : summary.current
              ? 'Месяц продолжается'
              : 'Время подвести итоги'}
        </span>
      </div>
      <section className="month-hero">
        <div>
          <div className="pill">ТВОЯ ИСТОРИЯ РОСТА</div>
          <h2>{monthLabel(month)}</h2>
          <p>
            {summary.topSphere
              ? `Больше всего XP в сфере «${summary.topSphere.name}». Каждый шаг считается.`
              : 'Не каждый результат измеряется XP. Заметь то, что было важно тебе.'}
          </p>
        </div>
        <span className="month-hero-art">
          🌙<i>✦</i>
        </span>
        <div className="month-hero-bottom">
          <span>
            {summary.current
              ? 'Промежуточные итоги · месяц ещё не закончен'
              : 'Остановись. Посмотри назад. Выбери следующий шаг.'}
          </span>
          <b>{state.profile.name}</b>
        </div>
      </section>
      {summary.partial && (
        <p className="month-coverage">
          ⓘ Показана сохранённая история. Подробный учёт квестов, целей и Life
          Score{' '}
          {summary.trackingSince
            ? `ведётся с ${new Date(summary.trackingSince).toLocaleDateString('ru-RU')}`
            : 'ещё не начат'}
          . Старые записи могут быть неполными; их XP включён в общий результат.
        </p>
      )}
      <div className="monthly-stats">
        {[
          {
            icon: '⚡',
            value: summary.xp,
            label: 'XP за месяц',
            hint: 'По сохранённым действиям',
          },
          {
            icon: '✓',
            value: summary.quests,
            label: 'Квестов выполнено',
            hint: 'С подробным учётом',
          },
          {
            icon: '🎯',
            value: summary.goals,
            label: 'Целей достигнуто',
            hint: 'С подробным учётом',
          },
          {
            icon: '🔥',
            value: summary.activeDays,
            label: 'Активных дней',
            hint: 'Дни с выполненным квестом',
          },
        ].map((stat) => (
          <section className="panel month-stat" key={stat.label}>
            <span>{stat.icon}</span>
            <b>{stat.value}</b>
            <strong>{stat.label}</strong>
            <small>{stat.hint}</small>
          </section>
        ))}
      </div>
      <div className="month-details">
        <section className="panel month-calendar">
          <div className="section-heading">
            <div>
              <h2>Твой ритм</h2>
              <p>
                Лучшая серия внутри месяца: {summary.longest}{' '}
                {summary.longest === 1 ? 'день' : 'дн.'}
              </p>
            </div>
            <span className="count-chip">
              {summary.activeDays}/{summary.days.length}
            </span>
          </div>
          <div className="calendar-weekdays">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-days">
            {Array.from({ length: summary.offset }, (_, i) => (
              <span key={`empty-${i}`} aria-hidden="true" />
            ))}
            {summary.days.map((day) => (
              <div
                key={day.key}
                role="img"
                className={`calendar-day ${day.active ? 'active' : day.xp > 0 ? 'earned' : ''} ${day.future ? 'future' : ''}`}
                title={`${day.number}: ${day.xp} XP, ${day.quests} квестов`}
                aria-label={`${day.number} ${monthLabel(month)}: ${day.xp} XP, ${day.active ? 'активный день' : 'без выполненных квестов'}`}
              >
                <span>{day.number}</span>
                {day.active && <i />}
              </div>
            ))}
          </div>
          <div className="calendar-legend">
            <span>
              <i /> Выполнен квест
            </span>
            <span>
              <i /> Другой XP
            </span>
          </div>
        </section>
        <section className="panel month-xp">
          <div className="section-heading">
            <div>
              <h2>Из чего сложился XP</h2>
              <p>Реальные действия и заслуженные бонусы.</p>
            </div>
          </div>
          {summary.breakdown
            .filter((row) => row.kind !== 'legacy' || row.xp > 0)
            .map((row) => (
              <div className="xp-breakdown" key={row.kind}>
                <div>
                  <span>{row.label}</span>
                  <b>+{row.xp} XP</b>
                </div>
                <div className="progress">
                  <span
                    style={{
                      width: `${summary.xp ? (row.xp / summary.xp) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          {summary.xp === 0 && (
            <p className="month-empty-copy">
              Здесь появится прогресс после первых действий. А заметки о месяце
              можно заполнить уже сейчас.
            </p>
          )}
        </section>
      </div>
      <section className="panel month-spheres">
        <div className="section-heading">
          <div>
            <h2>Как изменились сферы</h2>
            <p>
              {summary.partial
                ? 'Life Score: от начала доступного учёта до конца периода.'
                : 'Life Score: начало → конец месяца.'}
            </p>
          </div>
          <span className="month-average">
            {scoreAverage('before')} → <b>{scoreAverage('after')}</b>
            <small> / 9</small>
          </span>
        </div>
        <div className="monthly-sphere-list">
          {summary.sphereResults.map((s) => (
            <div className="monthly-sphere" key={s.id}>
              <span
                className="sphere-icon"
                style={{ background: `${s.color}15` }}
              >
                {s.icon}
              </span>
              <div>
                <strong>{s.name}</strong>
                <small>
                  {s.before === null
                    ? 'Оценки пока неизвестны'
                    : `${s.before} → ${s.after} Life Score`}
                </small>
              </div>
              <span
                className={
                  s.delta !== null && s.delta < 0 ? 'negative' : 'positive'
                }
              >
                {s.delta === null
                  ? '—'
                  : s.delta > 0
                    ? `+${s.delta}`
                    : s.delta < 0
                      ? s.delta
                      : 'Без изменений'}
              </span>
              <b>+{s.xp} XP</b>
            </div>
          ))}
        </div>
      </section>
      <section className="panel month-reflection">
        <div className="section-heading">
          <div>
            <h2>Мой взгляд на месяц</h2>
            <p>Цифры — только часть истории. Остальное расскажешь ты.</p>
          </div>
          <span className="reflection-spark">✦</span>
        </div>
        <fieldset className="mood-fieldset">
          <legend>Каким был этот месяц?</legend>
          <div className="mood-options">
            {moods.map((mood, i) => (
              <button
                type="button"
                key={mood.label}
                aria-label={mood.label}
                aria-pressed={reflection.mood === i + 1}
                className={reflection.mood === i + 1 ? 'selected' : ''}
                onClick={() =>
                  edit({ mood: reflection.mood === i + 1 ? null : i + 1 })
                }
              >
                <span>{mood.icon}</span>
                <small>{mood.label}</small>
              </button>
            ))}
          </div>
        </fieldset>
        <div className="reflection-fields">
          {prompts.map((prompt) => (
            <label key={prompt.id}>
              <strong>{prompt.label}</strong>
              <small>{prompt.hint}</small>
              <textarea
                maxLength={2000}
                rows={4}
                value={reflection[prompt.id]}
                placeholder={prompt.placeholder}
                onChange={(e) => edit({ [prompt.id]: e.target.value })}
              />
            </label>
          ))}
        </div>
        <div className="reflection-save">
          <span role="status">
            {storageError
              ? 'Изменения доступны до закрытия страницы'
              : reflection.updatedAt
                ? `${reflection.status === 'completed' ? 'Итоги' : 'Черновик'} сохранены · ${new Date(reflection.updatedAt).toLocaleDateString('ru-RU')}`
                : 'Заметки сохраняются автоматически на устройстве'}
          </span>
          <button
            className="primary-button"
            disabled={!canFinish}
            onClick={() => {
              onChange((s) =>
                saveReflection(s, month, { status: 'completed' }),
              );
              onSaved();
            }}
          >
            <Icon name="check" size={17} />
            {reflection.status === 'completed'
              ? 'Обзор завершён'
              : 'Завершить обзор'}
          </button>
        </div>
        <p className="reflection-note">
          За заполнение итогов XP не начисляется. Можно вернуться и дополнить
          обзор в любой момент.
        </p>
      </section>
      {summary.events.length > 0 && (
        <section className="panel month-history">
          <div className="section-heading">
            <div>
              <h2>Моменты прогресса</h2>
              <p>Последние действия выбранного месяца.</p>
            </div>
          </div>
          {[...summary.events]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 10)
            .map((event) => (
              <div className="history-row" key={event.id}>
                <span>
                  {summary.sphereResults.find((s) => s.id === event.sphere)
                    ?.icon ?? '✦'}
                </span>
                <div>
                  <strong>{event.title}</strong>
                  <small>
                    {new Date(event.date).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                    })}
                  </small>
                </div>
                <span className="xp-tag">+{event.xp} XP</span>
              </div>
            ))}
        </section>
      )}
    </div>
  );
}
