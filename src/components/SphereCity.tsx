import { useId } from 'react';
import type { CSSProperties } from 'react';
import { spheres } from '../game';
import type { GameState, Goal } from '../game';
import { formatDate, goalStatus } from '../planning';
import GameArt from './GameArt';
import Icon from './Icon';
import './SphereCity.css';

const buildings: Record<string, [string, string, string]> = {
  health: ['Центр здоровья', '#f4e5d1', '#5bc3aa'],
  sport: ['Спортивный клуб', '#e1edf9', '#399eda'],
  growth: ['Библиотека знаний', '#eee3d6', '#8f7ad0'],
  english: ['Языковая академия', '#f0ddcc', '#dc7e74'],
  finance: ['Банк возможностей', '#dbe8e4', '#3ca99c'],
  together: ['Дом общих дел', '#ffe8d7', '#e492ad'],
  driving: ['Автошкола', '#dce9ed', '#56a8c8'],
  tasks: ['Мастерская планов', '#e3e7f3', '#6c90cf'],
  hobby: ['Дом творчества', '#f7e5cf', '#e4ac54'],
};

// Original vector scenery: each life sphere has its own building and landmark.
export function SphereBuilding({ id }: { id: string }) {
  const uid = useId().replace(/:/g, '');
  const [name, wall, roof] = buildings[id];
  const tall = id === 'finance' || id === 'tasks';
  const top = tall ? 35 : 65;
  return (
    <svg
      className="sphere-building"
      viewBox="0 0 300 160"
      role="img"
      aria-label={name}
    >
      <defs>
        <linearGradient id={`${uid}-sky`} x2="0" y2="1">
          <stop stopColor="#a9deef" />
          <stop offset="1" stopColor="#eefbff" />
        </linearGradient>
        <linearGradient id={`${uid}-grass`} x2="1" y2="1">
          <stop stopColor="#8cd8ab" />
          <stop offset="1" stopColor="#3aa481" />
        </linearGradient>
        <linearGradient id={`${uid}-roof`} x2="1" y2="1">
          <stop stopColor={roof} />
          <stop offset="1" stopColor="#34576a" />
        </linearGradient>
      </defs>
      <rect width="300" height="160" fill={`url(#${uid}-sky)`} />
      <circle cx="251" cy="29" r="17" fill="#fff5c6" opacity=".9" />
      <path
        d="M0 82Q40 40 80 77Q135 25 197 79Q245 48 300 82V160H0Z"
        fill="#87b8a2"
        opacity=".5"
      />
      <path
        d="M0 113Q95 67 190 101L300 87V160H0Z"
        fill={`url(#${uid}-grass)`}
      />
      <path d="M0 147L175 91L300 128V145L75 160H0Z" fill="#cdd5ca" />
      <path
        d="M27 149L171 105L277 135"
        fill="none"
        stroke="#f8f3dd"
        strokeWidth="2"
        strokeDasharray="10 7"
      />
      <ellipse cx="155" cy="133" rx="78" ry="17" fill="#326b68" opacity=".18" />
      <path
        d={`M76 ${top + 16}L160 ${top + 3}L215 ${top + 24}V119L132 143L76 120Z`}
        fill={wall}
      />
      <path
        d={`M160 ${top + 3}L215 ${top + 24}V119L160 134Z`}
        fill="#7d9caa"
        opacity=".4"
      />
      <path
        d={`M65 ${top + 18}L156 ${top - 5}L226 ${top + 20}L160 ${top + 36}Z`}
        fill={`url(#${uid}-roof)`}
      />
      <path
        d={`M65 ${top + 18}L160 ${top + 36}V${top + 42}L65 ${top + 24}Z`}
        fill={roof}
      />
      {[0, 1, 2].map((row) =>
        !tall && row > 0
          ? null
          : [0, 1, 2, 3].map((col) => (
              <path
                key={`${row}-${col}`}
                d={`M${85 + col * 17} ${top + 39 + row * 20}l11 -3v13l-11 3Z`}
                fill="#508daf"
                stroke="#f1faff"
                strokeWidth="2"
              />
            )),
      )}
      <path d="M126 113L146 108V138L126 144Z" fill="#385d72" />
      <path d="M117 141L145 134L155 139L126 150Z" fill="#f6ecdb" />
      {(id === 'growth' || id === 'english' || id === 'finance') &&
        [85, 108, 176, 196].map((x) => (
          <path
            key={x}
            d={`M${x} ${top + 40}V122`}
            stroke="#fff7e4"
            strokeWidth="5"
          />
        ))}
      {id === 'growth' && (
        <g>
          <path
            d="M128 42l18-4 18 9v19l-18-8-18 4Z"
            fill="#fff7df"
            stroke="#9278ce"
            strokeWidth="2"
          />
          <path d="M146 38v20" stroke="#9278ce" strokeWidth="2" />
        </g>
      )}
      {id === 'finance' && (
        <g>
          <circle
            cx="174"
            cy="43"
            r="10"
            fill="#ffe6a0"
            stroke="#f2c863"
            strokeWidth="2"
          />
          <path
            d="M176 36h-6v6h6v6h-7m4-14v16"
            stroke="#b98734"
            fill="none"
            strokeWidth="2"
          />
        </g>
      )}
      {id === 'tasks' && (
        <g>
          <path d="M171 48l24 9v53l-24 7Z" fill="#7bbed9" />
          <path
            d="M178 51v64m9-61v58m-16-43l24 6m-24 11l24 4m-24 12l24 2"
            stroke="#e7f8ff"
            strokeWidth="2"
          />
        </g>
      )}
      {id === 'driving' && (
        <g>
          <path d="M170 97l30-8v33l-30 8Z" fill="#365e74" />
          <path
            d="M172 101l26-7m-26 14l26-7m-26 14l26-7m-26 14l26-7"
            stroke="#86a8b3"
            strokeWidth="2"
          />
        </g>
      )}
      {id === 'health' && (
        <g fill="white">
          <rect x="173" y="80" width="24" height="7" rx="1" />
          <rect x="182" y="72" width="7" height="24" rx="1" />
        </g>
      )}
      {id === 'sport' && (
        <g>
          <ellipse
            cx="245"
            cy="128"
            rx="29"
            ry="14"
            fill="#49bbd5"
            stroke="#f4f8e4"
            strokeWidth="5"
          />
          <path d="M221 128h49" stroke="white" strokeWidth="1" />
        </g>
      )}
      {id === 'english' && (
        <g>
          <path d="M230 48v62" stroke="#5b647a" strokeWidth="3" />
          <path d="M232 49h30v20h-30Z" fill="#3974b6" />
          <path d="M232 49l30 20m0-20l-30 20" stroke="white" strokeWidth="3" />
          <path d="M247 49v20m-15-10h30" stroke="#e7727b" strokeWidth="4" />
        </g>
      )}
      {id === 'driving' && (
        <g>
          <rect x="211" y="126" width="34" height="12" rx="5" fill="#3989e4" />
          <path d="M220 126l5-7h12l5 7Z" fill="#b3e8f4" />
          <circle cx="219" cy="137" r="4" fill="#35546b" />
          <circle cx="239" cy="137" r="4" fill="#35546b" />
        </g>
      )}
      {id === 'hobby' && (
        <g>
          <circle cx="234" cy="106" r="17" fill="#f8e8c6" />
          <path
            d="M230 114V95l12-3v17m-12-2h-5m17-5h-5"
            fill="none"
            stroke="#c98b68"
            strokeWidth="3"
          />
        </g>
      )}
      {id === 'together' && (
        <path d="M167 54c-10-12-25 4 0 19c25-15 10-31 0-19" fill="#ed86a5" />
      )}
      {[24, 53, 270].map((x, i) => (
        <g key={x}>
          <path
            d={`M${x} ${130 - i * 12}q-4-26 0-47`}
            fill="none"
            stroke="#9b8055"
            strokeWidth="5"
          />
          <path
            d={`M${x} ${83 - i * 12}q-20-16-23 9q16-10 23-9q18-20 26 4q-16-7-26-4q-6-23-18-19q10 7 18 19q7-23 19-15q-12 5-19 15`}
            fill="#278e74"
          />
        </g>
      ))}
      <g fill="#ffe6a0">
        <circle cx="43" cy="144" r="3" />
        <circle cx="255" cy="148" r="3" />
        <circle cx="64" cy="125" r="2" />
      </g>
    </svg>
  );
}

export function SphereDistricts({
  state,
  selected,
  onSelect,
}: {
  state: GameState;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="districts" aria-label="Мои сферы жизни">
      <div className="districts-heading">
        <span>МОИ СФЕРЫ</span>
        <small>Твой город жизни · {spheres.length} районов</small>
      </div>
      <div className="district-strip">
        {spheres.map((s) => (
          <button
            key={s.id}
            className={`district-card ${selected === s.id ? 'is-selected' : ''}`}
            aria-pressed={selected === s.id}
            onClick={() => onSelect(s.id)}
            style={{ '--district-color': s.color } as CSSProperties}
          >
            <SphereBuilding id={s.id} />
            <div className="district-caption">
              <GameArt kind={s.id} />
              <div>
                <strong>{s.name}</strong>
                <span>{state.spheres[s.id].score} / 9</span>
              </div>
            </div>
            <div className="district-meter">
              <span
                style={{ width: `${(state.spheres[s.id].score / 9) * 100}%` }}
              />
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

const templates: Record<string, [string, string, string][]> = {
  health: [
    ['🚭', 'Бросить курить', 'Постепенно отказаться от курения'],
    ['🦷', 'Вылечить все зубы', 'Обследование и план лечения'],
    ['🌙', 'Наладить сон', 'Выстроить комфортный режим сна'],
    ['🥗', 'Правильное питание', 'Собрать свой сбалансированный рацион'],
    ['💧', 'Пить больше воды', 'Поддерживать полезную привычку'],
    ['🩺', 'Пройти обследование', 'Позаботиться о профилактике'],
  ],
  sport: [
    ['🏋️', 'Регулярные тренировки', 'Составить план и тренироваться'],
    ['🏃', 'Пробежать 5 км', 'Развивать выносливость'],
    ['🧘', 'Гибкость и мобильность', 'Регулярная растяжка'],
  ],
  growth: [
    ['📖', 'Прочитать 12 книг', 'Читать и применять новые идеи'],
    ['🎓', 'Освоить новый навык', 'Пройти курс и практиковаться'],
    ['🧠', 'Развить концентрацию', 'Создать привычку глубокого обучения'],
  ],
  english: [
    ['🎧', '100 часов аудирования', 'Слушать и понимать английскую речь'],
    ['🌍', 'Английский — уровень B2', 'Развивать язык по этапам'],
    ['💬', 'Разговорная практика', 'Общаться на английском увереннее'],
  ],
  finance: [
    ['🛟', 'Финансовая подушка', 'Создать запас на непредвиденные расходы'],
    ['💰', 'План накоплений', 'Двигаться к финансовой цели'],
    ['📊', 'Личный бюджет', 'Разобраться с доходами и расходами'],
  ],
  together: [
    ['🤝', 'Общий проект', 'Разделить этапы и ответственность'],
    ['🏡', 'Обустройство дома', 'Сделать пространство комфортнее'],
    ['🧳', 'Совместная поездка', 'Спланировать путешествие'],
  ],
  driving: [
    ['🚗', 'Получить права', 'Теория, практика и экзамен'],
    ['🅿️', 'Уверенная парковка', 'Отработать манёвры'],
    ['🛣️', 'Практика вождения', 'Стать увереннее за рулём'],
  ],
  tasks: [
    ['📝', 'Разобрать накопившиеся дела', 'Освободить внимание для важного'],
    ['🗓️', 'Система личного планирования', 'Настроить свой ритм'],
    ['🧹', 'Порядок дома', 'Организовать пространство'],
  ],
  hobby: [
    ['🎨', 'Творческий проект', 'Создать что-то своими руками'],
    ['🎸', 'Освоить инструмент', 'Учиться и получать удовольствие'],
    ['🌴', 'Спланировать отдых', 'Найти время для восстановления'],
  ],
};

export function SphereProjects({
  state,
  id,
  onOpen,
  onNew,
  onTemplate,
}: {
  state: GameState;
  id: string;
  onOpen: (goal: Goal) => void;
  onNew: () => void;
  onTemplate: (name: string, description: string) => void;
}) {
  const goals = state.goals.filter((g) => g.sphere === id);
  const active = goals.filter((g) => g.current < g.target);
  const completed = goals.filter((g) => g.current >= g.target);
  function card(goal: Goal) {
    const tasks = state.quests.filter((q) => q.goalId === goal.id);
    const done = tasks.filter((q) => q.done).length;
    const next = goal.stages?.find((stage) =>
      tasks.some((q) => q.stageId === stage.id && !q.done),
    );
    const percent = Math.min(
      100,
      Math.round((goal.current / goal.target) * 100),
    );
    return (
      <article className="district-project" key={goal.id}>
        <div className="project-heading">
          <span className="project-art">
            <GameArt kind={id} />
          </span>
          <div>
            <h3>
              <button onClick={() => onOpen(goal)}>{goal.name}</button>
            </h3>
            <p>{goal.description || 'Каждая задача — шаг к твоей цели.'}</p>
          </div>
        </div>
        <div className="project-tags">
          <span>{goalStatus(goal)}</span>
          <span>
            {goal.progressMode === 'tasks' ? 'По задачам' : 'По результату'}
          </span>
        </div>
        <div className="project-numbers">
          <div>
            <small>Текущий прогресс</small>
            <strong>{percent}%</strong>
            <span>
              {goal.progressMode === 'tasks'
                ? `${done} / ${tasks.length} задач`
                : `${goal.current} / ${goal.target}`}
            </span>
          </div>
          <div>
            <small>Следующий этап</small>
            <b>
              {next?.name ||
                (percent === 100 ? 'Цель достигнута' : 'План проекта')}
            </b>
            <span className="xp-tag">
              ⚡ +{goal.reward} XP{goal.rewarded ? ' · получены' : ''}
            </span>
          </div>
        </div>
        <div className="progress">
          <span style={{ width: `${percent}%` }} />
        </div>
        <div className="project-footer">
          <span>{goal.dueAt ? formatDate(goal.dueAt) : 'Гибкий срок'}</span>
          <button className="primary-button" onClick={() => onOpen(goal)}>
            Открыть <Icon name="arrow" size={14} />
          </button>
        </div>
      </article>
    );
  }
  return (
    <div className="district-projects">
      <div className="section-heading">
        <h2>
          Активные проекты{' '}
          <span className="project-count">{active.length}</span>
        </h2>
        <button className="primary-button" onClick={onNew}>
          <Icon name="plus" size={16} /> Добавить проект
        </button>
      </div>
      {active.length ? (
        <div className="district-project-grid">{active.map(card)}</div>
      ) : (
        <div className="district-empty">
          <h3>Здесь начинается развитие этой сферы</h3>
          <p>
            Создай свой проект или выбери идею ниже. Внутри можно добавлять
            этапы и конкретные задачи.
          </p>
        </div>
      )}
      {completed.length > 0 && (
        <>
          <h2 className="project-section-title">
            Завершённые проекты{' '}
            <span className="project-count">{completed.length}</span>
          </h2>
          <div className="district-project-grid">{completed.map(card)}</div>
        </>
      )}
      <h2 className="project-section-title">Идеи проектов</h2>
      <p className="muted">
        Выбери то, что важно тебе. Добавленный проект можно настроить под себя.
      </p>
      <div className="district-project-grid">
        {templates[id].map(([icon, name, description]) => (
          <article className="district-project project-template" key={name}>
            <div className="project-heading">
              <span className="template-art">{icon}</span>
              <div>
                <h3>{name}</h3>
                <p>{description}</p>
              </div>
            </div>
            <button
              className="secondary-button"
              disabled={goals.some((g) => g.name === name)}
              onClick={() => onTemplate(name, description)}
            >
              {goals.some((g) => g.name === name)
                ? 'Уже в твоих проектах'
                : '+ Добавить в мои проекты'}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
