import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Goal, GameState, Quest } from '../game';
import { MAX_SPHERE_LEVEL } from '../sphereProgress';
import { arrangeCards, districtPath, districtStats, nextSteps, sphereCards, sphereDetail, statusLabels } from '../sphereDetails';
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

export type SphereTab = 'overview' | 'projects' | 'quests' | 'skills' | 'history' | 'statistics';

/** Маленькие значки сцены района (обводка текущим цветом). */
function Glyph({ name, size = 20 }: { name: 'grid' | 'flag' | 'check' | 'tree' | 'clock' | 'chart' | 'door' | 'plus' | 'back' | 'flame' | 'lock'; size?: number }) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    flag: <><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>,
    check: <path d="M5 12l5 5 9-10" />,
    tree: <><circle cx="12" cy="5" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M12 7.5v4M12 11.5l-5 4M12 11.5l5 4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    chart: <><path d="M4 20h16" /><path d="M7 16v-5M12 16V6M17 16v-8" /></>,
    door: <path d="M4 21V5l8-2v18M12 21h8V8l-8-2" />,
    plus: <path d="M12 5v14M5 12h14" />,
    back: <path d="M15 5l-7 7 7 7" />,
    flame: <path d="M12 2c1 4 5 6 5 11a5 5 0 01-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-6 1-9.5z" />,
    lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  };
  const filled = name === 'flame';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke={filled ? 'none' : 'currentColor'} strokeWidth={name === 'plus' || name === 'check' ? 3 : 2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

/** Шестиугольник уровня, как в RPG. */
function LevelHex({ level, size = 84 }: { level: number; size?: number }) {
  return (
    <svg className="sph-hex" width={size} height={size} viewBox="0 0 112 112" role="img" aria-label={`Уровень района ${level} из ${MAX_SPHERE_LEVEL}`}>
      <polygon points="56,4 101,30 101,82 56,108 11,82 11,30" />
      <text x="56" y="44" textAnchor="middle" className="sph-hex-label">LVL</text>
      <text x="56" y="80" textAnchor="middle" className="sph-hex-value">{level}</text>
    </svg>
  );
}

/** Полоса XP с подписью внутри. */
function GameBar({ value, text, label, tone: kind = 'xp' }: { value: number; text: string; label: string; tone?: 'xp' | 'boss' }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`sph-gbar is-${kind}`} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <span style={kind === 'boss' ? { marginLeft: `${100 - pct}%`, width: `${pct}%` } : { width: `${Math.max(pct ? 3 : 0, pct)}%` }} />
      <b>{text}</b>
    </div>
  );
}

/** Сцена открытой сферы: здание на весь блок, ресурсы, метки на здании, уровень и док разделов. */
export function SphereScene({ state, id, tab, onTab, onBack, onQuest, onCity }: { state: GameState; id: string; tab: SphereTab; onTab: (tab: SphereTab) => void; onBack: () => void; onQuest: () => void; onCity: () => void }) {
  const d = sphereDetail(state, id);
  const done = d.tasksToday.filter((q) => q.done).length;
  const open = d.tasksToday.length - done;
  const tabs: [SphereTab, string, Parameters<typeof Glyph>[0]['name'], number?][] = [
    ['overview', 'Обзор', 'grid'],
    ['projects', 'Проекты', 'flag', d.projects.length],
    ['quests', 'Задачи', 'check', open],
    ['skills', 'Навыки', 'tree'],
    ['history', 'История', 'clock'],
    ['statistics', 'Статистика', 'chart'],
  ];
  return (
    <section className="sph-scene" style={tone(d.info.color)} aria-label={`Район ${d.info.name}`}>
      <div className="sph-scene-stage">
        <div className="sph-scene-photo"><SphereBuilding id={id} /></div>
        <div className="sph-hud">
          <button type="button" className="sph-hud-back" onClick={onBack} aria-label="← Все сферы"><Glyph name="back" size={16} /><span>Все сферы</span></button>
          <span className="sph-hud-gap" />
          <span className="sph-res is-xp"><i>XP</i>{d.progress.totalXP}<small> всего</small></span>
          <span className="sph-res is-streak"><Glyph name="flame" size={16} />{d.streak}<small> {dayWord(d.streak)} подряд</small></span>
          <span className="sph-res is-day"><Glyph name="check" size={14} />{done}/{d.tasksToday.length}<small> заданий дня</small></span>
        </div>
        <button type="button" className="sph-pin is-projects" onClick={() => onTab('projects')}><span><Glyph name="flag" size={15} />Проекты · {d.projects.length}</span></button>
        <button type="button" className="sph-pin is-enter" onClick={onCity}><span><Glyph name="door" size={15} />Войти в здание</span></button>
        <button type="button" className="sph-pin is-tasks" onClick={() => onTab('quests')}><span><Glyph name="check" size={15} />Задачи · {open} сегодня</span></button>
        <div className="sph-scene-bottom">
          <div className="sph-scene-title">
            <LevelHex level={d.progress.level} />
            <div>
              <div className="sph-scene-name"><h1>{d.info.name}</h1><small>{d.rank.toUpperCase()}</small></div>
              <GameBar value={d.progress.progress} label={`XP: ${d.info.name}`} text={d.progress.maxed ? 'Максимальный уровень' : `${d.progress.currentXP} / ${d.progress.requiredXP} XP до LVL ${d.progress.level + 1}`} />
            </div>
          </div>
        </div>
      </div>
      <div className="sph-dock">
        <div className="sph-dock-tabs" role="tablist" aria-label="Разделы сферы">
          {tabs.map(([key, name, icon, count]) => (
            <button key={key} type="button" role="tab" aria-label={count ? `${name} · ${count}` : name} aria-selected={tab === key} className={`sph-dock-tab${tab === key ? ' on' : ''}`} onClick={() => onTab(key)}>
              <span className="sph-dock-icon"><Glyph name={icon} />{count ? <em>{count}</em> : null}</span>
              <span className="sph-dock-label">{name}</span>
            </button>
          ))}
        </div>
        <button type="button" className="sph-dock-plus" onClick={onQuest}><span><Glyph name="plus" size={26} /></span><small>Новое задание</small></button>
      </div>
    </section>
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

const weekdayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const shortDate = (time: number | Date) => new Date(time).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });

/** Значок достижения: шестиугольник с символом, у закрытых — замок. */
function Medal({ id, done }: { id: string; done: boolean }) {
  const glyph: Record<string, Parameters<typeof Glyph>[0]['name']> = { first: 'check', week: 'flame', project: 'flag', 'two-weeks': 'flame' };
  return (
    <span className={`sph-medal is-${id}${done ? ' done' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 56 56"><polygon points="28,3 50,15 50,41 28,53 6,41 6,15" /></svg>
      <Glyph name={done ? glyph[id] ?? 'check' : 'lock'} size={22} />
    </span>
  );
}

/** Вкладка «Обзор» открытой сферы — как в игре: путь района, босс месяца, задания дня, статистика и достижения. */
export function SphereOverview({ state, id, renderQuest, onOpenGoal, onProjects, onNewProject, onQuest, onTree, onStatistics }: { state: GameState; id: string; renderQuest: (quest: Quest) => ReactNode; onOpenGoal: (goal: Goal) => void; onProjects: () => void; onNewProject: () => void; onQuest: () => void; onTree: () => void; onStatistics: () => void }) {
  const d = sphereDetail(state, id);
  const s = districtStats(state, id);
  const path = districtPath(d.progress.totalXP);
  const focus = monthlyFocusGoals(state).filter((g) => g.sphere === id && g.current < g.target);
  const boss = focus[0] ?? d.projects[0] ?? null;
  const bossTasks = boss ? state.quests.filter((q) => q.goalId === boss.id) : [];
  const bossNext = bossTasks.find((q) => !q.done);
  const bossPct = boss ? Math.min(100, Math.round((boss.current / boss.target) * 100)) : 0;
  const done = d.tasksToday.filter((q) => q.done).length;
  const maxWeek = Math.max(1, ...s.weeks.map((w) => w.xp));
  const maxDay = Math.max(...s.weekdays);
  const strongDay = maxDay > 0 ? weekdayNames[s.weekdays.indexOf(maxDay)] : null;
  const diff = s.thisWeek - s.lastWeek;
  const gained = s.achievements.filter((a) => a.done).length;
  const pathFill = path.length > 1 ? d.progress.progress / path.length : 0;
  return (
    <div className="sph-game" style={tone(d.info.color)}>
      <section className="sph-panel sph-path" aria-label="Путь района">
        <div className="sph-panel-head"><h2>Путь района</h2><span className="sph-muted small">что откроется на следующих уровнях</span></div>
        <ol className="sph-path-track" style={{ '--path-count': path.length, '--path-fill': `${pathFill}%` } as CSSProperties}>
          {path.map((node) => (
            <li key={node.level} className={node.current ? 'current' : ''}>
              <span className="sph-path-dot">{node.level}</span>
              <b>{node.title}</b>
              <small>{node.note}</small>
            </li>
          ))}
        </ol>
      </section>

      <div className="sph-game-row">
        <section className="sph-panel sph-boss" aria-label="Босс месяца">
          <div className="sph-panel-head"><small className="sph-kicker">{focus.length ? 'БОСС МЕСЯЦА' : 'ГЛАВНЫЙ ПРОЕКТ'}</small>{boss ? <span className="sph-reward">Награда {boss.reward} XP</span> : null}</div>
          {boss ? (
            <>
              <h3>{boss.name}</h3>
              <GameBar tone="boss" value={100 - bossPct} label={`Сила босса: ${boss.name}`} text={`Сила босса ${100 - bossPct}% · пройдено ${bossPct}%`} />
              <div className="sph-boss-next">
                <span>Следующий удар: <b>{bossNext?.name ?? 'добавить первый шаг'}</b></span>
                <button type="button" onClick={() => onOpenGoal(boss)}>В бой</button>
              </div>
              <div className="sph-boss-foot">
                <button type="button" className="sph-link" onClick={onProjects}>Все проекты района →</button>
                <button type="button" className="sph-link" onClick={onNewProject}>+ Новый проект</button>
              </div>
            </>
          ) : (
            <>
              <h3>Босса пока нет</h3>
              <p className="sph-muted">Начни проект района — он станет главным боссом, а его шаги будут «ударами».</p>
              <button type="button" className="sph-dashed" onClick={onNewProject}>+ Создать проект или выбрать идею</button>
            </>
          )}
        </section>

        <section className="sph-panel sph-daily" aria-label="Квесты дня">
          <div className="sph-panel-head"><h2>Квесты дня</h2><span className="sph-muted small">{done} из {d.tasksToday.length}</span></div>
          {d.tasksToday.length ? (
            <>
              <div className="sph-segments" aria-hidden="true">{d.tasksToday.map((q) => <i key={q.id} className={q.done ? 'on' : ''} />)}</div>
              <div className="sph-quests">{d.tasksToday.map((q) => renderQuest(q))}</div>
            </>
          ) : (
            <>
              <p className="sph-muted">На сегодня заданий в этом районе нет.</p>
              <button type="button" className="sph-dashed" onClick={onQuest}>+ Новое задание</button>
            </>
          )}
        </section>

        <section className="sph-panel" aria-label="Ветки навыков">
          <div className="sph-panel-head"><h2>Ветки навыков</h2><button type="button" className="sph-link" onClick={onTree}>Skill Tree →</button></div>
          <SkillList state={state} id={id} limit={3} />
        </section>
      </div>

      <section className="sph-panel sph-stats-block" aria-label="Статистика района">
        <div className="sph-panel-head"><h2>Статистика района</h2><button type="button" className="sph-link" onClick={onStatistics}>Вся статистика →</button></div>
        <div className="sph-kpis">
          <div className="sph-kpi is-gold"><small>XP ЗА НЕДЕЛЮ</small><b>+{s.thisWeek}</b><span className={diff > 0 ? 'up' : diff < 0 ? 'down' : ''}>{diff > 0 ? `▲ на ${diff} больше прошлой` : diff < 0 ? `▼ на ${-diff} меньше прошлой` : 'как на прошлой неделе'}</span></div>
          <div className="sph-kpi is-green"><small>ЗАДАНИЙ ВЫПОЛНЕНО</small><b>{s.tasksTotal}</b><span>из них {s.tasksWeek} за неделю</span></div>
          <div className="sph-kpi is-orange"><small>ЛУЧШАЯ СЕРИЯ</small><b>{s.best} {dayWord(s.best)}</b><span>{s.streak >= s.best && s.best > 0 ? 'это твой рекорд сейчас' : `сейчас ${s.streak} — до рекорда ${s.best - s.streak}`}</span></div>
          <div className="sph-kpi is-violet"><small>МЕСТО СРЕДИ СФЕР</small><b>{s.place} из {s.placeOf}</b><span>по всему XP района</span></div>
        </div>
        <div className="sph-stats-row">
          <div className="sph-glass is-green">
            <div className="sph-panel-head"><b>XP по неделям</b><span className="sph-muted small">8 недель</span></div>
            <div className="sph-glass-chart" role="img" aria-label={`XP по неделям: ${s.weeks.map((w) => w.xp).join(', ')}`}>
              {s.weeks.map((w, i) => {
                const now = i === s.weeks.length - 1;
                return (
                  <div key={i} className={now ? 'now' : ''}>
                    <span className="sph-glass-bar" style={{ height: `${Math.max(w.xp ? 6 : 3, (w.xp / maxWeek) * 100)}%` }}>{now && w.xp ? <em>+{w.xp}</em> : null}</span>
                    <small>{now ? 'Эта' : shortDate(w.start)}</small>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="sph-glass is-blue">
            <b className="sph-glass-title">Активность по дням недели</b>
            <div className="sph-glass-days" role="img" aria-label={`XP по дням недели: ${weekdayNames.map((n, i) => `${n} ${s.weekdays[i]}`).join(', ')}`}>
              {weekdayNames.map((name, i) => <div key={name}><span className="sph-glass-tile">{s.weekdays[i] ? `+${s.weekdays[i]}` : '—'}</span><small>{name}</small></div>)}
            </div>
            <small className="sph-muted small">{strongDay ? `Сильнее всего — ${strongDay}.` : 'Выполни первое задание — здесь появится твой ритм.'}</small>
            <div className="sph-records">
              <b>Рекорды</b>
              <div><span>Лучший день</span><b>{s.bestDay ? `+${s.bestDay.xp} XP · ${s.bestDay.key.slice(8, 10)}.${s.bestDay.key.slice(5, 7)}` : '—'}</b></div>
              <div><span>Лучшая неделя</span><b>{s.bestWeek ? `+${s.bestWeek.xp} XP · с ${shortDate(s.bestWeek.start)}` : '—'}</b></div>
              <div><span>Завершено проектов</span><b>{s.projectsDone}</b></div>
            </div>
          </div>
        </div>
      </section>

      <section className="sph-panel sph-achievements" aria-label="Достижения района">
        <div className="sph-panel-head"><h2>Достижения района</h2><span className="sph-muted small">{gained} из {s.achievements.length} получено</span></div>
        <div className="sph-medals">
          {s.achievements.map((a) => (
            <div key={a.id} className={`sph-achievement${a.done ? ' done' : ''}`}>
              <Medal id={a.id} done={a.done} />
              <b>{a.title}</b>
              {a.done ? <small>{a.note}</small> : (
                <>
                  <span className="sph-achievement-bar" aria-hidden="true"><i style={{ width: `${Math.round(a.progress * 100)}%` }} /></span>
                  <small>{a.id === 'week' || a.id === 'two-weeks' ? `${s.best} / ${a.id === 'week' ? 7 : 14} дней` : a.note}</small>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

