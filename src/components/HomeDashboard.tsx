import { useContext } from 'react';
import type { ReactNode } from 'react';
import type { GameState, Quest } from '../game';
import {
  streak, streakRewards, dateKey as localDate, questsForToday,
  todayEarnings, weekCompletedQuests,
} from '../game';
import { quoteForNow } from '../quoteOfDay';
import { TickTickContext } from '../tickTickContext';
import { monthlyFocusGoals } from '../monthlyFocus';
import { goalPeak } from '../nextPeak';
import { useMenuTheme } from '../menuTheme';
import HomeBanner from './HomeBanner';
import HomeYearSummary from './HomeYearSummary';
import './HomeDashboard.css';

type Props = {
  state: GameState;
  onSphere: (id: string | null) => void;
  onQuests: () => void;
  onIntegration: () => void;
  onCreate: () => void;
  onStart: () => void;
  onNavigate: (page: string) => void;
  onOpenTask: (id: string) => void;
  onOpenGoal: (id: string) => void;
  renderQuest: (quest: Quest) => ReactNode;
};

export default function HomeDashboard({
  state, onSphere, onQuests, onIntegration, onCreate, onStart,
  onNavigate, onOpenTask, onOpenGoal, renderQuest,
}: Props) {
  const tickTick = useContext(TickTickContext);
  const [theme] = useMenuTheme();
  const now = new Date();
  // На главной показываем только настоящие сегодняшние задачи, без просроченных
  // «хвостов» из прошлых дней (их список — на вкладке «Мои задачи» → «Просрочено»):
  // иначе модуль разрастается на экраны вниз и перестаёт помещаться вровень с
  // правой колонкой. `questsForToday()` (используется в счётчиках меню и других
  // местах) специально включает и просрочку — здесь фильтруем дополнительно,
  // саму функцию не трогаем.
  const todayKey = localDate(now);
  const tasks = questsForToday(state, now).filter((q) => {
    if (q.done) return true;
    const due = q.dueAt ?? q.startsAt;
    return !due || localDate(new Date(due)) === todayKey;
  });
  const peaks = monthlyFocusGoals(state, now).map(goal => goalPeak(state, goal, now));
  const currentStreak = streak(state.activeDates);
  const monday = new Date(now);
  monday.setDate(now.getDate() - (now.getDay() + 6) % 7);
  const quote = quoteForNow(now);
  const earnings = todayEarnings(state, now);
  const week = weekCompletedQuests(state, now);
  const weekDayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const weekMax = Math.max(1, ...week.counts);
  const todayIndex = (now.getDay() + 6) % 7;

  return (
    <div className="home-dashboard" data-theme={theme}>
      <HomeBanner
        peaks={peaks}
        demo={state.profile.mode === 'demo'}
        onContinue={onQuests}
        onNavigate={onNavigate}
        onShowTask={peak => peak.taskId ? onOpenTask(peak.taskId) : onOpenGoal(peak.goalId)}
        onChooseFocus={() => onSphere(null)}
        onStart={onStart}
      />
      <section className="home-panel home-today">
        <div className="home-section-title">
          <h2>Мои задачи на сегодня <span>{tasks.filter(q => !q.done).length}</span></h2>
          <button onClick={onCreate}>＋ Добавить задачу</button>
        </div>
        <div className="home-ticktick-status">
          {tickTick?.connected ? 'Задачи твоей игры · TickTick подключён' : 'Задачи твоей игры · TickTick не подключён'}
          <button onClick={onIntegration}>Настроить</button>
        </div>
        {tasks.map(q => renderQuest(q))}
        {!tasks.length && (
          <div className="home-empty">
            <strong>Сегодня начинается с одного шага</strong>
            <p>Добавь задачу на день или выбери шаблон задачи.</p>
          </div>
        )}
        <button className="home-all-tasks" onClick={onQuests}>Все задачи →</button>
      </section>
      <div className="home-right-stack">
        <section className="home-panel home-quote">
          <div className="home-quote-label">Цитата дня</div>
          <p className="home-quote-text">«{quote.text}»</p>
        </section>

        <section className="home-panel home-streak">
          <div className="home-section-title"><h2>Серия дней</h2><strong>{currentStreak} дн.</strong></div>
          <div className="home-week">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((name, i) => {
              const day = new Date(monday);
              day.setDate(monday.getDate() + i);
              const date = localDate(day);
              const completed = state.activeDates.includes(date);
              return (
                <div key={name}>
                  <span className={completed ? 'completed' : date === localDate(now) ? 'today' : ''}>{completed ? '✓' : ''}</span>
                  <small>{name}</small>
                </div>
              );
            })}
          </div>
          <p className="home-streak-note">Выполняй хотя бы одну задачу в день: на рубежах серии даётся бонус XP. Пропуск дня сбрасывает серию.</p>
          <div className="home-streak-rewards">
            <h3>Награды за серию</h3>
            {Object.entries(streakRewards).map(([days, xp]) => (
              <div key={days} className={currentStreak >= Number(days) ? 'is-reached' : ''}>
                <span>{days} дней</span><b>+{xp} XP</b>
              </div>
            ))}
          </div>
        </section>

        <section className="home-panel home-balance">
          <div className="home-balance-label">Баланс сегодня</div>
          <div className="home-balance-row">
            <div><strong>+{earnings.xp}</strong><small>опыта</small></div>
            <div><strong>+{earnings.coins}</strong><small>монет</small></div>
            <div><strong>{earnings.habitsDone}/{earnings.habitsTotal}</strong><small>привычек</small></div>
          </div>
        </section>

        <section className="home-panel home-week-done">
          <div className="home-balance-label">Выполнено за неделю</div>
          <div className="home-week-done-total"><strong>{week.total}</strong><span>задач{week.topSphereName ? ` · больше всего в сфере «${week.topSphereName}»` : ''}</span></div>
          <div className="home-week-done-bars">
            {weekDayNames.map((name, i) => {
              const count = week.counts[i];
              const height = count ? Math.max(10, Math.round((count / weekMax) * 100)) : 0;
              return (
                <div key={name} className={i === todayIndex ? 'is-today' : ''}>
                  <div className="home-week-done-bar-track">
                    <span style={{ height: `${height}%` }} title={`${count}`} />
                  </div>
                  <small>{name}</small>
                </div>
              );
            })}
          </div>
        </section>
      </div>
      <HomeYearSummary state={state} onSphere={onSphere} />
    </div>
  );
}
