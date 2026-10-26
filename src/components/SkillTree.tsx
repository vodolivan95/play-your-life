import { useState } from 'react';
import type { CSSProperties } from 'react';
import { spheres } from '../game';
import type { GameState } from '../game';
import icons from '../assets/sphere-icons.png';
import GameArt from './GameArt';
import { nodeLevel, nodeStatus, practiceLevelInfo, skillTreeOf, sphereLevelOf } from '../skillTree';
import type { SkillNode } from '../skillTree';
import { useMenuTheme } from '../menuTheme';
import './SkillTree.css';

const crops: Record<string, [number, number]> = {
  health: [38, 2], sport: [410, 2], growth: [790, 2],
  english: [38, 315], finance: [410, 315], together: [790, 315],
  driving: [38, 636], tasks: [410, 636], hobby: [790, 636],
};
function SkillIcon({ id }: { id: string }) {
  const crop = crops[id];
  if (!crop) return <span className="skt-icon skt-icon-vector"><GameArt kind={id} /></span>;
  const r = 122;
  return <svg className="skt-icon" viewBox={`${crop[0] + 147 - r} ${crop[1] + 128 - r} ${r * 2} ${r * 2}`} aria-hidden="true"><image href={icons} width="1149" height="984" /></svg>;
}
const LANES = [-2, -1, 0, 1, 2];
const ROW_H = 150;
const LANE_W = 112;
const HEAD_H = 44;
const NODE_W = 104;
const NODE_H = 128;
const BRANCH_W = LANES.length * LANE_W;
const laneX = (lane: number) => BRANCH_W / 2 + lane * LANE_W;
const tierY = (rowIndex: number) => HEAD_H + rowIndex * ROW_H + ROW_H / 2;

export default function SkillTree({
  state,
  onOpenSphere,
}: {
  state: GameState;
  onOpenSphere?: (sphere: string) => void;
}) {
  const [theme, chooseTheme] = useMenuTheme();
  const [sphere, setSphere] = useState('english');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const tree = skillTreeOf(state, sphere);
  const meta = spheres.find((item) => item.id === sphere)!;
  const level = sphereLevelOf(state, sphere);
  const maxTier = Math.max(4, ...tree.nodes.map((node) => node.tier));
  const tiers = Array.from({ length: maxTier }, (_, index) => maxTier - index);
  const selected = tree.nodes.find((node) => node.id === selectedId);
  const selectedLevel = selected ? nodeLevel(state, selected) : 0;
  const selectedCount = selected
    ? (state.practiceSessions ?? []).filter((session) => session.skillNodeId === selected.id && !!session.completedAt).length
    : 0;
  const practiceInfo = selected?.sourceGoalId
    ? practiceLevelInfo(selectedCount, selected.levels)
    : undefined;
  const completedRepeats = (state.practiceSessions ?? []).filter((session) => session.sphere === sphere && !!session.completedAt).length;

  function chooseSphere(id: string) {
    setSphere(id);
    setSelectedId(null);
  }
  function nodePos(node: SkillNode): CSSProperties {
    const row = tiers.indexOf(node.tier);
    return { position: 'absolute', left: laneX(node.lane ?? 0) - NODE_W / 2, top: tierY(row) - NODE_H / 2, width: NODE_W };
  }
  function renderNode(node: SkillNode) {
    const status = nodeStatus(state, sphere, node);
    const current = nodeLevel(state, node);
    return (
      <button
        type="button"
        key={node.id}
        className={`skt-node is-${status}${selectedId === node.id ? ' is-selected' : ''}`}
        style={nodePos(node)}
        onClick={() => setSelectedId(node.id)}
        aria-label={`${node.name}, уровень ${current} из ${node.levels}`}
      >
        <span className="skt-diamond"><span className="skt-diamond-icon"><SkillIcon id={node.icon} /></span></span>
        <span className="skt-pips" aria-hidden="true">{Array.from({ length: node.levels }, (_, index) => <i key={index} className={index < current ? 'on' : ''} />)}</span>
        <strong>{node.name}</strong>
        <small>{current} / {node.levels}</small>
      </button>
    );
  }
  function renderEdges(branchId: string) {
    return tree.nodes.filter((node) => node.branchId === branchId && node.requiresId).map((node) => {
      const parent = tree.nodes.find((item) => item.id === node.requiresId);
      if (!parent || parent.branchId !== branchId) return null;
      const rowA = tiers.indexOf(parent.tier), rowB = tiers.indexOf(node.tier);
      if (rowA < 0 || rowB < 0) return null;
      const x1 = laneX(parent.lane ?? 0), y1 = tierY(rowA), x2 = laneX(node.lane ?? 0), y2 = tierY(rowB);
      const length = Math.hypot(x2 - x1, y2 - y1), angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
      const lit = nodeLevel(state, parent) >= (node.requiresLevel ?? 1);
      return <span key={`${node.id}:edge`} aria-hidden="true" className={`skt-edge${lit ? ' lit' : ''}`} style={{ left: x1, top: y1, width: length, transform: `rotate(${angle}deg)` }} />;
    });
  }

  return (
    <section className="skt" data-theme={theme}>
      <header className="skt-head">
        <div>
          <h2>Дерево навыков</h2>
          <p>Навыки появляются после завершения проектов и растут от повторной практики.</p>
        </div>
        <div className="skt-theme" role="group" aria-label="Тема дерева навыков">
          <button type="button" className={theme === 'light' ? 'selected' : ''} onClick={() => chooseTheme('light')}>Светлая</button>
          <button type="button" className={theme === 'dark' ? 'selected' : ''} onClick={() => chooseTheme('dark')}>Тёмная</button>
        </div>
      </header>
      <div className="skt-spheres" role="tablist" aria-label="Сферы">
        {spheres.map((item) => (
          <button type="button" role="tab" aria-selected={item.id === sphere} key={item.id} className={item.id === sphere ? 'selected' : ''} style={{ '--skt-color': item.color } as CSSProperties} onClick={() => chooseSphere(item.id)}>
            <span className="skt-sphere-icon"><SkillIcon id={item.id} /></span><strong>{item.name}</strong><small>Ур. {sphereLevelOf(state, item.id)}</small>
          </button>
        ))}
      </div>
      <div className="skt-layout">
        <div className="skt-board">
          <div className="skt-board-head">
            <div className="skt-title">
              <span className="skt-sphere-icon"><SkillIcon id={sphere} /></span>
              <div><h3>{meta.name}</h3><small>Уровень сферы {level} · {tree.nodes.length} навыков · {completedRepeats} повторов</small></div>
            </div>
            {onOpenSphere && <button type="button" className="skt-link-btn" onClick={() => onOpenSphere(sphere)}>Страница сферы →</button>}
          </div>
          {tree.branches.length === 0 ? (
            <div className="skt-empty">
              <strong>Здесь появятся приобретённые навыки</strong>
              <p>Заверши проект в этой сфере и назови навык, который получил. Новый путь начнётся снизу и будет расти вверх.</p>
            </div>
          ) : (
            <div className="skt-scroll">
              <div className="skt-grid" style={{ '--skt-cols': tree.branches.length } as CSSProperties}>
                <div className="skt-tier-col"><span className="skt-corner" />{tiers.map((tier) => <div className="skt-tier" key={tier}><b>Ярус {tier}</b><small>практика</small></div>)}</div>
                {tree.branches.map((branch) => (
                  <div className="skt-branch" key={branch.id}>
                    <div className="skt-branch-head"><strong>{branch.name}</strong></div>
                    <div className="skt-canvas" style={{ width: BRANCH_W, height: tiers.length * ROW_H }}>
                      {renderEdges(branch.id)}
                      {tree.nodes.filter((node) => node.branchId === branch.id).map(renderNode)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <aside className="skt-panel" aria-live="polite">
          {selected ? (
            <>
              <div className="skt-detail-head"><span className="skt-diamond big"><span className="skt-diamond-icon"><SkillIcon id={selected.icon} /></span></span><div><small>{tree.branches.find((branch) => branch.id === selected.branchId)?.name} · ярус {selected.tier}</small><h3>{selected.name}</h3></div></div>
              <div className="skt-stepper"><div><b>{selectedLevel}<span> / {selected.levels}</span></b><small>уровень навыка</small></div></div>
              {selected.sourceGoalId && (
                <ul className="skt-facts">
                  <li><span>Приобретён в проекте</span><b>{state.goals.find((goal) => goal.id === selected.sourceGoalId)?.name ?? 'Проект завершён'}</b></li>
                  <li><span>Завершено повторов</span><b>{selectedCount}</b></li>
                  <li><span>Прогресс уровня</span><b>{practiceInfo?.max ? 'максимум' : `${practiceInfo?.practiced ?? 0} / ${practiceInfo?.required ?? 3} повтора`}</b></li>
                </ul>
              )}
              {selected.requiresId && <p className="skt-progression-note">Этот навык продолжает путь от «{tree.nodes.find((node) => node.id === selected.requiresId)?.name ?? 'предыдущего навыка'}».</p>}
              <p className="skt-progression-note">Уровень повышается автоматически после завершения практики по задачам исходного проекта.</p>
            </>
          ) : (
            <div className="skt-hint"><strong>Выбери навык</strong><p>Здесь видны навыки из завершённых проектов. Нажми на узел, чтобы увидеть источник и прогресс повторной практики.</p></div>
          )}
        </aside>
      </div>
    </section>
  );
}
