import { readGoalRoute, goalRoute } from './goalRoutes';
import { sphereProgress, MAX_SPHERE_LEVEL } from './sphereProgress';
import { sphereCount } from './sphereAnalytics';
import SpheresOverview from './components/SpheresOverview';
import HomeDashboard from './components/HomeDashboard';
import DashboardHeader from './components/DashboardHeader';
import MobileCityFooter from './components/MobileCityFooter';
import SidebarReference from './components/SidebarReference';
import { CityAppearanceContext } from './cityAppearanceContext';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, Dispatch, SetStateAction, ReactNode } from 'react';
import Icon from './components/Icon';
import LifeCity from './components/LifeCity';
import GameArt from './components/GameArt';
import Avatar from './components/Avatar';
import ProjectArt from './components/ProjectArt';
import DataBackup from './components/DataBackup';
import { stateStorageKey, recoveryStorageKey } from './backup';
import {
  SphereBuilding,
  SphereDistricts,
  SphereProjects,
} from './components/SphereCity';
import Statistics from './components/Statistics';
import RewardShop from './components/RewardShop';
import Onboarding, { ProfileEditor } from './components/Onboarding';
import MonthlyReview from './components/MonthlyReview';
import GoalsBoard from './components/GoalsBoard';
import SkillTree from './components/SkillTree';
import LifePlanner from './components/LifePlanner';
import { GoalForm } from './components/PlanningForms';
import { saveGoal } from './planning';
import useTickTick from './useTickTick';
import TickTickConnection from './components/TickTickConnection';
import { TickTickContext } from './tickTickContext';
import {
  achievements,
  completeQuest,
  dateKey,
  loadState,
  getStorageProblem,
  clearStorageProblem,
  playerProgress,
  spheres,
  streak,
  streakRewards,
  removeQuest,
} from './game';
import type { Quest, GameState } from './game';
import QuestBoard from './components/QuestBoard';
import QuestWizard from './components/QuestWizard';
import { saveCustomQuest, saveHabit } from './personalQuests';

const navigation = [
  { id: 'home', label: 'Главная', icon: 'home' },
  { id: 'spheres', label: 'Сферы жизни', icon: 'spheres' },
  { id: 'quests', label: 'Квесты', icon: 'quests' },
  { id: 'goals', label: 'Цели', icon: 'goals' },
  { id: 'plan', label: 'План жизни', icon: 'plan' },
  { id: 'monthly', label: 'Итоги месяца', icon: 'calendar' },
  { id: 'tree', label: 'Skill Tree', icon: 'tree' },
  { id: 'achievements', label: 'Достижения', icon: 'trophy' },
  { id: 'shop', label: 'Магазин', icon: 'shop' },
  { id: 'city', label: 'Город', icon: 'city' },
  { id: 'statistics', label: 'Статистика', icon: 'statistics' },
  { id: 'profile', label: 'Профиль', icon: 'profile' },
];
const mobileIds = [
  'home',
  'goals',
  'quests',
  'shop',
  'city',
  'statistics',
  'profile',
];
function Progress({
  value,
  color,
  label = 'Прогресс',
}: {
  value: number;
  color?: string;
  label?: string;
}) {
  const progress = Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : 0;
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        style={{
          width: `${progress}%`,
          background: color,
        }}
      />
    </div>
  );
}
export default function App({ state: suppliedState, onChange, userId, accountTools, tickTickToken }: {
  state?: GameState; onChange?: Dispatch<SetStateAction<GameState>>; userId?: string; accountTools?: ReactNode; tickTickToken?: () => Promise<string>;
} = {}) {
  const [localState, setLocalState] = useState(() => suppliedState ?? loadState());
  const state = suppliedState ?? localState;
  const setState = onChange ?? setLocalState;
  const tickTick = useTickTick(state, setState, userId, tickTickToken);
  const [page, setPage] = useState(() =>
    readGoalRoute() || location.hash === '#goals' ? 'goals' : location.hash === '#city'
      ? 'city'
      : location.hash.startsWith('#ticktick=') || location.hash === '#profile'
        ? 'profile'
        : 'home',
  );
  const [goalOrigin, setGoalOrigin] = useState<string | null>(null);
  const [today, setToday] = useState(dateKey);
  const [focusedGoalId, setFocusedGoalId] = useState<string | null>(() => readGoalRoute()?.goalId ?? null);
  const [goalLocation, setGoalLocation] = useState(readGoalRoute);
  const [selected, setSelected] = useState<string | null>(null);
  const [modal, setModal] = useState<
    'quest' | 'goal' | 'streak' | 'start' | 'profile' | null
  >(() => (state.profile.onboardingComplete ? null : 'start'));
  useEffect(() => {
    if (userId && state.profile.onboardingComplete)
      queueMicrotask(() => setModal(current => current === 'start' ? null : current));
  }, [userId, state.profile.onboardingComplete]);
  useEffect(() => {
    const changed = () => {
      const route = readGoalRoute(); setGoalLocation(route);
      if (route || location.hash === '#goals') { setPage('goals'); setFocusedGoalId(route?.goalId ?? null); }
      else { setFocusedGoalId(null); setPage(location.hash === '#city' ? 'city' : location.hash.startsWith('#ticktick=') || location.hash === '#profile' ? 'profile' : 'home'); }
    };
    window.addEventListener('hashchange', changed); window.addEventListener('popstate', changed);
    return () => { window.removeEventListener('hashchange', changed); window.removeEventListener('popstate', changed); };
  }, []);
  const [achievementFilter, setAchievementFilter] = useState('all');
  const [sphereTab, setSphereTab] = useState('projects');
  const [questSphere, setQuestSphere] = useState('english');
  const [questTemplate, setQuestTemplate] = useState<Partial<Quest> | null>(null);
  const [toast, setToast] = useState('');
  const [storageError, setStorageError] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (userId || getStorageProblem()) return;
    try {
      localStorage.setItem(stateStorageKey, JSON.stringify(state));
      queueMicrotask(() => setStorageError(false));
    } catch {
      queueMicrotask(() => setStorageError(true));
    }
  }, [state, userId]);
  useEffect(() => {
    const timer = setInterval(() => setToday(dateKey()), 30000);
    const visible = () => setToday(dateKey());
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  useEffect(() => {
    if (modal && modal !== 'quest') dialog.current?.showModal();
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
  function openGoal(id: string | null) {
    setFocusedGoalId(id); setGoalLocation(id ? { goalId: id } : null);
    window.location.hash = id ? goalRoute(id) : 'goals';
  }
  function navigate(id: string) {
    if (id === 'profile') window.history.pushState(null, '', location.pathname + location.search + '#profile');
    else if (readGoalRoute() || location.hash === '#goals' || location.hash === '#profile' || location.hash.startsWith('#ticktick=')) window.history.pushState(null, '', location.pathname + location.search + (id === 'city' ? '#city' : ''));
    setGoalLocation(null);
    setPage(id);
    setSelected(null);
    setSphereTab('projects');
    setFocusedGoalId(null);
    setGoalOrigin(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function finish(q: Quest) {
    if (q.done) return;
    const next = completeQuest(state, q.id);
    setState(next);
    notify(`+${next.xp - state.xp} XP · Отличная работа!`);
  }
  const unlocked = achievements.filter((a) => a.unlocked(state)).length;
  const active = state.quests.filter((q) => !q.done);
  const {
    level: currentLevel,
    progress: levelProgress,
    maxed: playerMaxed,
    title: levelTitle,
  } = playerProgress(state);
  function newQuest() {
    setQuestTemplate(null);
    setQuestSphere(selected || 'english');
    setModal('quest');
  }
  function closeModal() {
    if (!state.profile.onboardingComplete && modal === 'start') return;
    setModal(null);
  }
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
          <GameArt kind={info.id} />
        </span>
        <div className="quest-info">
          <strong>{quest.name}</strong>
          <small>{info.name}</small>
          {(quest.dueAt || quest.startsAt) && (
            <small
              className={`quest-deadline ${!quest.done && quest.dueAt && new Date(quest.dueAt) < new Date() ? 'is-overdue' : ''}`}
            >
              {!quest.done && quest.dueAt && new Date(quest.dueAt) < new Date()
                ? 'Срок прошёл · '
                : ''}
              {new Date(quest.dueAt ?? quest.startsAt!).toLocaleString(
                'ru-RU',
                {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                },
              )}
            </small>
          )}
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
            onClick={() => setState((s) => removeQuest(s, quest.id))}
          >
            <Icon name="trash" size={17} />
          </button>
        )}
      </div>
    );
  }
  function SphereCard({ id }: { id: string; overview?: boolean }) {
    const info = spheres.find(s => s.id === id)!;
    const p = sphereProgress(state.spheres[id].xp);
    return <button className="sphere-card" onClick={() => { setSelected(id); setSphereTab('projects'); setPage('spheres'); }} style={{ '--sphere-color': info.color } as CSSProperties}>
      <SphereBuilding id={id}/><div className="sphere-top"><span className="sphere-icon"><GameArt kind={id}/></span><span className="level-chip">LVL {p.level} / {MAX_SPHERE_LEVEL}</span></div><h3>{info.name}</h3>
      <div className="overview-life-score"><b>LVL {p.level} / {MAX_SPHERE_LEVEL}</b></div>
      <div className="sphere-xp"><span>{p.maxed ? 'Максимальный уровень' : p.currentXP + ' / ' + p.requiredXP + ' XP'}</span><Icon name="arrow" size={15}/></div>
      <Progress value={p.progress} color={info.color} label={ 'XP: ' + info.name }/>
      <div className="overview-project-counts">{sphereCount(state.goals.filter(g => g.sphere === id).length,'projects')} <span>|</span> {sphereCount(state.quests.filter(q => q.sphere === id).length,'tasks')}</div>
    </button>;
  }
  return (
    <TickTickContext.Provider value={tickTick}>
      <CityAppearanceContext.Provider value={state.city}>
      <div
        className={`app-shell app-page-${page} ${modal === 'quest' ? 'quest-dialog-open' : ''}`}
      >
        <aside className="sidebar">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate('home');
            }}
          >
            <SidebarReference part="logo" />
          </a>
          <nav>
            {navigation.map((item) => (
              <button
                key={item.id}
                className={page === item.id ? 'nav-item active' : 'nav-item'}
                aria-current={page === item.id ? 'page' : undefined}
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
          <div className="sidebar-city"><SidebarReference part="city" /></div>
        </aside>
        <div className="main-wrap">
          <header className="topbar"><DashboardHeader state={state} onProfile={() => navigate('profile')} onQuests={() => navigate('quests')} /></header>
          <main
            className={`screen-${page} ${sphere ? 'screen-sphere-detail' : ''}`}
          >
            {accountTools}<div className="page-heading">
              <div>
                <div className="eyebrow">ТВОЯ ЖИЗНЬ. ТВОИ ПРАВИЛА.</div>
                <h1>
                  {sphere ? (
                    <>
                      <GameArt kind={sphere.id} />
                      <span>{sphere.name}</span>
                    </>
                  ) : page === 'home' ? (
                    `Привет, ${state.profile.name}`
                  ) : (
                    navigation.find((n) => n.id === page)?.label
                  )}
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
            {!userId && getStorageProblem() && (
              <div className="storage-warning" role="alert">
                {getStorageProblem()}{' '}
                <button
                  className="text-button"
                  onClick={() => navigate('profile')}
                >
                  Открыть восстановление
                </button>
              </div>
            )}
            {storageError && (
              <div className="storage-warning">
                Браузер не разрешает сохранять данные. Прогресс доступен до
                закрытия страницы.
              </div>
            )}
            {page === 'monthly' && (
              <MonthlyReview
                state={state}
                onChange={setState}
                storageError={storageError}
                onSaved={() =>
                  notify(
                    storageError
                      ? 'Итоги сохранены на этой странице'
                      : 'Итоги месяца сохранены',
                  )
                }
              />
            )}
            {page === 'home' && <HomeDashboard state={state} onChange={setState} onSphere={(id) => { setSelected(id); setSphereTab('projects'); setPage('spheres'); }} onQuests={() => navigate('quests')} onGoal={() => navigate('goals')} onShop={() => navigate('shop')} onProfile={() => navigate('profile')} onIntegration={() => navigate('profile')} onCreate={newQuest} onStart={() => setModal('start')} renderQuest={q => <QuestRow key={q.id} quest={q} />} />}
            {page === 'spheres' && !sphere && <SpheresOverview state={state} onSelect={(id) => { setSelected(id); setSphereTab('projects'); }} renderCard={(id) => <SphereCard key={id} id={id} overview />} onAddRecommendation={(idea) => { setState(current => current.goals.some(g => g.sphere === idea.sphereId && g.name === idea.title && g.current < g.target) ? current : saveGoal(current, { name: idea.title, description: idea.description, sphere: idea.sphereId, target: 100, reward: 100, progressMode: 'tasks' })); notify('Проект добавлен в план. Открой его и добавь этапы и задачи.'); }} />}
            {page === 'spheres' && sphere && <SphereDistricts state={state} selected={selected} onSelect={(id) => { setSelected(id); setSphereTab('projects'); }} />}
            {sphere && (
              <>
                <button
                  className="text-button back-link"
                  onClick={() => setSelected(null)}
                >
                  ← Все сферы
                </button>
                <div className={`detail-grid sphere-tab-${sphereTab}`}>
                  <div className="district-hero-art">
                    <SphereBuilding id={sphere.id} />
                    <span>{sphere.name} · Твой район развития</span>
                  </div>
                  <section className="panel">
                    <div className="section-heading"><h2>LVL {sphereProgress(state.spheres[sphere.id].xp).level} / {MAX_SPHERE_LEVEL}</h2><span className="xp-tag">{state.spheres[sphere.id].xp} XP всего</span></div>
                    <Progress label={ 'XP: ' + sphere.name } value={sphereProgress(state.spheres[sphere.id].xp).progress} color={sphere.color}/>
                    <p className="muted">{sphereProgress(state.spheres[sphere.id].xp).maxed ? 'Максимальный уровень сферы' : sphereProgress(state.spheres[sphere.id].xp).currentXP + ' / ' + sphereProgress(state.spheres[sphere.id].xp).requiredXP + ' XP · ' + sphereProgress(state.spheres[sphere.id].xp).remainingXP + ' XP до следующего уровня'}</p>
                    <p className="score-note">Уровень растёт за реальные действия: выполняй квесты и задачи проектов этой сферы. У каждой сферы свой XP и своя история развития.</p>

                  </section>
                </div>
                <div className="tabs sphere-tabs">
                  {[
                    ['projects', 'Проекты'],
                    ['quests', 'Задачи'],
                    ['goals', 'Цели'],
                    ['history', 'История'],
                    ['statistics', 'Статистика'],
                  ].map(([id, name]) => (
                    <button
                      key={id}
                      className={sphereTab === id ? 'selected' : ''}
                      onClick={() => setSphereTab(id)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                {sphereTab === 'projects' && (
                  <SphereProjects
                    onMap={() => navigate('city')}
                    state={state}
                    id={sphere.id}
                    onNew={() => setModal('goal')}
                    onOpen={(goal) => {
                      navigate('goals');
                      openGoal(goal.id);
                      setGoalOrigin(sphere.id);
                    }}
                    onTemplate={(name, description) => {
                      setState((current) =>
                        saveGoal(current, {
                          name,
                          description,
                          sphere: sphere.id,
                          target: 100,
                          reward: 100,
                          progressMode: 'tasks',
                        }),
                      );
                      notify(
                        'Проект добавлен. Открой его, чтобы настроить этапы и задачи.',
                      );
                    }}
                  />
                )}
                <section
                  className="panel sphere-goals"
                  hidden={!['goals', 'quests'].includes(sphereTab)}
                >
                  <h2>Активные цели</h2>
                  {state.goals
                    .filter((g) => g.sphere === sphere.id && !g.rewarded)
                    .map((g) => (
                      <button
                        className="detail-goal"
                        key={g.id}
                        onClick={() => {
                          navigate('goals');
                          openGoal(g.id);
                        }}
                      >
                        <span className="detail-goal-icon">
                          {g.image ? (
                            <ProjectArt
                              name={g.name}
                              sphere={g.sphere}
                              image={g.image}
                            />
                          ) : (
                            <GameArt kind="target" />
                          )}
                        </span>
                        <h3>{g.name}</h3>
                        <Progress
                          value={(g.current / g.target) * 100}
                          label={`Цель: ${g.name}`}
                        />
                        <p>{Math.round((g.current / g.target) * 100)}%</p>
                      </button>
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
                <section
                  className="panel section-gap"
                  hidden={sphereTab !== 'quests'}
                >
                  <div className="section-heading">
                    <h2>Активные квесты</h2>
                    <button className="text-button" onClick={newQuest}>
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
                <section
                  className="panel section-gap"
                  hidden={sphereTab !== 'history'}
                >
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
                      Здесь появятся выполненные действия и изменения Life
                      Score.
                    </p>
                  )}
                </section>
              </>
            )}
            {sphere && sphereTab === 'statistics' && (
              <Statistics
                state={{
                  ...state,
                  events: state.events.filter((e) => e.sphere === sphere.id),
                }}
              />
            )}
            {page === 'city' && (
              <LifeCity
                onChange={setState}
                notify={notify}
                state={state}
                onOpen={(id) => {
                  setSelected(id);
                  setPage('spheres');
                  setSphereTab('projects');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            )}
            {page === 'shop' && (
              <RewardShop state={state} onChange={setState} notify={notify} />
            )}
            {page === 'statistics' && (
              <Statistics state={state} onMonthly={() => navigate('monthly')} />
            )}
            {page === 'profile' && (
              <div className="profile-page">
                <section className="panel profile-hero">
                  <span className="player-avatar">
                    <Avatar
                      value={state.profile.avatar}
                      photo={state.profile.photo}
                      frame={state.shop?.equippedFrame}
                    />
                  </span>
                  <div>
                    <h2>{state.profile.name}</h2>
                    <strong>{levelTitle}</strong>
                    <small>
                      LEVEL {currentLevel} · {state.xp} XP
                    </small>
                    <Progress
                      value={levelProgress}
                      label={playerMaxed ? 'Максимальный уровень 100' : 'XP до следующего уровня'}
                    />
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Изменить профиль"
                    onClick={() => setModal('profile')}
                  >
                    <Icon name="settings" />
                  </button>
                </section>
                <div className="player-rewards profile-rewards">
                  <span>
                    <b>
                      <GameArt kind="coin" /> {state.coins}
                    </b>
                    <small>Монеты</small>
                  </span>
                  <button onClick={() => setModal('streak')}>
                    <b>
                      <GameArt kind="fire" /> {streak(state.activeDates)}
                    </b>
                    <small>Серия</small>
                  </button>
                  <button onClick={() => navigate('achievements')}>
                    <b>
                      <GameArt kind="trophy" /> {unlocked}
                    </b>
                    <small>Достижения</small>
                  </button>
                </div>
                <section className="panel profile-menu">
                  {navigation
                    .filter((n) => !['home', 'profile'].includes(n.id))
                    .map((n) => (
                      <button key={n.id} onClick={() => navigate(n.id)}>
                        <Icon name={n.icon} />
                        <strong>{n.label}</strong>
                        <Icon name="arrow" size={17} />
                      </button>
                    ))}
                  <button onClick={() => setModal('profile')}>
                    <Icon name="settings" />
                    <strong>Настройки персонажа</strong>
                    <Icon name="arrow" size={17} />
                  </button>
                </section>
                <section className="panel profile-ticktick"><TickTickConnection demo={state.profile.mode === 'demo'} /></section>
                <DataBackup
                  state={state}
                  connected={tickTick.restoreBlocked}
                  userId={userId}
                  onNotify={notify}
                  onRestore={(next) => {
                    if (tickTick.restoreBlocked)
                      throw new Error('Сначала отключи TickTick');
                    if (userId && next.profile.mode !== 'personal') throw new Error('В аккаунт можно восстановить только личную игру.');
                    const storageKey = userId ? `play-your-life-account:${userId}:manual-backup` : stateStorageKey;
                    const restoreKey = userId ? `play-your-life-account:${userId}:recovery` : recoveryStorageKey;
                    const current = userId ? JSON.stringify(state) : localStorage.getItem(storageKey);
                    if (current)
                      localStorage.setItem(restoreKey, current);
                    if (!userId) localStorage.setItem(storageKey, JSON.stringify(next));
                    clearStorageProblem();
                    setState(next);
                    setStorageError(false);
                    navigate('home');
                  }}
                />
                <button
                  className="secondary-button"
                  onClick={() => navigate('plan')}
                >
                  Планирование и TickTick <Icon name="arrow" size={16} />
                </button>
              </div>
            )}
            {page === 'quests' && <QuestBoard state={state} onChange={setState} ownerId={userId ?? 'local'} today={today} notify={notify} onCreate={q => { setQuestTemplate(q ?? null); setQuestSphere(q?.sphere ?? 'health'); setModal('quest'); }} />}
            {page === 'goals' && (
              <GoalsBoard
                ownerId={userId ?? 'local'}
                state={state}
                onChange={setState}
                selectedId={focusedGoalId}
                stageId={goalLocation?.goalId === focusedGoalId ? goalLocation.stageId : undefined}
                onSphere={(id) => { navigate('spheres'); setSelected(id); setSphereTab('projects'); }}
                backLabel={
                  goalOrigin
                    ? `← Проекты: ${spheres.find((s) => s.id === goalOrigin)?.name}`
                    : undefined
                }
                onSelect={(id) => {
                  if (id === null && goalOrigin) {
                    const origin = goalOrigin;
                    navigate('spheres');
                    setSelected(origin);
                  } else openGoal(id);
                }}
                onNew={() => setModal('goal')}
                onNotify={notify}
              />
            )}
            {page === 'plan' && (
              <LifePlanner
                state={state}
                onChange={setState}
                onGoal={(id) => {
                  navigate('goals');
                  openGoal(id);
                }}
                onNewGoal={() => setModal('goal')}
                onNotify={notify}
              />
            )}
            {page === 'tree' && (
              <SkillTree
                state={state}
                onChange={setState}
                notify={notify}
                onOpenSphere={(id) => {
                  setSelected(id);
                  setPage('spheres');
                }}
              />
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
                <div className="tabs achievement-tabs">
                  {[
                    ['all', 'Все'],
                    ['open', 'Открытые'],
                    ['locked', 'В процессе'],
                  ].map(([id, name]) => (
                    <button
                      key={id}
                      className={achievementFilter === id ? 'selected' : ''}
                      onClick={() => setAchievementFilter(id)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                <div className="achievement-grid">
                  {achievements
                    .filter(
                      (a) =>
                        achievementFilter === 'all' ||
                        (achievementFilter === 'open'
                          ? a.unlocked(state)
                          : !a.unlocked(state)),
                    )
                    .map((a) => (
                      <section
                        className={`panel achievement ${a.unlocked(state) ? 'unlocked' : ''}`}
                        key={a.name}
                      >
                        <span className="achievement-icon">
                          <GameArt kind="trophy" />
                        </span>
                        <span className="mini-pill">
                          {a.unlocked(state) ? 'Получено ✓' : 'Впереди'}
                        </span>
                        <h2>{a.name}</h2>
                        <p>{a.description}</p>
                        <div className="achievement-progress">
                          <Progress
                            label={`Достижение: ${a.name}`}
                            value={
                              a.unlocked(state)
                                ? 100
                                : Math.round(a.progress(state) * 100)
                            }
                          />
                          <small>
                            {a.unlocked(state)
                              ? '✓'
                              : `${Math.round(a.progress(state) * 100)}%`}
                          </small>
                        </div>
                      </section>
                    ))}
                </div>
              </>
            )}
            <MobileCityFooter />
          <footer className="footer">
              PLAY YOUR LIFE <span>✦</span> Маленькие шаги делают большую жизнь.
            </footer>
          </main>
        </div>
        <nav className="mobile-nav">
          {mobileIds
            .map((id) => navigation.find((n) => n.id === id)!)
            .map((n) => (
              <button
                key={n.id}
                className={
                  page === n.id ||
                  (page === 'spheres' && n.id === 'home') ||
                  (['plan', 'monthly', 'tree', 'achievements'].includes(page) &&
                    n.id === 'profile')
                    ? 'active'
                    : ''
                }
                aria-current={
                  page === n.id ||
                  (page === 'spheres' && n.id === 'home') ||
                  (['plan', 'monthly', 'tree', 'achievements'].includes(page) &&
                    n.id === 'profile')
                    ? 'page'
                    : undefined
                }
                onClick={() => navigate(n.id)}
              >
                <Icon name={n.icon} size={20} />
                <span>
                  {n.id === 'plan'
                    ? 'План'
                    : n.id === 'monthly'
                      ? 'Итоги'
                      : n.label}
                </span>
              </button>
            ))}
        </nav>
        <dialog
          aria-label={
            modal === 'quest'
              ? 'Создание квеста'
              : modal === 'goal'
                ? 'Создание цели'
                : modal === 'profile'
                  ? 'Настройки персонажа'
                  : modal === 'streak'
                    ? 'Награды за активность'
                    : 'Начало личной игры'
          }
          className={modal === 'quest' ? 'quest-creation-dialog' : undefined}
          ref={dialog}
          onCancel={(event) => {
            event.preventDefault();
            closeModal();
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="dialog-content">
            {(state.profile.onboardingComplete || modal !== 'start') && (
              <button
                className="icon-button modal-close"
                aria-label="Закрыть"
                onClick={closeModal}
              >
                <Icon name={modal === 'quest' ? 'back' : 'close'} />
              </button>
            )}
            {modal === 'start' ? (
              <Onboarding
                key="start"
                profile={state.profile}
                accountMode={!!userId}
                onComplete={(next) => {
                  setState(current => userId && current.profile.onboardingComplete ? current : next);
                  setModal(null);
                  navigate('home');
                  notify('Твоя игра началась. Первый шаг — за тобой!');
                }}
                onDemo={() => {
                  setState((s) => ({
                    ...s,
                    profile: { ...s.profile, onboardingComplete: true },
                  }));
                  setModal(null);
                }}
              />
            ) : modal === 'profile' ? (
              <ProfileEditor
                key="profile"
                profile={state.profile}
                onSave={(profile) => {
                  setState((s) => ({ ...s, profile }));
                  setModal(null);
                  notify('Профиль сохранён');
                }}
                onStart={() => setModal('start')}
              />
            ) : modal === 'goal' ? (
              <GoalForm
                sphereId={selected || 'english'}
                onSave={(input) => {
                  setState(saveGoal(state, input));
                  setModal(null);
                  notify('Цель добавлена в твой план');
                }}
              />
            ) : modal === 'streak' ? (
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
            ) : null}
          </div>
        </dialog>
        {modal === 'quest' && <QuestWizard initial={{ sphere: questSphere, ...questTemplate }} onClose={closeModal} onQuest={q => { const next = saveCustomQuest(state, q, userId ?? 'local'); setState(next); notify('Новый квест готов. Вперёд!'); }} onHabit={h => setState(saveHabit(state, h, userId ?? 'local'))} />}
        {toast && (
          <div className="toast" role="status">
            <span>✦</span>
            {toast}
          </div>
        )}
      </div>
    </CityAppearanceContext.Provider>
    </TickTickContext.Provider>
  );
}

