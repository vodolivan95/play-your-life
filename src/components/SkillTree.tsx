import { useState } from 'react';
import type { CSSProperties, Dispatch, SetStateAction } from 'react';
import { spheres } from '../game';
import type { GameState } from '../game';
import icons from '../assets/sphere-icons.png';
import {
  MAX_BRANCHES,
  MAX_SKILL_COST,
  MAX_SKILL_LANE,
  MAX_SKILL_LEVELS,
  MAX_SKILL_TIER,
  addBranch,
  addTemplateBranch,
  lowerSkill,
  nodeLevel,
  nodeLock,
  nodeStatus,
  raiseSkill,
  removeBranch,
  removeNode,
  renameBranch,
  resetBranch,
  saveNode,
  skillGate,
  skillIconIds,
  skillPointsFree,
  skillPointsSpent,
  skillPointsTotal,
  skillTemplates,
  skillTreeOf,
  sphereLevelOf,
} from '../skillTree';
import type { SkillNode } from '../skillTree';
import { useMenuTheme } from '../menuTheme';
import './SkillTree.css';

// Same nine-icon sheet as SphereIcon, cropped to the round picture itself.
const crops: Record<string, [number, number]> = {
  health: [38, 2], sport: [410, 2], growth: [790, 2],
  english: [38, 315], finance: [410, 315], together: [790, 315],
  driving: [38, 636], tasks: [410, 636], hobby: [790, 636],
};
function SkillIcon({ id }: { id: string }) {
  const crop = crops[id];
  if (!crop) return null;
  const r = 122;
  return (
    <svg className="skt-icon" viewBox={`${crop[0] + 147 - r} ${crop[1] + 128 - r} ${r * 2} ${r * 2}`} aria-hidden="true">
      <image href={icons} width="1149" height="984" />
    </svg>
  );
}


type Selection =
  | { kind: 'node'; id: string }
  | { kind: 'new'; branchId: string; tier: number; lane: number }
  | null;

// Geometry of the free branch canvas: a fixed set of side slots per tier,
// so a branch can fork into several nodes on the same row and the connector
// lines between a node and whatever it requires can be drawn at any angle.
const LANES = Array.from({ length: MAX_SKILL_LANE * 2 + 1 }, (_, i) => i - MAX_SKILL_LANE);
const ROW_H = 150;
const LANE_W = 112;
const HEAD_H = 44;
const NODE_W = 104;
const NODE_H = 128;
const BRANCH_W = LANES.length * LANE_W;
const laneX = (lane: number) => BRANCH_W / 2 + lane * LANE_W;
const tierY = (rowIndex: number) => HEAD_H + rowIndex * ROW_H + ROW_H / 2;

function NodeEditor({
  state,
  sphere,
  node,
  branchId,
  tier,
  lane,
  onSave,
  onRemove,
}: {
  state: GameState;
  sphere: string;
  node?: SkillNode;
  branchId: string;
  tier: number;
  lane: number;
  onSave: (input: Parameters<typeof saveNode>[2]) => void;
  onRemove: () => void;
}) {
  const tree = skillTreeOf(state, sphere);
  const [name, setName] = useState(node?.name ?? '');
  const [icon, setIcon] = useState(node?.icon ?? sphere);
  const [branch, setBranch] = useState(node?.branchId ?? branchId);
  const [tierValue, setTier] = useState(node?.tier ?? tier);
  const [laneValue, setLane] = useState(node?.lane ?? lane);
  const [levels, setLevels] = useState(node?.levels ?? 5);
  const [cost, setCost] = useState(node?.cost ?? 1);
  const [requiresId, setRequiresId] = useState(node?.requiresId ?? '');
  const [requiresLevel, setRequiresLevel] = useState(node?.requiresLevel ?? 1);
  const [goalId, setGoalId] = useState(node?.goalId ?? '');
  const others = tree.nodes.filter((n) => n.id !== node?.id);
  const required = others.find((n) => n.id === requiresId);
  const goals = state.goals.filter((g) => g.sphere === sphere);
  const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
  return (
    <form
      className="skt-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          id: node?.id,
          branchId: branch,
          name,
          icon,
          tier: tierValue,
          lane: laneValue,
          levels,
          cost,
          requiresId: requiresId || undefined,
          requiresLevel: requiresId ? requiresLevel : undefined,
          goalId: goalId || undefined,
        });
      }}
    >
      <label>
        <span>Название</span>
        <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Например, Диалоги" />
      </label>
      <div className="skt-field">
        <span>Иконка</span>
        <div className="skt-icons" role="radiogroup" aria-label="Иконка навыка">
          {skillIconIds.map((id) => (
            <button
              type="button"
              key={id}
              role="radio"
              aria-checked={icon === id}
              aria-label={spheres.find((s) => s.id === id)?.name}
              className={icon === id ? 'selected' : ''}
              onClick={() => setIcon(id)}
            >
              <SkillIcon id={id} />
            </button>
          ))}
        </div>
      </div>
      <div className="skt-row">
        <label>
          <span>Ветка</span>
          <select value={branch} onChange={(e) => setBranch(e.target.value)}>
            {tree.branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Ярус</span>
          <select value={tierValue} onChange={(e) => setTier(Number(e.target.value))}>
            {range(MAX_SKILL_TIER).map((t) => (
              <option key={t} value={t}>{t} · с ур. {skillGate(t)}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="skt-row">
        <label>
          <span>Боковой слот</span>
          <select value={laneValue} onChange={(e) => setLane(Number(e.target.value))}>
            {LANES.map((l) => (
              <option key={l} value={l}>{l === 0 ? 'Центр (ствол)' : l > 0 ? `Вправо ${l}` : `Влево ${-l}`}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="skt-row">
        <label>
          <span>Уровней</span>
          <select value={levels} onChange={(e) => setLevels(Number(e.target.value))}>
            {range(MAX_SKILL_LEVELS).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Цена уровня</span>
          <select value={cost} disabled={!!goalId} onChange={(e) => setCost(Number(e.target.value))}>
            {range(MAX_SKILL_COST).map((n) => (
              <option key={n} value={n}>{n} {n === 1 ? 'очко' : 'очка'}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="skt-row">
        <label>
          <span>Открывается после</span>
          <select value={requiresId} onChange={(e) => { setRequiresId(e.target.value); setRequiresLevel(1); }}>
            <option value="">Без условия</option>
            {others.map((n) => (
              <option key={n.id} value={n.id}>{n.name}</option>
            ))}
          </select>
        </label>
        {required && (
          <label>
            <span>Уровень условия</span>
            <select value={requiresLevel} onChange={(e) => setRequiresLevel(Number(e.target.value))}>
              {range(required.levels).map((n) => (
                <option key={n} value={n}>{n}+</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label>
        <span>Связанная цель</span>
        <select value={goalId} onChange={(e) => setGoalId(e.target.value)}>
          <option value="">Без цели: уровни за очки</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </label>
      {goalId && (
        <p className="skt-note">Уровень растёт сам по прогрессу цели и не тратит очки навыков.</p>
      )}
      <div className="skt-actions">
        <button type="submit" className="skt-primary">{node ? 'Сохранить навык' : 'Добавить навык'}</button>
        {node && (
          <button type="button" className="skt-danger" onClick={onRemove}>Удалить</button>
        )}
      </div>
    </form>
  );
}

export default function SkillTree({
  state,
  onChange,
  notify,
  onOpenSphere,
}: {
  state: GameState;
  onChange: Dispatch<SetStateAction<GameState>>;
  notify: (message: string) => void;
  onOpenSphere?: (sphere: string) => void;
}) {
  const [theme, chooseTheme] = useMenuTheme();
  const [sphere, setSphere] = useState('english');
  const [mode, setMode] = useState<'play' | 'plan'>('play');
  const [selection, setSelection] = useState<Selection>(null);
  const [newBranch, setNewBranch] = useState('');
  const tree = skillTreeOf(state, sphere);
  const level = sphereLevelOf(state, sphere);
  const free = skillPointsFree(state, sphere);
  const planning = mode === 'plan';
  const meta = spheres.find((s) => s.id === sphere)!;
  const selected =
    selection?.kind === 'node'
      ? tree.nodes.find((n) => n.id === selection.id)
      : undefined;
  const maxTier = Math.max(4, ...tree.nodes.map((n) => n.tier));
  const tiers = Array.from(
    { length: planning ? Math.min(MAX_SKILL_TIER, maxTier + 1) : maxTier },
    (_, i) => i + 1,
  ).reverse();

  function run(action: (current: GameState) => GameState, done?: string) {
    try {
      onChange(action(state));
      if (done) notify(done);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Не удалось изменить дерево.');
      return false;
    }
  }
  function chooseSphere(id: string) {
    setSphere(id);
    setSelection(null);
  }

  const nodesAt = (branchId: string, tier: number) =>
    tree.nodes.filter((n) => n.branchId === branchId && n.tier === tier);

  function nodePos(node: SkillNode): CSSProperties {
    const rowIndex = tiers.indexOf(node.tier);
    return {
      position: 'absolute',
      left: laneX(node.lane ?? 0) - NODE_W / 2,
      top: tierY(rowIndex) - NODE_H / 2,
      width: NODE_W,
    };
  }

  function renderNode(node: SkillNode) {
    const status = nodeStatus(state, sphere, node);
    const current = nodeLevel(state, node);
    const isSelected = selection?.kind === 'node' && selection.id === node.id;
    return (
      <button
        type="button"
        key={node.id}
        className={`skt-node is-${status}${isSelected ? ' is-selected' : ''}`}
        style={nodePos(node)}
        onClick={() => setSelection({ kind: 'node', id: node.id })}
        aria-label={`${node.name}, уровень ${current} из ${node.levels}`}
      >
        <span className="skt-diamond">
          <span className="skt-diamond-icon">
            {status === 'locked' ? <span className="skt-lock">🔒</span> : null}
            <SkillIcon id={node.icon} />
          </span>
        </span>
        <span className="skt-pips" aria-hidden="true">
          {Array.from({ length: node.levels }, (_, i) => (
            <i key={i} className={i < current ? 'on' : ''} />
          ))}
        </span>
        <strong>{node.name}</strong>
        <small>{current} / {node.levels}{node.goalId ? ' · цель' : ''}</small>
      </button>
    );
  }

  /** Connector lines for one branch's canvas: any node whose "requires" points
   * at another node of the same branch gets a line between them, at whatever
   * angle and distance that takes — this is what lets a branch fork sideways
   * and still show the link clearly. */
  function renderEdges(branchId: string) {
    return tree.nodes
      .filter((n) => n.branchId === branchId && n.requiresId)
      .map((node) => {
        const req = tree.nodes.find((n) => n.id === node.requiresId);
        if (!req || req.branchId !== branchId) return null;
        const rowA = tiers.indexOf(req.tier);
        const rowB = tiers.indexOf(node.tier);
        if (rowA < 0 || rowB < 0) return null;
        const x1 = laneX(req.lane ?? 0);
        const y1 = tierY(rowA);
        const x2 = laneX(node.lane ?? 0);
        const y2 = tierY(rowB);
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const lit = nodeLevel(state, req) >= (node.requiresLevel ?? 1);
        return (
          <span
            key={`${node.id}:edge`}
            aria-hidden="true"
            className={`skt-edge${lit ? ' lit' : ''}`}
            style={{
              left: x1,
              top: y1,
              width: len,
              transform: `rotate(${angle}deg)`,
            }}
          />
        );
      });
  }

  const lock = selected ? nodeLock(state, sphere, selected) : undefined;
  const selectedLevel = selected ? nodeLevel(state, selected) : 0;
  const required = selected?.requiresId
    ? tree.nodes.find((n) => n.id === selected.requiresId)
    : undefined;
  const linkedGoal = selected?.goalId
    ? state.goals.find((g) => g.id === selected.goalId)
    : undefined;

  return (
    <section className="skt" data-theme={theme}>
      <header className="skt-head">
        <div>
          <h2>Дерево навыков</h2>
          <p>Планируй развитие каждой сферы: свои ветки, навыки и порядок их открытия.</p>
        </div>
        <div className="skt-theme" role="group" aria-label="Тема дерева навыков">
          <button type="button" className={theme === 'light' ? 'selected' : ''} onClick={() => chooseTheme('light')}>Светлая</button>
          <button type="button" className={theme === 'dark' ? 'selected' : ''} onClick={() => chooseTheme('dark')}>Тёмная</button>
        </div>
      </header>

      <div className="skt-spheres" role="tablist" aria-label="Сферы">
        {spheres.map((s) => (
          <button
            type="button"
            role="tab"
            aria-selected={s.id === sphere}
            key={s.id}
            className={s.id === sphere ? 'selected' : ''}
            style={{ '--skt-color': s.color } as CSSProperties}
            onClick={() => chooseSphere(s.id)}
          >
            <span className="skt-sphere-icon"><SkillIcon id={s.id} /></span>
            <strong>{s.name}</strong>
            <small>Ур. {sphereLevelOf(state, s.id)}</small>
          </button>
        ))}
      </div>

      <div className="skt-layout">
        <div className="skt-board">
          <div className="skt-board-head">
            <div className="skt-title">
              <span className="skt-sphere-icon"><SkillIcon id={sphere} /></span>
              <div>
                <h3>{meta.name}</h3>
                <small>
                  Уровень {level} · очков {free} из {skillPointsTotal(state, sphere)} свободно · вложено {skillPointsSpent(state, sphere)}
                </small>
              </div>
            </div>
            <div className="skt-board-tools">
              {onOpenSphere && (
                <button type="button" className="skt-link-btn" onClick={() => onOpenSphere(sphere)}>
                  Страница сферы →
                </button>
              )}
            <div className="skt-mode" role="group" aria-label="Режим">
              <button type="button" className={!planning ? 'selected' : ''} onClick={() => { setMode('play'); setSelection(null); }}>Прокачка</button>
              <button type="button" className={planning ? 'selected' : ''} onClick={() => { setMode('plan'); setSelection(null); }}>Планирование</button>
            </div>
            </div>
          </div>

          {tree.branches.length === 0 && (
            <div className="skt-empty">
              <strong>Дерево этой сферы пока пустое</strong>
              <p>
                {planning
                  ? 'Выбери готовую ветку или создай свою ниже.'
                  : 'Открой «Планирование» и построй своё дерево: ветки, навыки и условия.'}
              </p>
            </div>
          )}

          {tree.branches.length > 0 && (
            <div className="skt-scroll">
              <div className="skt-grid" style={{ '--skt-cols': tree.branches.length } as CSSProperties}>
                <div className="skt-tier-col">
                  <span className="skt-corner" />
                  {tiers.map((t) => (
                    <div className="skt-tier" key={t}>
                      <b>Ярус {t}</b>
                      <small className={level >= skillGate(t) ? 'open' : ''}>
                        {skillGate(t) === 0 ? 'с начала' : `с ур. ${skillGate(t)}`}
                      </small>
                    </div>
                  ))}
                </div>
                {tree.branches.map((branch) => (
                  <div className="skt-branch" key={branch.id}>
                    <div className="skt-branch-head">
                      {planning ? (
                        <input
                          key={`${branch.id}:${branch.name}`}
                          defaultValue={branch.name}
                          maxLength={40}
                          aria-label="Название ветки"
                          onBlur={(e) => {
                            const value = e.target.value;
                            if (value.trim() === branch.name) return;
                            if (!run((s) => renameBranch(s, sphere, branch.id, value)))
                              e.target.value = branch.name;
                          }}
                        />
                      ) : (
                        <strong>{branch.name}</strong>
                      )}
                    </div>
                    <div
                      className="skt-canvas"
                      style={{ width: BRANCH_W, height: tiers.length * ROW_H }}
                    >
                      {renderEdges(branch.id)}
                      {tiers.map((t) => {
                        const here = nodesAt(branch.id, t);
                        if (!planning) return here.map(renderNode);
                        const used = new Set(here.map((n) => n.lane ?? 0));
                        // An empty tier only offers the trunk slot; once something
                        // is already there, the lanes beside it open up too, so
                        // "add a branch to the side" shows up right where it applies.
                        const openLanes = (
                          here.length === 0 ? [0] : LANES
                        ).filter((l) => !used.has(l));
                        const rowIndex = tiers.indexOf(t);
                        return [
                          ...here.map(renderNode),
                          ...openLanes.map((l) => (
                            <button
                              type="button"
                              key={`add-${branch.id}-${t}-${l}`}
                              className={`skt-add${selection?.kind === 'new' && selection.branchId === branch.id && selection.tier === t && selection.lane === l ? ' is-selected' : ''}`}
                              style={{
                                position: 'absolute',
                                left: laneX(l) - NODE_W / 2,
                                top: tierY(rowIndex) - NODE_H / 2,
                                width: NODE_W,
                              }}
                              onClick={() => setSelection({ kind: 'new', branchId: branch.id, tier: t, lane: l })}
                            >
                              <span className="skt-diamond"><b>+</b></span>
                              <small>{l === 0 ? 'Добавить навык' : 'Ветка в сторону'}</small>
                            </button>
                          )),
                        ];
                      })}
                    </div>
                    {planning && (
                      <div className="skt-branch-foot">
                        <button type="button" onClick={() => run((s) => resetBranch(s, sphere, branch.id), 'Очки ветки возвращены.')}>Сбросить очки</button>
                        <button
                          type="button"
                          className="skt-danger"
                          onClick={() => {
                            if (selected?.branchId === branch.id) setSelection(null);
                            run((s) => removeBranch(s, sphere, branch.id), 'Ветка удалена.');
                          }}
                        >
                          Удалить ветку
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {planning && tree.branches.length < MAX_BRANCHES && (
            <div className="skt-new-branch">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (run((s) => addBranch(s, sphere, newBranch), 'Ветка добавлена.'))
                    setNewBranch('');
                }}
              >
                <input
                  value={newBranch}
                  maxLength={40}
                  onChange={(e) => setNewBranch(e.target.value)}
                  placeholder="Название новой ветки"
                  aria-label="Название новой ветки"
                />
                <button type="submit" className="skt-primary">Новая ветка</button>
              </form>
              <div className="skt-templates">
                <span>Готовые ветки:</span>
                {skillTemplates.map((t) => (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() => run((s) => addTemplateBranch(s, sphere, t.id), `Ветка «${t.name}» добавлена.`)}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="skt-panel" aria-live="polite">
          {planning && selection?.kind === 'new' && (
            <>
              <h3>Новый навык</h3>
              <NodeEditor
                key={`new-${selection.branchId}-${selection.tier}-${selection.lane}`}
                state={state}
                sphere={sphere}
                branchId={selection.branchId}
                tier={selection.tier}
                lane={selection.lane}
                onSave={(input) => {
                  if (run((s) => saveNode(s, sphere, input), 'Навык добавлен.'))
                    setSelection(null);
                }}
                onRemove={() => setSelection(null)}
              />
            </>
          )}
          {planning && selected && (
            <>
              <h3>Редактирование навыка</h3>
              <NodeEditor
                key={selected.id}
                state={state}
                sphere={sphere}
                node={selected}
                branchId={selected.branchId}
                tier={selected.tier}
                lane={selected.lane ?? 0}
                onSave={(input) => run((s) => saveNode(s, sphere, input), 'Навык сохранён.')}
                onRemove={() => {
                  run((s) => removeNode(s, sphere, selected.id), 'Навык удалён.');
                  setSelection(null);
                }}
              />
            </>
          )}
          {!planning && selected && (
            <>
              <div className="skt-detail-head">
                <span className="skt-diamond big"><span className="skt-diamond-icon"><SkillIcon id={selected.icon} /></span></span>
                <div>
                  <small>{tree.branches.find((b) => b.id === selected.branchId)?.name} · ярус {selected.tier}</small>
                  <h3>{selected.name}</h3>
                </div>
              </div>
              <div className="skt-stepper">
                <button
                  type="button"
                  aria-label="Забрать очко"
                  disabled={!!selected.goalId || selected.level <= 0}
                  onClick={() => run((s) => lowerSkill(s, sphere, selected.id))}
                >−</button>
                <div>
                  <b>{selectedLevel}<span> / {selected.levels}</span></b>
                  <small>уровень навыка</small>
                </div>
                <button
                  type="button"
                  className="plus"
                  aria-label="Вложить очко"
                  disabled={!!selected.goalId || !!lock || selected.level >= selected.levels || free < selected.cost}
                  onClick={() => run((s) => raiseSkill(s, sphere, selected.id))}
                >+</button>
              </div>
              <ul className="skt-facts">
                <li><span>Цена уровня</span><b>{selected.goalId ? 'бесплатно' : `${selected.cost} ${selected.cost === 1 ? 'очко' : 'очка'}`}</b></li>
                <li><span>Свободно очков</span><b>{free}</b></li>
                <li><span>Ярус {selected.tier}</span><b className={level >= skillGate(selected.tier) ? 'ok' : 'bad'}>{level >= skillGate(selected.tier) ? 'открыт' : `нужен ур. ${skillGate(selected.tier)}`}</b></li>
                {required && (
                  <li><span>{required.name} {selected.requiresLevel ?? 1}+</span><b className={nodeLevel(state, required) >= (selected.requiresLevel ?? 1) ? 'ok' : 'bad'}>{nodeLevel(state, required) >= (selected.requiresLevel ?? 1) ? 'выполнено' : 'не выполнено'}</b></li>
                )}
                {linkedGoal && (
                  <li><span>Цель</span><b>{linkedGoal.name}</b></li>
                )}
              </ul>
              {selected.goalId && (
                <p className="skt-note">Навык растёт вместе с целью: чем больше выполнено, тем выше уровень.</p>
              )}
              {lock && <p className="skt-note warn">{lock}.</p>}
            </>
          )}
          {!selection && (
            <div className="skt-hint">
              <strong>{planning ? 'Режим планирования' : 'Выбери навык'}</strong>
              <p>
                {planning
                  ? 'Нажми на «+» в ветке, чтобы добавить навык, или на готовый навык, чтобы изменить его, привязать цель и задать условия.'
                  : 'Нажми на навык, чтобы вложить очки или забрать их обратно. Очки дают за уровни сферы: 2 за каждый.'}
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
