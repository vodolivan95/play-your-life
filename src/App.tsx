import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import Icon from './components/Icon';
import {
  achievements,
  changeScore,
  completeQuest,
  dateKey,
  difficulties,
  loadState,
  spheres,
  streak,
  streakRewards,
  updateGoal,
} from './game';
import type { Quest } from './game';

const navigation = [
  { id: 'home', label: 'Главная', icon: 'home' },
  { id: 'spheres', label: 'Сферы жизни', icon: 'spheres' },
  { id: 'quests', label: 'Квесты', icon: 'quests' },
  { id: 'goals', label: 'Цели', icon: 'goals' },
  { id: 'tree', label: 'Skill Tree', icon: 'tree' },
  { id: 'achievements', label: 'Достижения', icon: 'trophy' },
];
function Progress({ value, color }: { value: number; color?: string }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: color,
        }}
      />
    </div>
  );
}
function level(xp: number) {
  return 12 + Math.floor(Math.max(0, xp - 2450) / 550);
}
function sphereLevel(xp: number) {
  return Math.floor(xp / 200) + 1;
}
export default function App() {
  const [state, setState] = useState(loadState);
  const [page, setPage] = useState('home');
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<'quest' | 'goal' | 'streak' | null>(null);
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState('');
  const [storageError, setStorageError] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    try {
      localStorage.setItem('play-your-life-v1', JSON.stringify(state));
    } catch {
      queueMicrotask(() => setStorageError(true));
    }
  }, [state]);
  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  function notify(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  }
  function navigate(id: string) {
    setPage(id);
    setSelected(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function finish(q: Quest) {
    if (q.done) return;
    setState((s) => completeQuest(s, q.id));
    notify(`+${q.xp} XP · Отличная работа!`);
  }
  const unlocked = achievements.filter((a) => a.unlocked(state)).length;
  const active = state.quests.filter((q) => !q.done);
  const lifeScore = (
    spheres.reduce((sum, s) => sum + state.spheres[s.id].score, 0) /
    spheres.length
  ).toFixed(1);
  const mainGoal = state.goals.find((g) => !g.rewarded) || state.goals[0];
  const currentLevel = level(state.xp);
  const nextXP = 3000 + (currentLevel - 12) * 550;
  const sphere = spheres.find((s) => s.id === selected);
  function QuestRow({
    quest,
    removable = false,
  }: {
    quest: Quest;
    removable?: boolean;
  }) {
    const info = spheres.find((s) => s.id === quest.sphere)!;
    return (
      <div className={`quest-row ${quest.done ? 'completed' : ''}`}>
        <span className="quest-icon" style={{ background: `${info.color}15` }}>
          {info.icon}
        </span>
        <div className="quest-info">
          <strong>{quest.name}</strong>
          <small>
            {info.name}
            <span>•</span>
            {quest.difficulty}
          </small>
        </div>
        <span className="xp-tag">+{quest.xp} XP</span>
        <button
          className={`check-button ${quest.done ? 'checked' : ''}`}
          disabled={quest.done}
          onClick={() => finish(quest)}
          aria-label={`Выполнить: ${quest.name}`}
        >
          <Icon name="check" size={18} />
        </button>
        {removable && (
          <button
            className="icon-button delete"
            aria-label={`Удалить: ${quest.name}`}
            onClick={() =>
              setState((s) => ({
                ...s,
                quests: s.quests.filter((q) => q.id !== quest.id),
              }))
            }
          >
            <Icon name="trash" size={17} />
          </button>
        )}
      </div>
    );
  }
  function SphereCard({ id }: { id: string }) {
    const info = spheres.find((s) => s.id === id)!;
    const data = state.spheres[id];
    const diff = data.score - data.previousScore;
    return (
      <button
        className="sphere-card"
        onClick={() => {
          setSelected(id);
          setPage('spheres');
        }}
        style={{ '--sphere-color': info.color } as CSSProperties}
      >
        <div className="sphere-top">
          <span className="sphere-icon">{info.icon}</span>
          <span className="level-chip">LVL {sphereLevel(data.xp)}</span>
        </div>
        <h3>{info.name}</h3>
        <div className="sphere-xp">
          <span>{data.xp % 200} / 200 XP</span>
          <Icon name="arrow" size={15} />
        </div>
        <Progress value={(data.xp % 200) / 2} color={info.color} />
        <div className="sphere-score">
          <span>
            Life Score{' '}
            <b>
              {data.score}
              <small>/9</small>
            </b>
          </span>
          <span className={diff < 0 ? 'negative' : 'positive'}>
            {diff > 0 ? `↗ +${diff}` : diff < 0 ? `↘ ${diff}` : '—'}
          </span>
        </div>
      </button>
    );
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name')).trim();
    if (!name) return;
    const id = crypto.randomUUID();
    const sphereId = String(data.get('sphere'));
    if (modal === 'quest') {
      const difficulty = String(
        data.get('difficulty'),
      ) as keyof typeof difficulties;
      setState((s) => ({
        ...s,
        quests: [
          ...s.quests,
          {
            id,
            name,
            sphere: sphereId,
            xp: difficulties[difficulty],
            difficulty,
            done: false,
          },
        ],
      }));
      notify('Новый квест готов. Вперёд!');
    } else {
      setState((s) => ({
        ...s,
        goals: [
          ...s.goals,
          {
            id,
            name,
            sphere: sphereId,
            current: 0,
            target: Number(data.get('target')),
            created: dateKey(),
            reward: Number(data.get('reward')),
            rewarded: false,
          },
        ],
      }));
      notify('Цель добавлена');
    }
    setModal(null);
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate('home');
          }}
        >
          <span className="brand-symbol">
            P<span>↗</span>
          </span>
          <div>
            PLAY YOUR LIFE<small>Your Life. Your Game.</small>
          </div>
        </a>
        <div className="nav-caption">ТВОЁ ПРИКЛЮЧЕНИЕ</div>
        <nav>
          {navigation.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? 'nav-item active' : 'nav-item'}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.id === 'quests' && (
                <span className="nav-count">{active.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-message">
          <span>✦</span>
          <strong>
            Маленькие шаги.
            <br />
            Большие перемены.
          </strong>
          <p>
            Каждый день — новый шанс
            <br />
            стать лучшей версией себя.
          </p>
        </div>
        <div className="sidebar-profile">
          <span className="avatar small">🧑🏻‍🚀</span>
          <div>
            <strong>Игрок</strong>
            <small>Уровень {currentLevel} · Стратег</small>
          </div>
          <span className="online-dot" />
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="mobile-brand">
            PLAY YOUR LIFE<small>Your Life. Your Game.</small>
          </div>
          <span className="topbar-label">
            {navigation.find((n) => n.id === page)?.label}
          </span>
          <div className="topbar-actions">
            <span className="coin-balance">
              🪙 <b>{state.coins}</b>
            </span>
            <button
              className="icon-button"
              aria-label="Награды за активность"
              onClick={() => setModal('streak')}
            >
              <Icon name="bell" />
            </button>
            <span className="avatar small">🧑🏻‍🚀</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">ТВОЯ ЖИЗНЬ. ТВОИ ПРАВИЛА.</div>
              <h1>
                {sphere
                  ? `${sphere.icon} ${sphere.name}`
                  : page === 'home'
                    ? 'Время стать сильнее'
                    : navigation.find((n) => n.id === page)?.label}
                <span className="heading-dot">.</span>
              </h1>
              <p>
                {page === 'home'
                  ? 'Каждый маленький шаг приближает тебя к большой цели.'
                  : sphere
                    ? 'Развивай свою ветку. Замечай каждый шаг вперёд.'
                    : 'Твой следующий уровень начинается с одного действия.'}
              </p>
            </div>
            <span className="date-label">
              {new Date().toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                weekday: 'short',
              })}
            </span>
          </div>
          {storageError && (
            <div className="storage-warning">
              Браузер не разрешает сохранять данные. Прогресс доступен до
              закрытия страницы.
            </div>
          )}
          {page === 'home' && (
            <>
              <div className="hero-grid">
                <section className="player-card">
                  <div className="player-card-top">
                    <span className="pill">✦ ТВОЙ ПЕРСОНАЖ</span>
                    <span className="hero-spark">✧</span>
                  </div>
                  <div className="player-content">
                    <div>
                      <div className="level-label">LEVEL {currentLevel}</div>
                      <h2>{currentLevel < 15 ? 'Стратег' : 'Мастер'}</h2>
                      <p>Ты создаёшь свою историю.</p>
                    </div>
                    <div className="avatar-orbit">
                      <span className="orbit-star one">✦</span>
                      <span className="player-avatar">🧑🏻‍🚀</span>
                      <span className="avatar-level">{currentLevel}</span>
                      <span className="orbit-star two">✧</span>
                    </div>
                  </div>
                  <div className="hero-progress-label">
                    <span>До следующего уровня</span>
                    <b>
                      {state.xp} <span>/ {nextXP} XP</span>
                    </b>
                  </div>
                  <Progress value={(state.xp / nextXP) * 100} />
                  <div className="hero-footer">
                    <span>⚡ Ещё {nextXP - state.xp} XP до нового уровня</span>
                    <Icon name="arrow" size={16} />
                  </div>
                </section>
                <section className="goal-highlight">
                  <div className="card-kicker">
                    <span>🎯 ГЛАВНАЯ ЦЕЛЬ</span>
                    <span className="mini-pill">В процессе</span>
                  </div>
                  <div className="goal-art">
                    <span>🌍</span>
                    <i>✦</i>
                    <b>
                      <Icon name="arrow" size={20} />
                    </b>
                  </div>
                  <h2>{mainGoal?.name || 'Твоя следующая большая цель'}</h2>
                  <p>Большая мечта. Маленькие шаги каждый день.</p>
                  <div className="goal-progress-label">
                    <span>Твой прогресс</span>
                    <b>
                      {mainGoal
                        ? Math.round((mainGoal.current / mainGoal.target) * 100)
                        : 0}
                      %
                    </b>
                  </div>
                  <Progress
                    value={
                      mainGoal ? (mainGoal.current / mainGoal.target) * 100 : 0
                    }
                  />
                  <button
                    className="text-button"
                    onClick={() => navigate('goals')}
                  >
                    Продолжить путь <Icon name="arrow" size={16} />
                  </button>
                </section>
              </div>
              <div className="stats-grid">
                <button
                  className="stat-card"
                  onClick={() => setModal('streak')}
                >
                  <span className="stat-icon orange">🔥</span>
                  <div>
                    <b>
                      {streak(state.activeDates)} <small>дней</small>
                    </b>
                    <p>Текущая серия</p>
                  </div>
                  <span className="stat-end">
                    <Icon name="arrow" size={16} />
                  </span>
                </button>
                <button
                  className="stat-card"
                  onClick={() => navigate('spheres')}
                >
                  <span className="stat-icon blue">✦</span>
                  <div>
                    <b>
                      {lifeScore} <small>/ 9</small>
                    </b>
                    <p>Общий Life Score</p>
                  </div>
                  <span className="stat-end">
                    <Icon name="arrow" size={16} />
                  </span>
                </button>
                <button
                  className="stat-card"
                  onClick={() => navigate('achievements')}
                >
                  <span className="stat-icon purple">🏆</span>
                  <div>
                    <b>
                      {unlocked} <small>/ {achievements.length}</small>
                    </b>
                    <p>Достижения</p>
                  </div>
                  <span className="stat-end">
                    <Icon name="arrow" size={16} />
                  </span>
                </button>
              </div>
              <div className="home-lower">
                <section className="panel quests-panel">
                  <div className="section-heading">
                    <div>
                      <h2>
                        Квесты на сегодня{' '}
                        <span className="count-chip">{active.length}</span>
                      </h2>
                      <p>Реальные действия. Настоящий прогресс.</p>
                    </div>
                    <button
                      className="icon-button outlined"
                      aria-label="Создать квест"
                      onClick={() => setModal('quest')}
                    >
                      <Icon name="plus" />
                    </button>
                  </div>
                  {state.quests.slice(0, 4).map((q) => (
                    <QuestRow key={q.id} quest={q} />
                  ))}
                  {state.quests.length === 0 && (
                    <p className="empty">
                      Создай первый квест и начни приключение.
                    </p>
                  )}
                  <button
                    className="all-link"
                    onClick={() => navigate('quests')}
                  >
                    Все квесты <Icon name="arrow" size={16} />
                  </button>
                </section>
                <section className="daily-card">
                  <span className="daily-label">МЫСЛЬ ДНЯ</span>
                  <div className="daily-illustration">
                    🌱<span>✧</span>
                  </div>
                  <h2>
                    Не идеально.
                    <br />
                    Но каждый день.
                  </h2>
                  <p>
                    Прогресс — это не большой рывок.
                    <br />
                    Это маленькие действия,
                    <br />
                    которые ты выбираешь сегодня.
                  </p>
                  <div className="daily-bottom">
                    <span /> ТЫ НА ПРАВИЛЬНОМ ПУТИ
                  </div>
                </section>
              </div>
              <section className="spheres-section">
                <div className="section-heading">
                  <div>
                    <h2>Твои сферы жизни</h2>
                    <p>Развивайся в своём ритме. Найди свой баланс.</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => navigate('spheres')}
                  >
                    Все сферы <Icon name="arrow" size={16} />
                  </button>
                </div>
                <div className="sphere-grid">
                  {spheres.slice(0, 4).map((s) => (
                    <SphereCard id={s.id} key={s.id} />
                  ))}
                </div>
              </section>
            </>
          )}
          {page === 'spheres' && !sphere && (
            <>
              <div className="balance-banner">
                <span>✦</span>
                <div>
                  <h2>Твой баланс — {lifeScore} / 9</h2>
                  <p>
                    Не сравнивай себя с другими. Расти относительно себя вчера.
                  </p>
                </div>
              </div>
              <div className="sphere-grid all-spheres">
                {spheres.map((s) => (
                  <SphereCard key={s.id} id={s.id} />
                ))}
              </div>
            </>
          )}
          {sphere && (
            <>
              <button
                className="text-button back-link"
                onClick={() => setSelected(null)}
              >
                ← Все сферы
              </button>
              <div className="detail-grid">
                <section className="panel">
                  <div className="section-heading">
                    <h2>LEVEL {sphereLevel(state.spheres[sphere.id].xp)}</h2>
                    <span className="xp-tag">
                      {state.spheres[sphere.id].xp} XP всего
                    </span>
                  </div>
                  <Progress
                    value={(state.spheres[sphere.id].xp % 200) / 2}
                    color={sphere.color}
                  />
                  <p className="muted">
                    {200 - (state.spheres[sphere.id].xp % 200)} XP до следующего
                    уровня · Коэффициент {sphere.coefficient}
                  </p>
                  <h3>
                    Твой Life Score{' '}
                    <span className="score-big">
                      {state.spheres[sphere.id].score}/9
                    </span>
                  </h3>
                  <div className="score-selector">
                    {Array.from({ length: 10 }, (_, n) => (
                      <button
                        key={n}
                        className={
                          state.spheres[sphere.id].score === n ? 'selected' : ''
                        }
                        onClick={() => {
                          const next = changeScore(state, sphere.id, n);
                          setState(next);
                          notify(
                            next.xp > state.xp
                              ? `+${next.xp - state.xp} XP · Новый личный результат!`
                              : 'Оценка сохранена',
                          );
                        }}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <p className="muted">
                    {
                      [
                        'Сфера практически отсутствует',
                        'Очень низкий уровень',
                        'Очень низкий уровень',
                        'Нестабильно / требует развития',
                        'Нестабильно / требует развития',
                        'Нормальная базовая точка',
                        'Хороший уровень',
                        'Стабильный хороший результат',
                        'Очень высокий уровень',
                        'Достигнут личный целевой стандарт',
                      ][state.spheres[sphere.id].score]
                    }
                  </p>
                  <p className="score-note">
                    XP за рост выше твоего лучшего результата (
                    {state.spheres[sphere.id].highScore}). Повторная оценка не
                    приносит бонус.
                  </p>
                </section>
                <section className="panel">
                  <h2>Активные цели</h2>
                  {state.goals
                    .filter((g) => g.sphere === sphere.id && !g.rewarded)
                    .map((g) => (
                      <div className="detail-goal" key={g.id}>
                        <h3>{g.name}</h3>
                        <Progress value={(g.current / g.target) * 100} />
                        <p>
                          {g.current} / {g.target}
                        </p>
                      </div>
                    ))}
                  {!state.goals.some(
                    (g) => g.sphere === sphere.id && !g.rewarded,
                  ) && <p className="muted">Поставь цель для этой сферы.</p>}
                  <button
                    className="primary-button"
                    onClick={() => setModal('goal')}
                  >
                    <Icon name="plus" size={17} /> Новая цель
                  </button>
                </section>
              </div>
              <section className="panel section-gap">
                <div className="section-heading">
                  <h2>Активные квесты</h2>
                  <button
                    className="text-button"
                    onClick={() => setModal('quest')}
                  >
                    + Добавить
                  </button>
                </div>
                {active
                  .filter((q) => q.sphere === sphere.id)
                  .map((q) => (
                    <QuestRow key={q.id} quest={q} />
                  ))}
                {!active.some((q) => q.sphere === sphere.id) && (
                  <p className="muted">
                    Все квесты выполнены. Можно начать новый!
                  </p>
                )}
              </section>
              <section className="panel section-gap">
                <h2>История прогресса и последние действия</h2>
                {state.events
                  .filter((e) => e.sphere === sphere.id)
                  .map((e) => (
                    <div className="history-row" key={e.id}>
                      <span className="history-dot" />
                      <div>
                        <strong>{e.title}</strong>
                        <small>
                          {new Date(e.date).toLocaleString('ru-RU')}
                        </small>
                      </div>
                      <span className="xp-tag">+{e.xp} XP</span>
                    </div>
                  ))}
                {!state.events.some((e) => e.sphere === sphere.id) && (
                  <p className="muted">
                    Здесь появятся выполненные действия и изменения Life Score.
                  </p>
                )}
              </section>
            </>
          )}
          {page === 'quests' && (
            <>
              <div className="page-toolbar">
                <div className="tabs">
                  {[
                    ['all', 'Все'],
                    ['active', 'Активные'],
                    ['done', 'Выполненные'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      className={filter === id ? 'selected' : ''}
                      onClick={() => setFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  className="primary-button"
                  onClick={() => setModal('quest')}
                >
                  <Icon name="plus" size={18} /> Новый квест
                </button>
              </div>
              <section className="panel">
                {state.quests
                  .filter(
                    (q) =>
                      filter === 'all' ||
                      (filter === 'done' ? q.done : !q.done),
                  )
                  .map((q) => (
                    <QuestRow key={q.id} quest={q} removable />
                  ))}
                {!state.quests.some(
                  (q) =>
                    filter === 'all' || (filter === 'done' ? q.done : !q.done),
                ) && (
                  <div className="empty">
                    <span>✨</span>
                    <h3>Здесь пока нет квестов</h3>
                    <p>Каждое приключение начинается с первого шага.</p>
                  </div>
                )}
              </section>
              <div className="difficulty-legend">
                {Object.entries(difficulties).map(([name, xp]) => (
                  <span key={name}>
                    {name} <b>+{xp} XP</b>
                  </span>
                ))}
              </div>
            </>
          )}
          {page === 'goals' && (
            <>
              <div className="page-toolbar">
                <p className="muted">
                  Мечты становятся реальностью шаг за шагом.
                </p>
                <button
                  className="primary-button"
                  onClick={() => setModal('goal')}
                >
                  <Icon name="plus" size={18} /> Новая цель
                </button>
              </div>
              <div className="goals-grid">
                {state.goals.map((g) => {
                  const info = spheres.find((s) => s.id === g.sphere)!;
                  return (
                    <section key={g.id} className="panel goal-card">
                      <div className="section-heading">
                        <span className="sphere-icon">{info.icon}</span>
                        <span className="mini-pill">
                          {g.current >= g.target ? 'Завершена ✓' : 'В процессе'}
                        </span>
                      </div>
                      <small className="muted">
                        {info.name} ·{' '}
                        {new Date(`${g.created}T12:00:00`).toLocaleDateString(
                          'ru-RU',
                        )}
                      </small>
                      <h2>{g.name}</h2>
                      <div className="goal-progress-label">
                        <span>
                          {g.current} / {g.target}
                        </span>
                        <b>{Math.round((g.current / g.target) * 100)}%</b>
                      </div>
                      <Progress value={(g.current / g.target) * 100} />
                      <label className="goal-input">
                        Текущий прогресс
                        <input
                          type="number"
                          min="0"
                          max={g.target}
                          value={g.current}
                          onChange={(e) => {
                            const next = updateGoal(
                              state,
                              g.id,
                              Number(e.target.value),
                            );
                            setState(next);
                            if (next.xp > state.xp)
                              notify(
                                `Цель достигнута! +${next.xp - state.xp} XP`,
                              );
                          }}
                        />
                      </label>
                      <span className="xp-tag">
                        🏆 Награда: {g.reward} XP {g.rewarded && '· Получена'}
                      </span>
                    </section>
                  );
                })}
              </div>
            </>
          )}
          {page === 'tree' && (
            <>
              <div className="tree-intro">
                <span>🌳</span>
                <h2>Всё начинается с тебя</h2>
                <p>9 веток. Бесконечно много возможностей.</p>
              </div>
              <div className="skill-grid">
                {spheres.map((s) => {
                  const lvl = sphereLevel(state.spheres[s.id].xp);
                  return (
                    <section className="panel skill-branch" key={s.id}>
                      <button
                        className="branch-title"
                        onClick={() => {
                          setSelected(s.id);
                          setPage('spheres');
                        }}
                      >
                        <span>{s.icon}</span>
                        <h3>{s.name}</h3>
                        <span className="level-chip">LVL {lvl}</span>
                      </button>
                      <div className="skill-nodes">
                        {[
                          'Первые шаги',
                          'Привычка',
                          'Уверенность',
                          'Мастерство',
                        ].map((name, i) => (
                          <div
                            className={`skill-node ${lvl >= (i + 1) * 2 - 1 ? 'open' : 'locked'}`}
                            key={name}
                          >
                            <span>{lvl >= (i + 1) * 2 - 1 ? '✓' : '🔒'}</span>
                            <div>
                              <strong>{name}</strong>
                              <small>Уровень {i * 2 + 1}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </>
          )}
          {page === 'achievements' && (
            <>
              <div className="balance-banner">
                <span>🏆</span>
                <div>
                  <h2>
                    {unlocked} из {achievements.length} достижений
                  </h2>
                  <p>Каждая награда — часть твоей истории.</p>
                </div>
              </div>
              <div className="achievement-grid">
                {achievements.map((a) => (
                  <section
                    className={`panel achievement ${a.unlocked(state) ? 'unlocked' : ''}`}
                    key={a.name}
                  >
                    <span className="achievement-icon">{a.icon}</span>
                    <span className="mini-pill">
                      {a.unlocked(state) ? 'Получено ✓' : 'Впереди'}
                    </span>
                    <h2>{a.name}</h2>
                    <p>{a.description}</p>
                  </section>
                ))}
              </div>
            </>
          )}
          <footer className="footer">
            PLAY YOUR LIFE <span>✦</span> Маленькие шаги делают большую жизнь.
          </footer>
        </main>
      </div>
      <nav className="mobile-nav">
        {navigation.map((n) => (
          <button
            key={n.id}
            className={page === n.id ? 'active' : ''}
            onClick={() => navigate(n.id)}
          >
            <Icon name={n.icon} size={20} />
            <span>{n.label === 'Сферы жизни' ? 'Сферы' : n.label}</span>
          </button>
        ))}
      </nav>
      <dialog
        ref={dialog}
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModal(null);
        }}
      >
        <div className="dialog-content">
          <button
            className="icon-button modal-close"
            aria-label="Закрыть"
            onClick={() => setModal(null)}
          >
            <Icon name="close" />
          </button>
          {modal === 'streak' ? (
            <>
              <span className="streak-hero">🔥</span>
              <h2>В твоём ритме</h2>
              <p>
                Текущая серия: <b>{streak(state.activeDates)} дней</b>
              </p>
              <p className="muted">
                Выполняй хотя бы один квест в день. За каждый рубеж серии
                получай бонус XP.
              </p>
              <div className="streak-rewards">
                {Object.entries(streakRewards).map(([days, xp]) => (
                  <div key={days}>
                    <span>{days} дней</span>
                    <b>+{xp} XP</b>
                  </div>
                ))}
              </div>
              <p className="score-note">
                Новый день начинается в полночь по времени устройства.
                Пропущенный день начинает новую серию.
              </p>
            </>
          ) : (
            <form onSubmit={submit}>
              <div className="eyebrow">НОВЫЙ ШАГ ВПЕРЁД</div>
              <h2>
                {modal === 'quest' ? 'Создать квест' : 'Новая большая цель'}
              </h2>
              <label>
                Название
                <input
                  autoFocus
                  name="name"
                  required
                  maxLength={100}
                  placeholder={
                    modal === 'quest'
                      ? 'Что сделаешь сегодня?'
                      : 'О чём ты мечтаешь?'
                  }
                />
              </label>
              <label>
                Сфера жизни
                <select name="sphere" defaultValue={selected || 'english'}>
                  {spheres.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.icon} {s.name}
                    </option>
                  ))}
                </select>
              </label>
              {modal === 'quest' ? (
                <label>
                  Сложность и награда
                  <select name="difficulty" defaultValue="Medium">
                    {Object.entries(difficulties).map(([name, xp]) => (
                      <option key={name} value={name}>
                        {name} — {xp} XP
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <label>
                    Целевое значение
                    <input
                      name="target"
                      type="number"
                      required
                      min="1"
                      max="1000000"
                      defaultValue="100"
                    />
                  </label>
                  <label>
                    Награда за достижение
                    <select name="reward">
                      {[100, 200, 300, 400, 500].map((xp) => (
                        <option value={xp} key={xp}>
                          {xp} XP
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <button className="primary-button submit-button" type="submit">
                {modal === 'quest' ? 'Добавить квест' : 'Создать цель'}{' '}
                <Icon name="arrow" size={18} />
              </button>
            </form>
          )}
        </div>
      </dialog>
      {toast && (
        <div className="toast" role="status">
          <span>✦</span>
          {toast}
        </div>
      )}
    </div>
  );
}
