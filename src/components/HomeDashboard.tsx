import { useContext } from 'react';
import type { ReactNode } from 'react';
import type { GameState, Quest } from '../game';
import { streak, streakRewards, dateKey as localDate, questsForToday } from '../game';
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
  const tasks = questsForToday(state, now);
  const peaks = monthlyFocusGoals(state, now).map(goal => goalPeak(state, goal, now));
  const currentStreak = streak(state.activeDates);
  const monday = new Date(now);
  monday.setDate(now.getDate() - (now.getDay() + 6) % 7);

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
      <HomeYearSummary state={state} onSphere={onSphere} />
    </div>
  );
}
