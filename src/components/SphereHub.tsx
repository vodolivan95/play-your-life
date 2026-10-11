import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Goal, GameState, Quest } from '../game';
import { MAX_SPHERE_LEVEL } from '../sphereProgress';
import { arrangeCards, nextSteps, sphereCards, sphereDetail, statusLabels } from '../sphereDetails';
import type { SphereCardData, SphereCardFilter, SphereSort } from '../sphereDetails';
import { demoSphereRecommendation, sphereCount } from '../sphereAnalytics';
import { nodeLevel, nodeStatus, skillTreeOf } from '../skillTree';
import { monthlyFocusGoals } from '../monthlyFocus';
import { SphereBuilding } from './SphereCity';
import GameArt from './GameArt';
import Icon from './Icon';
import './SphereHub.css';

const tone = (color: string) => ({ '--sph-color': color }) as CSSProperties;
const dayWord = (n: number) => (n % 10 === 1 && n % 100 !== 11 ? 'день' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'дня' : 'дней');

function XPBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="sph-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
      <span style={{ width: `${Math.max(3, Math.min(100, value))}%` }} />
    </div>
  );
}

function xpLine(card: Pick<SphereCardData, 'maxed' | 'currentXP' | 'requiredXP' | 'level'>) {
  return card.maxed ? 'Максимальный уровень' : `${card.currentXP} / ${card.requiredXP} XP до LVL ${card.level + 1}`;
}

/** Карточки девяти районов с фильтром и сортировкой. */
export function SphereCards({ state, onOpen, onQuick, onQuest }: { state: GameState; onOpen: (id: string) => void; onQuick: (id: string) => void; onQuest: (id: string) => void }) {
  const [filter, setFilter] = useState<SphereCardFilter>('all');
  const [sort, setSort] = useState<SphereSort>('order');
  const all = sphereCards(state);
  const cards = arrangeCards(all, filter, sort);
  const filters: [SphereCardFilter, string][] = [['all', 'Все'], ['tasks', 'Есть задачи'], ['weak', 'Нужно внимание'], ['strong', 'Сильные']];
  return (
    <section className="sph-section" aria-label="Мои сферы">
      <div className="sph-toolbar">
        <div className="sph-title"><h2>Мои сферы</h2><span className="sph-pill">{all.length} районов</span></div>
        <div className="sph-tools">
          <div className="sph-segment" role="group" aria-label="Фильтр сфер">
            {filters.map(([id, label]) => <button key={id} type="button" className={filter === id ? 'on' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label}</button>)}
          </div>
          <label className="sph-sort"><span className="sr-only">Порядок сфер</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SphereSort)}>
              <option value="order">По порядку</option>
              <option value="weak">Сначала отстающие</option>
              <option value="strong">Сначала сильные</option>
            </select>
          </label>
        </div>
      </div>
      {cards.length ? (
        <div className="sph-grid">
          {cards.map((card) => (
            <article key={card.id} className="sph-card" style={tone(card.color)}>
              <button type="button" className="sph-card-photo" onClick={() => onQuick(card.id)} aria-label={`Коротко о сфере ${card.name}`}>
                <SphereBuilding id={card.id} />
                <span className="sph-lvl">LVL {card.level}</span>
                <span className={`sph-status is-${card.status}`}>{statusLabels[card.status]}</span>
              </button>
              <div className="sph-card-body">
                <div className="sph-card-head">
                  <span className="sph-badge"><GameArt kind={card.id} /></span>
                  <div><h3>{card.name}</h3><small>{card.rank} · {card.totalXP} XP всего</small></div>
                </div>
                <XPBar value={card.progress} label={`XP: ${card.name}`} />
                <small className="sph-xp-line">{xpLine(card)}</small>
                <div className="sph-stats">
                  <span><b>{card.projects}</b><small>{sphereCount(card.projects, 'projects').replace(/^\d+ /, '')}</small></span>
                  <span><b>{card.tasksToday}</b><small>задач сегодня</small></span>
                  <span><b>{card.streak}</b><small>{dayWord(card.streak)} подряд</small></span>
                </div>
                <div className="sph-actions">
                  <button type="button" className="sph-open" onClick={() => onOpen(card.id)}>Открыть район →</button>
                  <button type="button" className="sph-icon-btn" aria-label={`Новое задание в сфере ${card.name}`} onClick={() => onQuest(card.id)}><Icon name="plus" size={18} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="sph-empty" role="status">{filter === 'tasks' ? 'На сегодня задач нет ни в одной сфере.' : filter === 'weak' ? 'Сейчас ни одна сфера не отстаёт.' : 'Пока ни одна сфера не вырвалась вперёд.'}</p>
      )}
    </section>
  );
}

/** «Следующие шаги по сферам» и «XP за неделю по сферам». */
export function SphereWeekPanels({ state, renderQuest, onQuests }: { state: GameState; renderQuest: (quest: Quest) => ReactNode; onQuests: () => void }) {
  const steps = nextSteps(state, 4);
  const cards = sphereCards(state);
  const max = Math.max(1, ...cards.map((c) => c.weekXP));
  return (
    <section className="sph-two" aria-label="Неделя по сферам">
      <div className="sph-panel">
        <div className="sph-panel-head"><h2>Следующие шаги по сферам</h2><button type="button" className="sph-link" onClick={onQuests}>Все задачи →</button></div>
        {steps.length ? <div className="sph-quests">{steps.map(({ quest }) => renderQuest(quest))}</div> : <p className="sph-muted">На сегодня всё сделано. Добавь новое задание в любую сферу.</p>}
      </div>
      <div className="sph-panel">
        <div className="sph-panel-head"><h2>XP за неделю по сферам</h2></div>
        <div className="sph-week">
          {cards.map((c) => (
            <div key={c.id} className="sph-week-row" style={tone(c.color)}>
              <span>{c.name}</span>
              <div><i style={{ width: `${Math.max(c.weekXP ? 4 : 0, (c.weekXP / max) * 100)}%` }} /></div>
              <b>+{c.weekXP}</b>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Окно сферы: открывается по нажатию на карточку или на подпись в паутине. */
export function SphereQuickView({ state, id, onClose, onOpen, onQuest, onCity, onIdea }: { state: GameState; id: string; onClose: () => void; onOpen: () => void; onQuest: () => void; onCity: () => void; onIdea: (title: string, description: string) => void }) {
  const card = sphereCards(state).find((c) => c.id === id)!;
  const idea = demoSphereRecommendation(id);
  const added = state.goals.some((g) => g.sphere === id && g.name === idea.title);
  const diff = card.level - card.average;
  useEffect(() => {
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose]);
  return (
    <div className="sph-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="sph-quick" role="dialog" aria-modal="true" aria-label={`Сфера ${card.name}`} style={tone(card.color)}>
        <div className="sph-quick-photo">
          <SphereBuilding id={id} />
          <span className={`sph-status is-${card.status}`}>{statusLabels[card.status]}</span>
          <button type="button" className="sph-close" aria-label="Закрыть окно" onClick={onClose} autoFocus><Icon name="close" size={18} /></button>
        </div>
        <div className="sph-quick-body">
          <div className="sph-quick-head">
            <span className="sph-badge big"><GameArt kind={id} /></span>
            <div><h2>{card.name}</h2><small>LVL {card.level} / {MAX_SPHERE_LEVEL} · {xpLine(card)}</small></div>
            <div className="sph-quick-diff"><b>{diff > 0 ? '+' : diff < 0 ? '−' : ''}{Math.abs(diff).toFixed(1)}</b><small>к среднему уровню</small></div>
          </div>
          <XPBar value={card.progress} label={`XP: ${card.name}`} />
          <div className="sph-stats four">
            <span><b>{card.projects}</b><small>{sphereCount(card.projects, 'projects').replace(/^\d+ /, '')}</small></span>
            <span><b>{card.tasksToday}</b><small>задач сегодня</small></span>
            <span><b>{card.idleDays === null ? '—' : card.idleDays === 0 ? 'Сегодня' : `${card.idleDays} ${dayWord(card.idleDays)}`}</b><small>{card.idleDays === null ? 'действий ещё не было' : card.idleDays === 0 ? 'было действие' : 'без действий'}</small></span>
            <span><b>{card.maxed ? 0 : card.requiredXP - card.currentXP} XP</b><small>до нового уровня</small></span>
          </div>
          <div className="sph-quick-idea">
            <small>БЫСТРЫЙ СТАРТ</small>
            <button type="button" disabled={added} onClick={() => onIdea(idea.title, idea.description)}>
              <span>{idea.title}</span><small>{added ? '✓ Уже в твоих проектах' : 'Добавить проект · +100 XP'}</small>
            </button>
          </div>
          <div className="sph-quick-actions">
            <button type="button" className="sph-primary" onClick={onOpen}>Открыть район</button>
            <button type="button" className="sph-secondary" onClick={onQuest}>+ Новое задание</button>
            <button type="button" className="sph-secondary" onClick={onCity}>Войти в здание</button>
          </div>
        </div>
      </section>
    </div>
  );
}

/** Обложка открытой сферы: здание, кольцо уровня, показатели и действия. */
export function SphereHero({ state, id, onBack, onQuest, onProject, onCity }: { state: GameState; id: string; onBack: () => void; onQuest: () => void; onProject: () => void; onCity: () => void }) {
  const d = sphereDetail(state, id);
  const card = sphereCards(state).find((c) => c.id === id)!;
  const r = 48, length = 2 * Math.PI * r;
  return (
    <>
      <nav className="sph-crumbs" aria-label="Навигация">
        <button type="button" onClick={onBack}>← Все сферы</button>
        <span>Сферы жизни</span><span aria-hidden="true">/</span><b>{d.info.name}</b>
      </nav>
      <section className="sph-hero" style={tone(d.info.color)} aria-label={`Район ${d.info.name}`}>
        <div className="sph-hero-photo"><SphereBuilding id={id} /></div>
        <div className="sph-hero-body">
          <div className="sph-hero-title">
            <span className="sph-badge big"><GameArt kind={id} /></span>
            <div><small>ТВОЙ РАЙОН РАЗВИТИЯ</small><h1>{d.info.name}</h1></div>
          </div>
          <div className="sph-hero-level">
            <svg width="112" height="112" viewBox="0 0 112 112" role="img" aria-label={`Уровень ${d.progress.level} из ${MAX_SPHERE_LEVEL}`}>
              <circle cx="56" cy="56" r={r} className="sph-ring-track" />
              <circle cx="56" cy="56" r={r} className="sph-ring" strokeDasharray={`${(length * d.progress.progress) / 100} ${length}`} transform="rotate(-90 56 56)" />
              <text x="56" y="50" textAnchor="middle" className="sph-ring-label">LVL</text>
              <text x="56" y="78" textAnchor="middle" className="sph-ring-value">{d.progress.level}</text>
            </svg>
            <div>
              <div className="sph-hero-xp"><span>{d.rank}</span><span>{xpLine({ ...d.progress, level: d.progress.level })}</span></div>
              <XPBar value={d.progress.progress} label={`XP: ${d.info.name}`} />
              <p>Уровень растёт за реальные действия: квесты и задачи проектов этого района.</p>
            </div>
          </div>
          <div className="sph-chips">
            <span><b>{d.progress.totalXP} XP</b> всего</span>
            <span><b>{d.streak} {dayWord(d.streak)}</b> подряд</span>
            <span><b>{sphereCount(d.projects.length, 'projects')}</b> в работе</span>
            <span className={`sph-status-chip is-${card.status}`}>{card.status === 'strong' ? 'Сильная сфера' : card.status === 'weak' ? 'Нужно внимание' : 'В пути'}</span>
          </div>
          <div className="sph-hero-actions">
            <button type="button" className="sph-primary" onClick={onQuest}>+ Новое задание</button>
            <button type="button" className="sph-secondary" onClick={onProject}>+ Новый проект</button>
            <button type="button" className="sph-secondary" onClick={onCity}>Войти в здание</button>
          </div>
        </div>
      </section>
    </>
  );
}

function SkillList({ state, id, limit }: { state: GameState; id: string; limit?: number }) {
  const nodes = skillTreeOf(state, id).nodes;
  const shown = limit ? nodes.slice(0, limit) : nodes;
  if (!shown.length) return <p className="sph-muted">В дереве этой сферы пока нет навыков. Добавь ветку и первые навыки в Skill Tree.</p>;
  const words = { max: 'Освоен полностью', learning: 'Изучается', available: 'Доступен', locked: 'Закрыт' } as const;
  return (
    <div className="sph-skills">
      {shown.map((node) => {
        const status = nodeStatus(state, id, node);
        return (
          <div key={node.id} className={`sph-skill is-${status}`}>
            <span className="sph-skill-icon"><GameArt kind={node.icon} /></span>
            <div><b>{node.name}</b><small>{words[status]} · {nodeLevel(state, node)} / {node.levels}</small></div>
          </div>
        );
      })}
    </div>
  );
}

/** Вкладка «Навыки» открытой сферы. */
export function SphereSkills({ state, id, onTree }: { state: GameState; id: string; onTree: () => void }) {
  return (
    <section className="sph-panel">
      <div className="sph-panel-head"><h2>Навыки района</h2><button type="button" className="sph-link" onClick={onTree}>Открыть Skill Tree →</button></div>
      <SkillList state={state} id={id} />
    </section>
  );
}

/** Вкладка «Обзор» открытой сферы. */
export function SphereOverview({ state, id, renderQuest, onOpenGoal, onProjects, onNewProject, onTree, onHistory }: { state: GameState; id: string; renderQuest: (quest: Quest) => ReactNode; onOpenGoal: (goal: Goal) => void; onProjects: () => void; onNewProject: () => void; onTree: () => void; onHistory: () => void }) {
  const d = sphereDetail(state, id);
  const focus = new Set(monthlyFocusGoals(state).map((g) => g.id));
  const maxWeek = Math.max(1, ...d.weeks.map((w) => w.xp));
  const done = d.tasksToday.filter((q) => q.done).length;
  const thisWeek = d.weeks[d.weeks.length - 1].xp, lastWeek = d.weeks[d.weeks.length - 2].xp;
  return (
    <div className="sph-overview" style={tone(d.info.color)}>
      <div className="sph-col">
        <section className="sph-panel">
          <div className="sph-panel-head"><h2>Проекты района</h2><button type="button" className="sph-link" onClick={onProjects}>Все проекты →</button></div>
          {d.projects.length ? (
            <div className="sph-projects">
              {d.projects.slice(0, 2).map((goal) => {
                const tasks = state.quests.filter((q) => q.goalId === goal.id);
                const next = tasks.find((q) => !q.done);
                const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
                return (
                  <article key={goal.id} className="sph-project">
                    <div className="sph-project-top">{focus.has(goal.id) ? <span className="sph-tag accent">Главный квест месяца</span> : <span className="sph-tag">В работе</span>}{goal.dueAt && <small>до {new Date(goal.dueAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</small>}</div>
                    <h3>{goal.name}</h3>
                    <XPBar value={pct} label={`Прогресс: ${goal.name}`} />
                    <div className="sph-project-meta"><span>{tasks.length ? `${tasks.filter((q) => q.done).length} из ${tasks.length} задач` : 'Пока нет задач'}</span><b>{pct}%</b></div>
                    <p className="sph-next">Следующий шаг: <b>{next?.name ?? 'Добавить первый шаг'}</b></p>
                    <div className="sph-project-foot"><span className="sph-reward">Награда: {goal.reward} XP</span><button type="button" className="sph-link" onClick={() => onOpenGoal(goal)}>Продолжить →</button></div>
                  </article>
                );
              })}
            </div>
          ) : <p className="sph-muted">В этом районе пока нет проектов.</p>}
          <button type="button" className="sph-dashed" onClick={onNewProject}>+ Создать проект или выбрать идею</button>
        </section>
        <section className="sph-panel">
          <div className="sph-panel-head"><h2>Задачи на сегодня</h2><span className="sph-muted small">{done} из {d.tasksToday.length} выполнено</span></div>
          {d.tasksToday.length ? <div className="sph-quests">{d.tasksToday.map((q) => renderQuest(q))}</div> : <p className="sph-muted">На сегодня задач в этой сфере нет.</p>}
        </section>
      </div>
      <div className="sph-col">
        <section className="sph-panel">
          <div className="sph-panel-head"><h2>XP по неделям</h2>{lastWeek > 0 && <span className={`sph-trend ${thisWeek >= lastWeek ? 'up' : 'down'}`}>{thisWeek >= lastWeek ? '+' : '−'}{Math.abs(Math.round(((thisWeek - lastWeek) / lastWeek) * 100))}% к прошлой</span>}</div>
          <div className="sph-chart" role="img" aria-label={`XP по неделям: ${d.weeks.map((w) => w.xp).join(', ')}`}>
            {d.weeks.map((w, i) => <div key={i} className={i === d.weeks.length - 1 ? 'now' : ''}><i style={{ height: `${Math.max(w.xp ? 6 : 2, (w.xp / maxWeek) * 100)}%` }} /><small>{i === d.weeks.length - 1 ? 'Эта' : w.start.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</small></div>)}
          </div>
        </section>
        <section className="sph-panel">
          <div className="sph-panel-head"><h2>Навыки района</h2><button type="button" className="sph-link" onClick={onTree}>Skill Tree →</button></div>
          <SkillList state={state} id={id} limit={3} />
        </section>
        <section className="sph-panel sph-next-level">
          <span className="sph-trophy"><GameArt kind="trophy" /></span>
          <div><small>{d.progress.maxed ? 'ВЕРШИНА' : `СЛЕДУЮЩИЙ УРОВЕНЬ — LVL ${d.progress.level + 1}`}</small><b>{d.progress.maxed ? 'Район прокачан до максимума' : `Осталось ${d.progress.remainingXP} XP`}</b><small>{d.progress.maxed ? 'Так держать!' : 'Выполняй задания и задачи проектов этого района'}</small></div>
        </section>
        <section className="sph-panel">
          <div className="sph-panel-head"><h2>История</h2>{d.history.length > 4 && <button type="button" className="sph-link" onClick={onHistory}>Вся история →</button>}</div>
          {d.history.length ? d.history.slice(0, 4).map((e) => (
            <div key={e.id} className="sph-history"><i /><div><b>{e.title}</b><small>{new Date(e.date).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</small></div><span>+{e.xp} XP</span></div>
          )) : <p className="sph-muted">Здесь появятся выполненные действия.</p>}
        </section>
      </div>
    </div>
  );
}
