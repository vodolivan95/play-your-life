import { changeJournal, journalDate } from './changeJournal';
import TaskReminders from './components/TaskReminders';
import { NotifyPrompt, PsychologyReminder } from './components/SystemReminders';
import { readOpenRoute } from './systemNotify';
import { backfillTaskCoins } from './coinBackfill';
import { isTaskReviewMode } from './taskReviewMode';
import { dependencyBlockMessage } from './taskDependencies';
import { readGoalRoute, goalRoute } from './goalRoutes';
import { readTaskRoute } from './taskRoutes';
import HomeDashboard from './components/HomeDashboard';
import DashboardHeader from './components/DashboardHeader';
import footerEmblem from './assets/brand/emblem-128.png';
import AppSidebar from './components/AppSidebar';
import ThemeSwitch from './components/ThemeSwitch';
import MobileNav from './components/MobileNav';
import { navigation } from './navigation';
import { isOwnerEmail } from './privateAccess';
import { quickPlanningTask } from './planner';
import { isOurPage, isPairAccount, lastPageOf, ourRoute, readOurRoute, rememberPage, storedMode } from './ourLife';
import type { LifeMode } from './ourLife';
import { CityAppearanceContext } from './cityAppearanceContext';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction, ReactNode } from 'react';
import Icon from './components/Icon';
import './components/Overlay.css';
const LifeCity = lazy(() => import('./components/LifeCity'));
const OurBackground = lazy(() => import('./components/OurBackground'));
const FocusBar = lazy(() => import('./components/FocusBar'));
// Страницы разделов грузятся по требованию: при первом открытии сайта виден
// только «Главная», остальные разделы не нужны и не должны лежать в главном
// скрипте. «Главная» (HomeDashboard) намеренно остаётся обычным импортом.
const SpheresOverview = lazy(() => import('./components/SpheresOverview'));
const Statistics = lazy(() => import('./components/Statistics'));
const RewardShop = lazy(() => import('./components/RewardShop'));
const KeyResults = lazy(() => import('./components/KeyResults'));
const FinancePage = lazy(() => import('./components/FinancePage'));
const GoalsBoard = lazy(() => import('./components/GoalsBoard'));
const SkillTree = lazy(() => import('./components/SkillTree'));
import UpdateNotice from './components/UpdateNotice';
import ChangeJournal from './components/ChangeJournal';
const PsychologyPage = lazy(() => import('./components/PsychologyPage'));
const KnowledgeBase = lazy(() => import('./components/KnowledgeBase'));
const SphereNotes = lazy(() => import('./components/SphereNotes'));
const AllNotes = lazy(() => import('./components/AllNotes'));
const LifePlanner = lazy(() => import('./components/LifePlanner'));
const QuestBoard = lazy(() => import('./components/QuestBoard'));
const HabitsPage = lazy(() => import('./components/HabitsPage'));
const OurLife = lazy(() => import('./components/OurLife'));
import GameArt from './components/GameArt';
import Avatar from './components/Avatar';
import DataBackup from './components/DataBackup';
import { stateStorageKey, recoveryStorageKey, adoptBackupOwner } from './backup';
import { SphereProjects } from './components/SphereCity';
import { SphereOverview, SphereQuickView, SphereScene, SphereSkills } from './components/SphereHub';
import type { SphereTab } from './components/SphereHub';
import Onboarding, { ProfileEditor } from './components/Onboarding';
import { GoalForm } from './components/PlanningForms';
import { saveGoal } from './planning';
import useTickTick from './useTickTick';
import TickTickConnection from './components/TickTickConnection';
import TickTickInboxDialog from './components/TickTickInboxDialog';
import { TickTickContext, TickTickHabitsContext } from './tickTickContext';
import useTickTickHabits from './useTickTickHabits';
import { openTaskCount } from './tasksCalendar';
import {
  achievements,
  completeQuest,
  reopenQuest,
  dateKey,
  loadState,
  getStorageProblem,
  clearStorageProblem,
  playerProgress,
  spheres,
  streak,
  streakRewards,
  removeQuest,
  isOverdue,
  hasClockTime,
} from './game';
import type { Quest, GameState } from './game';
import type { SearchResult } from './globalSearch';
import TaskWindow from './components/TaskWindow';
import ErrorBoundary from './components/ErrorBoundary';
import QuestWizard from './components/QuestWizard';
import { saveCustomQuest, duplicateQuest, saveHabit } from './personalQuests';
import TaskLabelBadge from './components/TaskLabelBadge';
import { decryptOwnerPlan, hasDuplicatedStageNames, hasImportedPlan, importPlan, parsePlanFile, tidyPlanStageNames } from './planImport';

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
export default function App({ state: suppliedState, onChange, userId, userEmail, accountTools, tickTickToken }: {
  state?: GameState; onChange?: Dispatch<SetStateAction<GameState>>; userId?: string; userEmail?: string | null; accountTools?: ReactNode; tickTickToken?: () => Promise<string>;
} = {}) {
  const [localState, setLocalState] = useState(() => suppliedState ?? loadState());
  const state = suppliedState ?? localState;
  const setState = onChange ?? setLocalState;
  const tickTick = useTickTick(state, setState, userId, tickTickToken);
  // Разделы владельца (сейчас «Психология») видны только в его аккаунте.
  const [owner, setOwner] = useState(false);
  useEffect(() => {
    let alive = true;
    void isOwnerEmail(userEmail).then((ok) => { if (alive) setOwner(ok); });
    return () => { alive = false; };
  }, [userEmail]);
  // 0.89.11: личный план владельца загружается в его аккаунт автоматически один раз (зашифрован, см. ownerPlan.ts).
  const planAttempted = useRef(false);
  useEffect(() => {
    if (owner && hasDuplicatedStageNames(state)) setState((current) => tidyPlanStageNames(current));
  }, [owner, state, setState]);
  useEffect(() => {
    if (!owner || !userEmail || !userId || planAttempted.current || hasImportedPlan(state)) return;
    planAttempted.current = true;
    void decryptOwnerPlan(userEmail, Object.keys(state.spheres)).then((plan) => {
      if (!plan) return;
      let summary: { projects: number; tasks: number; completed: number } | null = null;
      setState((current) => {
        if (hasImportedPlan(current)) return current;
        const result = importPlan(current, plan, userId);
        summary = result;
        return result.state;
      });
      setTimeout(() => { if (summary) notify(`Личный план загружен: проектов ${summary.projects}, задач ${summary.tasks}, закрыто выполненных ${summary.completed}.`); }, 0);
    });
  }, [owner, userEmail, userId, state, setState]);
  // 0.90.7: лайфкоины за ранее закрытые задачи без награды — один раз; открытым задачам — награда по умолчанию.
  useEffect(() => {
    if (!userId || !state.profile.onboardingComplete) return;
    let result: ReturnType<typeof backfillTaskCoins>;
    try { result = backfillTaskCoins(state, userId); } catch { return; }
    if (result.state === state) return;
    setState(result.state);
    if (result.coins) setTimeout(() => notify(`🪙 Начислено ${result.coins} лайфкоинов за ${result.tasks} закрытых задач`), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- проверяем при изменении задач
  }, [userId, state.quests, state.profile.onboardingComplete]);
  const [page, setPage] = useState(() =>
    readOpenRoute(location.hash) ?? readOurRoute(location.hash)?.page ?? (readTaskRoute() ? 'tasks' : !location.hash && storedMode() === 'our' ? lastPageOf('our') : readGoalRoute() || location.hash === '#goals' ? 'goals' : location.hash === '#city'
      ? 'city'
      : location.hash.startsWith('#ticktick=') || location.hash === '#profile'
        ? 'profile'
        : 'home'),
  );
  /** Код приглашения из ссылки `#our/join/КОД` (ТЗ 4.3). */
  const [joinCode, setJoinCode] = useState(() => readOurRoute(location.hash)?.joinCode ?? null);
  useEffect(() => { rememberPage(page); }, [page]);
  const [goalOrigin, setGoalOrigin] = useState<string | null>(null);
  const [today, setToday] = useState(dateKey);
  const tickTickHabits = useTickTickHabits(tickTick, state, setState, userId ?? 'local', today);
  const [focusedGoalId, setFocusedGoalId] = useState<string | null>(() => readGoalRoute()?.goalId ?? null);
  const [goalLocation, setGoalLocation] = useState(readGoalRoute);
  /** Задача из прямой ссылки `#/tasks/<id>` (пункт «Копировать ссылку» в меню «⋯» задачи). */
  const [pendingTask, setPendingTask] = useState<string | null>(() => readTaskRoute());
  const [selected, setSelected] = useState<string | null>(null);
  const [profileTipDismissed, setProfileTipDismissed] = useState(false);
  const [newGoalPersistent, setNewGoalPersistent] = useState(false);
  const [modal, setModal] = useState<
    'quest' | 'goal' | 'streak' | 'start' | 'profile' | null
  >(() => (state.profile.onboardingComplete || (!userId && isTaskReviewMode()) ? null : 'start'));
  useEffect(() => {
    if (userId && state.profile.onboardingComplete)
      queueMicrotask(() => setModal(current => current === 'start' ? null : current));
  }, [userId, state.profile.onboardingComplete]);
  useEffect(() => {
    const changed = () => {
      // «#open=<раздел>» — переход из системного уведомления.
      const opened = readOpenRoute(location.hash);
      if (opened) { window.history.replaceState(null, '', location.pathname + location.search); setPage(opened); return; }
      const our = readOurRoute(location.hash);
      if (our) { setPage(our.page); if (our.joinCode) setJoinCode(our.joinCode); return; }
      const taskId = readTaskRoute();
      if (taskId) { setPendingTask(taskId); setFocusedGoalId(null); setGoalLocation(null); setPage('tasks'); return; }
      const route = readGoalRoute(); setGoalLocation(route);
      if (route || location.hash === '#goals') { setPage('goals'); setFocusedGoalId(route?.goalId ?? null); }
      else { setFocusedGoalId(null); setPage(location.hash === '#city' ? 'city' : location.hash.startsWith('#ticktick=') || location.hash === '#profile' ? 'profile' : 'home'); }
    };
    window.addEventListener('hashchange', changed); window.addEventListener('popstate', changed);
    return () => { window.removeEventListener('hashchange', changed); window.removeEventListener('popstate', changed); };
  }, []);
  const [achievementFilter, setAchievementFilter] = useState('all');
  const [sphereTab, setSphereTab] = useState('overview');
  const [quickSphere, setQuickSphere] = useState<string | null>(null);
  const [cityEnter, setCityEnter] = useState<string | null>(null);
  const [questSphere, setQuestSphere] = useState('english');
  const [questTemplate, setQuestTemplate] = useState<Partial<Quest> | null>(null);
  const [toast, setToast] = useState('');
  const [storageError, setStorageError] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sphereTaskId, setSphereTaskId] = useState<string | null>(null);
  const [inboxSphereId, setInboxSphereId] = useState<string | null>(null);
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
  function openSearchResult(result: SearchResult) {
    switch (result.kind) {
      case 'task':
        setPendingTask(result.id);
        navigate('tasks');
        return;
      case 'goal':
        navigate('goals');
        openGoal(result.id);
        return;
      case 'sphere':
        navigate('spheres');
        setSelected(result.id);
        setSphereTab('overview');
        return;
      case 'city':
        if (result.id) setCityEnter(result.id);
        navigate('city');
        return;
      case 'achievement':
        navigate('achievements');
        return;
    }
  }
  /** Задача из «Нашей жизни» (решение собрания, задача от второго участника) → «Мои задачи». */
  function addTaskFromOur(title: string, day?: string): boolean {
    try { setState(quickPlanningTask(state, title.slice(0, 120), userId ?? 'local', day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined)); return true; } catch { return false; }
  }
  function switchMode(mode: LifeMode) {
    navigate(lastPageOf(mode));
  }
  function navigate(id: string) {
    if (isOurPage(id)) { if (location.hash !== ourRoute(id)) window.history.pushState(null, '', location.pathname + location.search + ourRoute(id)); }
    else if (location.hash.startsWith('#our/')) window.history.pushState(null, '', location.pathname + location.search + (id === 'profile' ? '#profile' : id === 'city' ? '#city' : ''));
    else if (id === 'profile') window.history.pushState(null, '', location.pathname + location.search + '#profile');
    else if (readGoalRoute() || readTaskRoute() || location.hash === '#goals' || location.hash === '#profile' || location.hash.startsWith('#ticktick=')) window.history.pushState(null, '', location.pathname + location.search + (id === 'city' ? '#city' : ''));
    setGoalLocation(null);
    setPage(id);
    setSelected(null);
    setSphereTab('overview');
    setFocusedGoalId(null);
    setGoalOrigin(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function finish(q: Quest) {
    if (q.done) return;
    const dependencyProblem = dependencyBlockMessage(state.quests, q);
    if (dependencyProblem) { notify(dependencyProblem); return; }
    const next = completeQuest(state, q.id);
    if (next === state) {
      notify('Эту задачу пока нельзя выполнить: проверь этап и время начала.');
      return;
    }
    setState(next);
    notify(q.rewardClaimed
      ? 'Задача отмечена выполненной. Награда уже была получена и повторно не начислена.'
      : `+${next.xp - state.xp} XP · Отличная работа!`);
  }
  function undoFinish(q: Quest) {
    const next = reopenQuest(state, q.id);
    if (next === state) return;
    setState(next);
    notify('Отметка выполнения снята. Полученная награда остаётся и повторно не начислится.');
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
    onOpen,
  }: {
    quest: Quest;
    removable?: boolean;
    onOpen?: () => void;
  }) {
    const info = spheres.find((s) => s.id === quest.sphere)!;
    const taskInfo = <>
      <strong>{quest.name}</strong>
      <TaskLabelBadge labelId={quest.labelId} labels={state.taskLabels} />
      <small>{info.name}</small>
      {(quest.dueAt || quest.startsAt) && (
        <small
          className={`quest-deadline ${!quest.done && isOverdue(quest.dueAt) ? 'is-overdue' : ''}`}
        >
          {!quest.done && isOverdue(quest.dueAt) ? 'Срок прошёл · ' : ''}
          {new Date(
            (quest.dueAt ?? quest.startsAt!).length === 10
              ? `${quest.dueAt ?? quest.startsAt}T12:00:00`
              : (quest.dueAt ?? quest.startsAt!),
          ).toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'short',
            ...(hasClockTime(quest.dueAt ?? quest.startsAt)
              ? { hour: '2-digit', minute: '2-digit' }
              : {}),
          })}
        </small>
      )}
    </>;
    return (
      <div className={`quest-row ${quest.done ? 'completed' : ''}`}>
        <span className="quest-icon" style={{ background: `${info.color}15` }}>
          <GameArt kind={info.id} />
        </span>
        <div className="quest-info">
          {onOpen
            ? <button type="button" className="quest-info-open" aria-label={`Открыть задачу: ${quest.name}`} onClick={onOpen}>{taskInfo}</button>
            : taskInfo}
        </div>
        <span className="xp-tag">+{quest.xp} XP</span>
        <button
          className={`check-button ${quest.done ? 'checked' : ''}`}
          onClick={() => quest.done ? undoFinish(quest) : finish(quest)}
          aria-label={`${quest.done ? 'Отменить выполнение' : 'Выполнить'}: ${quest.name}`}
          title={quest.done ? 'Отменить выполнение' : 'Выполнить'}
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
  return (
    <TickTickContext.Provider value={tickTick}>
      <TickTickHabitsContext.Provider value={tickTickHabits}>
      <CityAppearanceContext.Provider value={state.city}>
      <div
        className={`app-shell pyl-shell app-page-${page} ${modal === 'quest' ? 'quest-dialog-open' : ''}`}
      >
        <AppSidebar owner={owner} page={page} state={state} questCount={openTaskCount(state.quests) + tickTick.incoming.length} onNavigate={navigate} onMode={switchMode} />
        <div className="main-wrap">
          <header className="topbar"><DashboardHeader state={state} onProfile={() => navigate('profile')} onQuests={() => navigate('tasks')} onSearchResult={openSearchResult} /></header>
          <main
            className={`screen-${page} ${sphere ? 'screen-sphere-detail' : ''}`}
          >
            <div className="page-heading">
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
                    navigation.find((n) => n.id === page)?.label ?? (page === 'monthly' ? 'Итоги месяца' : undefined)
                  )}
                  <span className="heading-dot">.</span>
                </h1>
                <p>
                  {page === 'home'
                    ? 'Каждый маленький шаг приближает тебя к большому проекту.'
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
            <ErrorBoundary resetKey={`${page}:${sphere?.id ?? ''}`}>
            <Suspense fallback={<p role="status">Загружаем раздел…</p>}>
            {page === 'monthly' && (
              <KeyResults
                state={state}
                onChange={setState}
                ownerId={userId ?? 'local'}
                notify={notify}
              />
            )}
            {page === 'home' && <HomeDashboard state={state} onSphere={(id) => { setSelected(id); setSphereTab('overview'); setPage('spheres'); }} onQuests={() => navigate('tasks')} onIntegration={() => navigate('profile')} onCreate={newQuest} onStart={() => setModal('start')} onNavigate={navigate} renderQuest={q => <QuestRow key={q.id} quest={q} />} />}
            {page === 'spheres' && !sphere && <SpheresOverview state={state} onSelect={(id) => { setSelected(id); setSphereTab('overview'); window.scrollTo({ top: 0 }); }} onQuick={setQuickSphere} onQuest={(id) => { setQuestTemplate(null); setQuestSphere(id); setModal('quest'); }} onQuests={() => navigate('tasks')} renderQuest={(q) => <QuestRow key={q.id} quest={q} />} onAddRecommendation={(idea) => { setState(current => current.goals.some(g => g.sphere === idea.sphereId && g.name === idea.title && g.current < g.target) ? current : saveGoal(current, { name: idea.title, description: idea.description, sphere: idea.sphereId, target: 100, reward: 100, progressMode: 'tasks' })); notify('Проект добавлен в план. Открой его и добавь этапы и задачи.'); }} />}
            {sphere && (
              <>
                <SphereScene
                  state={state}
                  id={sphere.id}
                  tab={sphereTab as SphereTab}
                  onTab={setSphereTab}
                  onBack={() => setSelected(null)}
                  onQuest={newQuest}
                  onCity={() => { setCityEnter(sphere.id); navigate('city'); }}
                  onInbox={() => setInboxSphereId(sphere.id)}
                />
                {sphereTab === 'overview' && (
                  <SphereOverview
                    state={state}
                    id={sphere.id}
                    renderQuest={(q) => <QuestRow key={q.id} quest={q} onOpen={() => setSphereTaskId(q.id)} />}
                    onOpenGoal={(goal) => { navigate('goals'); openGoal(goal.id); setGoalOrigin(sphere.id); }}
                    onProjects={() => setSphereTab('projects')}
                    onNewProject={() => setModal('goal')}
                    onQuest={newQuest}
                    onTree={() => navigate('tree')}
                    onStatistics={() => setSphereTab('statistics')}
                  />
                )}
                {sphereTab === 'skills' && <SphereSkills state={state} id={sphere.id} onTree={() => navigate('tree')} />}
                {sphereTab === 'knowledge' && (
                  <Suspense fallback={<p role="status">Загружаем базу знаний…</p>}>
                    <KnowledgeBase ownerId={userId ?? 'local'} author={state.profile.name || 'Игрок'} photo={state.profile.photo} spheres={spheres} sphereId={sphere.id} notify={notify} />
                  </Suspense>
                )}
                {sphereTab === 'notes' && (
                  <Suspense fallback={<p role="status">Загружаем заметки…</p>}>
                    <SphereNotes ownerId={userId ?? 'local'} sphereId={sphere.id} sphereName={sphere.name} author={state.profile.name || 'Игрок'} notify={notify} />
                  </Suspense>
                )}
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
                  />
                )}
                <section
                  className="panel section-gap"
                  hidden={sphereTab !== 'quests'}
                >
                  <div className="section-heading">
                    <h2>Активные задачи</h2>
                    <button className="text-button" onClick={newQuest}>
                      + Добавить
                    </button>
                  </div>
                  {active
                    .filter((q) => q.sphere === sphere.id)
                    .map((q) => (
                      <QuestRow key={q.id} quest={q} onOpen={() => setSphereTaskId(q.id)} />
                    ))}
                  {!active.some((q) => q.sphere === sphere.id) && (
                    <p className="muted">
                      Все задачи выполнены. Можно начать новый!
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
              <Suspense fallback={<p role="status">Загружаем город…</p>}>
                <LifeCity
                  enter={cityEnter}
                  onEntered={() => setCityEnter(null)}
                  onChange={setState}
                  notify={notify}
                  state={state}
                  onOpen={(id) => {
                    setSelected(id);
                    setPage('spheres');
                    setSphereTab('overview');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </Suspense>
            )}
            {page === 'shop' && (
              <RewardShop state={state} onChange={setState} notify={notify} />
            )}
            {page === 'psychology' && owner && (
              <Suspense fallback={<p role="status">Загружаем «Психологию»…</p>}>
                <PsychologyPage />
              </Suspense>
            )}
            {page === 'notes' && (
              <Suspense fallback={<p role="status">Загружаем заметки…</p>}>
                <AllNotes ownerId={userId ?? 'local'} author={state.profile.name || 'Игрок'} spheres={spheres} notify={notify} />
              </Suspense>
            )}
            {page === 'knowledge' && (
              <Suspense fallback={<p role="status">Загружаем базу знаний…</p>}>
                <KnowledgeBase ownerId={userId ?? 'local'} author={state.profile.name || 'Игрок'} photo={state.profile.photo} spheres={spheres} start="spaces" notify={notify} />
              </Suspense>
            )}
            {page === 'statistics' && (
              <KeyResults
                state={state}
                onChange={setState}
                ownerId={userId ?? 'local'}
                notify={notify}
              />
            )}
            {isOurPage(page) && <OurLife page={page} userId={userId} userEmail={userEmail ?? undefined} userName={state.profile.name} userPhoto={state.profile.photo} userAvatar={state.profile.avatar} joinCode={joinCode} onJoined={() => setJoinCode(null)} onNavigate={navigate} onAddTask={(title, day) => { const ok = addTaskFromOur(title, day); if (ok) notify('Задача добавлена в «Мои задачи»'); return ok; }} />}
            {page === 'budget' && (
              <FinancePage state={state} onChange={setState} notify={notify} />
            )}
            {page === 'profile' && (
              <div className="profile-page">
                {accountTools && <section className="panel profile-account" aria-label="Аккаунт и сохранение">{accountTools}</section>}
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
                    <span className="streak-dots" aria-hidden="true">
                      {Array.from({ length: 7 }, (_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (6 - i));
                        const active = state.activeDates.includes(dateKey(d));
                        return <span key={i} className={active ? 'streak-dot active' : 'streak-dot'} />;
                      })}
                    </span>
                  </button>
                  <button onClick={() => navigate('achievements')}>
                    <b>
                      <GameArt kind="trophy" /> {unlocked}
                    </b>
                    <small>Достижения</small>
                  </button>
                </div>
                  <button
                    className="icon-button"
                    aria-label="Изменить профиль"
                    onClick={() => setModal('profile')}
                  >
                    <Icon name="settings" />
                  </button>
                </section>
                {state.xp === 0 && !profileTipDismissed && (
                  <section className="panel profile-tip">
                    <span className="profile-tip-icon">
                      <Icon name="bolt" size={18} />
                    </span>
                    <p>Выполни первое задание — получи первые XP и лайфкоины.</p>
                    <button
                      type="button"
                      className="icon-button profile-tip-dismiss"
                      aria-label="Скрыть подсказку"
                      onClick={() => setProfileTipDismissed(true)}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </section>
                )}
                <div className="profile-section">
                  <section className="panel profile-menu profile-settings">
                    <div className="profile-settings-row">
                      <span>Тема оформления</span>
                      <ThemeSwitch />
                    </div>
                    <button onClick={() => setModal('profile')}>
                      <Icon name="settings" />
                      <strong>Настройки персонажа</strong>
                      <Icon name="arrow" size={17} />
                    </button>
                    {owner && (
                      <label className="profile-plan-import">
                        <Icon name="plus" />
                        <strong>Загрузить план: проекты и задачи из файла</strong>
                        <Icon name="arrow" size={17} />
                        <input
                          type="file"
                          accept=".json,application/json"
                          aria-label="Загрузить план из файла"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file) return;
                            try {
                              const plan = parsePlanFile(await file.text(), Object.keys(state.spheres));
                              let result = { projects: 0, tasks: 0, completed: 0 };
                              setState((current) => { const r = importPlan(current, plan, userId ?? 'local'); result = r; return r.state; });
                              await Promise.resolve();
                              notify(result.tasks || result.projects
                                ? `План загружен: проектов ${result.projects}, задач ${result.tasks}, закрыто выполненных ${result.completed}.`
                                : 'Этот план уже загружен — новых проектов и задач нет.');
                            } catch (error) {
                              notify(error instanceof Error ? error.message : 'Не удалось загрузить план.');
                            }
                          }}
                        />
                      </label>
                    )}
                  </section>
                </div>
                <div className="profile-section">
                  <span className="profile-section-label">Журнал изменений</span>
                  <ChangeJournal />
                </div>
                {(() => {
                  const taskBadge = openTaskCount(state.quests) + tickTick.incoming.length;
                  const byId = (id: string) => navigation.find((n) => n.id === id)!;
                  const quickIds = ['tasks', 'quests', 'goals', 'spheres'];
                  const progressIds = ['tree', 'achievements', 'statistics'];
                  const systemIds = ['shop', 'city'];
                  return (
                    <>
                      <div className="profile-section">
                        <span className="profile-section-label">Быстрый доступ</span>
                        <div className="profile-quick-grid">
                          {quickIds.map((id) => {
                            const n = byId(id);
                            return (
                              <button key={id} className="profile-quick-tile" onClick={() => navigate(n.id)}>
                                <Icon name={n.icon} />
                                <span>{n.label}</span>
                                {id === 'tasks' && taskBadge > 0 && (
                                  <span className="profile-quick-badge">{taskBadge}</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div className="profile-section">
                        <span className="profile-section-label">Прогресс</span>
                        <section className="panel profile-menu">
                          {progressIds.map((id) => {
                            const n = byId(id);
                            return (
                              <button key={id} onClick={() => navigate(n.id)}>
                                <Icon name={n.icon} />
                                <strong>{n.label}</strong>
                                <Icon name="arrow" size={17} />
                              </button>
                            );
                          })}
                        </section>
                      </div>
                      <div className="profile-section">
                        <span className="profile-section-label">Система</span>
                        <section className="panel profile-menu">
                          {systemIds.map((id) => {
                            const n = byId(id);
                            return (
                              <button key={id} onClick={() => navigate(n.id)}>
                                <Icon name={n.icon} />
                                <strong>{n.label}</strong>
                                <Icon name="arrow" size={17} />
                              </button>
                            );
                          })}
                        </section>
                      </div>
                    </>
                  );
                })()}
                <section className="panel profile-ticktick"><TickTickConnection demo={state.profile.mode === 'demo'} /></section>
                <DataBackup
                  state={state}
                  connected={tickTick.restoreBlocked}
                  userId={userId}
                  onNotify={notify}
                  onRestore={(restored) => {
                    const next = userId ? adoptBackupOwner(restored, userId) : restored;
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
              </div>
            )}
            {page === 'quests' && <HabitsPage state={state} onChange={setState} ownerId={userId ?? 'local'} today={today} notify={notify} />}
            {state.focusSession && (page === 'tasks' || page === 'goals') && (
              <Suspense fallback={null}><FocusBar state={state} onChange={setState} onOpen={setSphereTaskId} /></Suspense>
            )}
            {page === 'tasks' && <QuestBoard
              initialTaskId={pendingTask}
              onInitialTaskOpened={() => setPendingTask(null)}
              state={state}
              onChange={setState}
              ownerId={userId ?? 'local'}
              today={today}
              notify={notify}
              onCreate={q => { setQuestTemplate(q ?? null); setQuestSphere(q?.sphere ?? 'health'); setModal('quest'); }}
              planContent={<LifePlanner
                state={state}
                onChange={setState}
                onGoal={(id) => { navigate('goals'); openGoal(id); }}
                onNewGoal={() => setModal('goal')}
                onNotify={notify}
              />}
            />}
            {page === 'goals' && (
              <GoalsBoard
                ownerId={userId ?? 'local'}
                state={state}
                onChange={setState}
                selectedId={focusedGoalId}
                stageId={goalLocation?.goalId === focusedGoalId ? goalLocation.stageId : undefined}
                onSphere={(id) => { navigate('spheres'); setSelected(id); setSphereTab('overview'); }}
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
                onNew={(persistent = false) => {
                  setNewGoalPersistent(persistent);
                  setModal('goal');
                }}
                onNotify={notify}
              />
            )}
            {page === 'tree' && (
              <SkillTree
                state={state}
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
                {Array.from(new Set(achievements.map((a) => a.category ?? 'Достижения'))).map(
                  (category) => {
                    const items = achievements.filter(
                      (a) =>
                        (a.category ?? 'Достижения') === category &&
                        (achievementFilter === 'all' ||
                          (achievementFilter === 'open'
                            ? a.unlocked(state)
                            : !a.unlocked(state))),
                    ).sort((a, b) => Number(b.unlocked(state)) - Number(a.unlocked(state)));
                    if (!items.length) return null;
                    return (
                      <div key={category}>
                        <div className="section-heading">
                          <h2>{category}</h2>
                        </div>
                        <div className="achievement-grid">
                          {items.map((a) => (
                            <section
                              className={`panel achievement achievement-${a.tier ?? 'bronze'} ${a.unlocked(state) ? 'unlocked' : ''}`}
                              key={a.name}
                            >
                              <span className="achievement-icon">{a.icon}</span>
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
                      </div>
                    );
                  },
                )}
              </>
            )}
            </Suspense>
            </ErrorBoundary>
          <footer className="footer">
              <img className="footer-logo" src={footerEmblem} width={28} height={28} alt="" aria-hidden="true" draggable={false} />
              <b className="footer-name">PLAY YOUR LIFE 2.0</b>
              <span className="footer-sep">✦</span><span className="footer-tagline">Маленькие шаги делают большую жизнь.</span>
              <span className="footer-sep">✦</span><span className="footer-meta">Версия {changeJournal[0].version} <span>·</span> Последнее обновление {journalDate(changeJournal[0].at)}</span>
            </footer>
          </main>
        </div>
        <MobileNav owner={owner} page={page} state={state} onNavigate={navigate} onMode={switchMode} />
        <TaskReminders key={userId ?? 'local'} tasks={state.quests} onOpen={setPendingTask} />
        {userId && isPairAccount(userEmail) && <Suspense fallback={null}><OurBackground userId={userId} userEmail={userEmail!} userName={state.profile.name} onAddTask={addTaskFromOur} onNotify={notify} /></Suspense>}
        {owner && <PsychologyReminder onOpen={() => navigate('psychology')} />}
        {userId && <NotifyPrompt owner={owner} />}
        {inboxSphereId && <TickTickInboxDialog state={state} onChange={setState} scope={{ sphereId: inboxSphereId }} onClose={() => setInboxSphereId(null)} />}
        {sphereTaskId && (
          <TaskWindow
            taskId={sphereTaskId}
            state={state}
            today={today}
            onChange={setState}
            onClose={() => setSphereTaskId(null)}
            onAdvanced={(q) => {
              setQuestTemplate(q);
              setQuestSphere(q.sphere);
              setModal('quest');
            }}
            onUndo={undoFinish}
            onComplete={finish}
            onDuplicate={(q) => {
              try {
                duplicateQuest(state, q.id, userId ?? "local");
              } catch (error) {
                notify(
                  error instanceof Error
                    ? error.message
                    : "Не удалось дублировать задачу.",
                );
                return;
              }
              setState((current) => {
                try {
                  return duplicateQuest(current, q.id, userId ?? "local");
                } catch {
                  return current;
                }
              });
              notify("Задача продублирована.");
            }}
            onDelete={(q) => {
              if (window.confirm('Удалить задачу? Уже заработанные награды и история сохранятся.')) {
                setState((current) => removeQuest(current, q.id));
                setSphereTaskId(null);
                notify('Задача удалена.');
              }
            }}
            notify={notify}
          />
        )}
        <dialog
          aria-label={
            modal === 'quest'
              ? 'Создание задачи'
              : modal === 'goal'
                ? 'Создание проекта'
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
                persistent={newGoalPersistent}
                onSave={(input) => {
                  setState(saveGoal(state, input));
                  setModal(null);
                  notify('Проект добавлен в твой план');
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
                  Выполняй хотя бы одну задачу в день. За каждый рубеж серии
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
        {modal === 'quest' && <QuestWizard state={state} initial={{ sphere: questSphere, ...questTemplate }} taskLabels={state.taskLabels ?? []} onClose={closeModal} onQuest={(q, labels) => { setState(current => saveCustomQuest({ ...current, taskLabels: labels ?? current.taskLabels }, q, userId ?? 'local')); notify('Новая задача готова. Вперёд!'); }} onHabit={h => setState(saveHabit(state, h, userId ?? 'local'))} />}
        {quickSphere && (
          <SphereQuickView
            state={state}
            id={quickSphere}
            onClose={() => setQuickSphere(null)}
            onOpen={() => { setPage('spheres'); setSelected(quickSphere); setSphereTab('overview'); setQuickSphere(null); window.scrollTo({ top: 0 }); }}
            onQuest={() => { setQuestTemplate(null); setQuestSphere(quickSphere); setQuickSphere(null); setModal('quest'); }}
            onCity={() => { setCityEnter(quickSphere); setQuickSphere(null); navigate('city'); }}
            onIdea={(name, description) => { setState((current) => current.goals.some((g) => g.sphere === quickSphere && g.name === name) ? current : saveGoal(current, { name, description, sphere: quickSphere, target: 100, reward: 100, progressMode: 'tasks' })); notify('Проект добавлен. Открой его, чтобы настроить этапы и задачи.'); }}
          />
        )}
        <UpdateNotice />
        {toast && (
          <div className="toast" role="status">
            <span>✦</span>
            {toast}
          </div>
        )}
      </div>
    </CityAppearanceContext.Provider>
      </TickTickHabitsContext.Provider>
    </TickTickContext.Provider>
  );
}
