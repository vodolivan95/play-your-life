import CityBuildingArt from './CityBuildingArt';
import type { CSSProperties } from 'react';
import { spheres } from '../game';
import type { GameState, Goal } from '../game';
import { formatDate, goalStatus } from '../planning';
import GameArt from './GameArt';
import Icon from './Icon';
import ProjectArt from './ProjectArt';
import { projectStyle } from './projectStyle';
import './SphereCity.css';

export function SphereBuilding({ id }: { id: string }) {
  return <CityBuildingArt id={id} />;
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
              <>{s.id === 'english' ? <CityBuildingArt id={s.id} variant="icon" /> : <GameArt kind={s.id} />}</>
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
    const next = goal.stages?.find(
      (stage) =>
        !tasks.some((q) => q.stageId === stage.id) ||
        tasks.some((q) => q.stageId === stage.id && !q.done),
    );
    const percent = Math.min(
      100,
      Math.round((goal.current / goal.target) * 100),
    );
    const finished = goal.current >= goal.target;
    const { color } = projectStyle(goal.name, id);
    return (
      <article
        className={`district-project ${finished ? 'project-finished' : ''}`}
        key={goal.id}
        style={{ '--project-color': color } as CSSProperties}
      >
        <div className="project-heading">
          {finished && !goal.image ? (
            <span className="project-done-icon">
              <Icon name="check" size={22} />
            </span>
          ) : (
            <ProjectArt name={goal.name} sphere={id} image={goal.image} />
          )}
          <div>
            <h3>
              <button onClick={() => onOpen(goal)}>{goal.name}</button>
            </h3>
            <p>{goal.description || 'Каждая задача — шаг к твоей цели.'}</p>
          </div>
          <button
            className="project-menu"
            aria-label={`Настроить проект: ${goal.name}`}
            onClick={() => onOpen(goal)}
          >
            ⋮
          </button>
        </div>
        {!finished && (
          <div className="project-tags">
            <span>{goalStatus(goal)}</span>
            <span>
              {goal.progressMode === 'tasks' ? 'Поэтапно' : 'По результату'}
            </span>
            <span>{goal.dueAt ? 'Есть срок' : 'Гибкий срок'}</span>
          </div>
        )}
        <div className="project-numbers">
          <div>
            <small>{finished ? 'Завершён' : 'Прогресс проекта'}</small>
            <div className="project-result">
              <strong>
                {goal.progressMode === 'tasks' && tasks.length
                  ? `${done} / ${tasks.length}`
                  : `${percent}%`}
              </strong>
              <span>
                {goal.progressMode === 'tasks'
                  ? 'задач'
                  : `Цель: ${goal.target}`}
              </span>
            </div>
            <div className="progress">
              <span
                style={{
                  width: `${percent}%`,
                  background: finished ? '#24c69c' : color,
                }}
              />
            </div>
          </div>
          <div>
            <small>{finished ? 'Награда проекта' : 'Следующий этап'}</small>
            <b>
              {next?.name ||
                (finished
                  ? 'Цель достигнута'
                  : tasks.find((q) => !q.done)?.name || 'Добавить первый шаг')}
            </b>
            <span className="xp-tag">
              ⚡ +{goal.reward} XP{goal.rewarded ? ' · получены' : ''}
            </span>
          </div>
        </div>
        <div className="project-footer">
          <div
            className="project-task-dots"
            aria-label={`${done} из ${tasks.length} задач выполнено`}
          >
            {tasks.length ? (
              tasks.slice(0, 8).map((task) => (
                <span
                  key={task.id}
                  className={task.done ? 'is-done' : ''}
                  title={`${task.name}: ${task.done ? 'выполнено' : 'в плане'}`}
                >
                  {task.done && <Icon name="check" size={9} />}
                </span>
              ))
            ) : (
              <small>Пока нет задач</small>
            )}
            {tasks.length > 8 && <small>+{tasks.length - 8}</small>}
          </div>
          <button className="primary-button" onClick={() => onOpen(goal)}>
            {finished ? 'Итоги' : 'Открыть'}
          </button>
        </div>
        {goal.dueAt && (
          <small className="project-deadline">
            До {formatDate(goal.dueAt)}
          </small>
        )}
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
          <div className="district-project-grid">
            {completed.map(card)}
            <button className="project-add-tile" onClick={onNew}>
              <Icon name="plus" />
              <strong>Добавить новый проект</strong>
              <small>Создай свой проект в этой сфере</small>
            </button>
          </div>
        </>
      )}
      <h2 className="project-section-title">Идеи проектов</h2>
      <p className="muted">
        Выбери то, что важно тебе. Добавленный проект можно настроить под себя.
      </p>
      <div className="district-project-grid">
        {templates[id].map(([, name, description]) => (
          <article className="district-project project-template" key={name}>
            <div className="project-heading">
              <ProjectArt name={name} sphere={id} />
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
