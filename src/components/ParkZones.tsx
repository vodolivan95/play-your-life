import { useEffect, useRef } from 'react';
import './ParkZones.css';

export type ParkZone = {
  id: 'walk' | 'rest' | 'fountain';
  label: string;
  description: string;
  tip: string;
  x: number;
  y: number;
};

type ParkMarkersProps = {
  zones: readonly ParkZone[];
  selected: string | null;
  onSelect: (id: string) => void;
  disabled?: boolean;
  walkPath?: readonly { x: number; y: number }[];
};

type ParkPanelProps = { zone: ParkZone | null; onClose: () => void };

function ParkIcon({ id }: Pick<ParkZone, 'id'>) {
  if (id === 'walk') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4c1.7 0 2.7 1.9 1.8 3.2L8.4 9.3c-.7 1.2-2.5.9-2.7-.5L5.4 6c-.2-1.1.8-2 2-2Zm7 8c1.7 0 2.7 1.9 1.8 3.2l-1.4 2.1c-.7 1.2-2.5.9-2.7-.5l-.3-2.8c-.2-1.1.8-2 2-2Z" /></svg>;
  if (id === 'rest') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11h14v3H5zM7 7h10v3H7zM7 14v4m10-4v4M4 18h16" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4c2 2.1 2 4.2 0 6.2C10 8.2 10 6.1 12 4Zm0 6.2c3.2-1.7 5.1-.5 5.6 2.5-2.5.8-4.4.1-5.6-2.5Zm0 0c-3.2-1.7-5.1-.5-5.6 2.5 2.5.8 4.4.1 5.6-2.5ZM5 18c2-2.1 12-2.1 14 0" /></svg>;
}

export function ParkMarkers({ zones, selected, onSelect, disabled = false, walkPath }: ParkMarkersProps) {
  if (disabled) return null;
  const points = (walkPath ?? []).map(({ x, y }) => `${x * 1000},${y * 1000}`).join(' ');

  return <>
    {selected === 'walk' && <svg className="park-walk-path" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} /></svg>}
    {zones.map((zone) => {
      const tooltipId = `park-zone-tooltip-${zone.id}`;
      const style = { left: `${zone.x}%`, top: `${zone.y}%` };
      return <span key={zone.id}>
        <button type="button" className="park-marker" data-park-zone={zone.id} data-selected={selected === zone.id} aria-label={`Парк: ${zone.label}`} aria-pressed={selected === zone.id} aria-controls="park-zone-panel" aria-describedby={tooltipId} style={style} onClick={() => onSelect(zone.id)}><ParkIcon id={zone.id} /></button>
        <span className="park-tooltip" id={tooltipId} role="tooltip" style={style}><strong>{zone.label}</strong><span>{zone.tip}</span></span>
      </span>;
    })}
  </>;
}

export function ParkPanel({ zone, onClose }: ParkPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const zoneId = zone?.id;
  useEffect(() => {
    if (!zoneId) return;
    const origin = document.querySelector<HTMLElement>(`[data-park-zone="${zoneId}"]`);
    const close = closeRef.current;
    close?.focus({ preventScroll: true });
    return () => {
      if (document.activeElement === close || document.activeElement === document.body) origin?.focus({ preventScroll: true });
    };
  }, [zoneId]);

  if (!zone) return null;
  return <aside className="park-panel" id="park-zone-panel" role="region" aria-label={`Парк: ${zone.label}`} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
  }}>
    <div className="park-panel__copy"><h3>{zone.label}</h3><p>{zone.description}</p><p className="park-panel__tip">Совет: {zone.tip}</p></div>
    <button ref={closeRef} type="button" className="park-panel__close" onClick={onClose}>Закрыть подсказку парка</button>
  </aside>;
}
