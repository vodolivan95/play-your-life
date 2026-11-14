import { useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { Quest } from '../game';
import './TaskReorderList.css';

type Placement = 'before' | 'after' | 'end';
type Drag = { id: string; pointerId: number; startX: number; startY: number; moved: boolean; captured: boolean };
type Props = {
  tasks: Quest[];
  label: string;
  onReorder: (sourceId: string, targetId: string, placement: Placement) => void;
  renderTask: (task: Quest) => ReactNode;
  className?: string;
  itemClassName?: (task: Quest) => string;
  enabled?: boolean;
};

/** Mouse can start anywhere on a row; touch starts at the grip to preserve page scrolling. */
export default function TaskReorderList({ tasks, label, onReorder, renderTask, className = '', itemClassName, enabled = true }: Props) {
  const [draggedId, setDraggedId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [targetPlacement, setTargetPlacement] = useState<Placement>('before');
  const [announcement, setAnnouncement] = useState('');
  const drag = useRef<Drag | null>(null);
  const suppressClick = useRef(false);

  function elementAtPoint(x: number, y: number) {
    const dragging = document.querySelector<HTMLElement>('.task-reorder-item.is-dragging');
    const oldPointerEvents = dragging?.style.pointerEvents;
    if (dragging) dragging.style.pointerEvents = 'none';
    const element = document.elementFromPoint(x, y);
    if (dragging) dragging.style.pointerEvents = oldPointerEvents ?? '';
    return element;
  }

  function pointerDown(event: ReactPointerEvent<HTMLLIElement>, id: string) {
    if (!enabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const touch = event.pointerType !== 'mouse';
    if (touch && !(event.target as HTMLElement).closest('.task-reorder-grip')) return;
    suppressClick.current = false;
    drag.current = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, captured: touch };
    setDraggedId(id);
    setTargetId('');
    if (touch) event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: ReactPointerEvent<HTMLUListElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.moved && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 8) return;
    current.moved = true;
    event.preventDefault();
    if (!current.captured && event.pointerType === 'mouse') {
      event.currentTarget.setPointerCapture(event.pointerId);
      current.captured = true;
    }
    const edge = 76;
    if (event.clientY < edge) window.scrollBy({ top: -8, behavior: 'auto' });
    else if (event.clientY > window.innerHeight - edge) window.scrollBy({ top: 8, behavior: 'auto' });

    const element = elementAtPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-task-order-id]');
    const candidateId = element?.dataset.taskOrderId ?? '';
    const rect = element?.getBoundingClientRect();
    const listRect = event.currentTarget.getBoundingClientRect();
    const placement: Placement = rect
      ? event.clientY >= rect.top + rect.height / 2 ? 'after' : 'before'
      : event.clientY > listRect.bottom - 36 ? 'end' : 'before';
    setTargetId(candidateId === current.id ? '' : candidateId);
    setTargetPlacement(placement);
  }

  function pointerUp(event: ReactPointerEvent<HTMLUListElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const point = elementAtPoint(event.clientX, event.clientY);
    const element = point?.closest<HTMLElement>('[data-task-order-id]');
    const target = element?.dataset.taskOrderId ?? '';
    const rect = element?.getBoundingClientRect();
    const listRect = event.currentTarget.getBoundingClientRect();
    const lastRect = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-task-order-id]')).at(-1)?.getBoundingClientRect();
    const overEnd = !!point?.closest('.task-reorder-end');
    const atEnd = overEnd
      || (!target && !!lastRect && event.clientY >= lastRect.bottom - 10 && event.clientY <= listRect.bottom + 10)
      || (!!rect && event.clientY >= rect.top + rect.height / 2 && tasks.at(-1)?.id === target);
    if (current.moved && (atEnd || (target && target !== current.id))) {
      onReorder(current.id, target, atEnd ? 'end' : targetPlacement);
      const task = tasks.find((item) => item.id === current.id);
      setAnnouncement(task ? `${task.name}: ${atEnd ? 'перемещена в конец списка' : 'порядок изменён'}` : 'Порядок задач изменён');
    }
    if (current.moved) {
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 0);
    }
    drag.current = null;
    setDraggedId('');
    setTargetId('');
  }

  function pointerCancel(event: ReactPointerEvent<HTMLUListElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    setDraggedId('');
    setTargetId('');
    suppressClick.current = false;
  }

  function keyDown(event: ReactKeyboardEvent<HTMLButtonElement>, id: string) {
    const index = tasks.findIndex((task) => task.id === id);
    if (index < 0) return;
    if (event.key === 'Home') {
      event.preventDefault();
      if (index > 0) onReorder(id, tasks[0].id, 'before');
      else return;
    } else if (event.key === 'End') {
      event.preventDefault();
      if (index < tasks.length - 1) onReorder(id, '', 'end');
      else return;
    } else if (event.key === 'ArrowUp' && index > 0) {
      event.preventDefault();
      onReorder(id, tasks[index - 1].id, 'before');
    } else if (event.key === 'ArrowDown' && index < tasks.length - 1) {
      event.preventDefault();
      onReorder(id, tasks[index + 1].id, 'after');
    } else return;
    setAnnouncement(`${tasks[index].name}: порядок изменён`);
  }

  return (
    <ul
      className={`task-reorder-list ${className}`}
      aria-label={label}
      onPointerMove={enabled ? pointerMove : undefined}
      onPointerUp={enabled ? pointerUp : undefined}
      onPointerCancel={enabled ? pointerCancel : undefined}
      onClickCapture={(event) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {tasks.map((task) => {
        const dragging = draggedId === task.id;
        const dropTarget = targetId === task.id && !dragging;
        return (
          <li
            key={task.id}
            data-task-order-id={task.id}
            className={`task-reorder-item ${enabled ? 'is-draggable' : ''} ${itemClassName?.(task) ?? ''}${dragging ? ' is-dragging' : ''}${dropTarget ? ` is-drop-target drop-${targetPlacement}` : ''}`}
            onPointerDown={enabled ? (event) => pointerDown(event, task.id) : undefined}
          >
            {enabled && <button type="button" className="task-reorder-grip" aria-label={`Переместить задачу: ${task.name}. Стрелки меняют место, Home — в начало, End — в конец`} title="Перетащите мышью или пальцем; клавиши Home/End — начало/конец" onKeyDown={(event) => keyDown(event, task.id)}>⋮⋮</button>}
            <div className="task-reorder-content">{renderTask(task)}</div>
          </li>
        );
      })}
      {enabled && !!draggedId && <li className="task-reorder-end" aria-hidden="true"><span>＋</span> В конец списка</li>}
      <li className="task-reorder-sr" aria-live="polite" aria-atomic="true">{announcement}</li>
    </ul>
  );
}
