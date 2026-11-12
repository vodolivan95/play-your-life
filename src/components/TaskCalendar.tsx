import { useState } from 'react';
import { dateKey } from '../game';
import type { Quest } from '../game';

function day(value?: string) {
  return value ? value.length === 10 ? value : dateKey(new Date(value)) : '';
}
const fields = [['startsAt', 'Начало'], ['dueAt', 'Окончание'], ['deadlineAt', 'Дедлайн']] as const;
export default function TaskCalendar({ task, disabled, onDate }: {
  task: Quest; disabled: boolean; onDate: (field: typeof fields[number][0], value: string) => void;
}) {
  const [month, setMonth] = useState(() => (day(task.startsAt || task.dueAt || task.deadlineAt) || dateKey()).slice(0, 7));
  const [field, setField] = useState<typeof fields[number][0]>('startsAt');
  const [year, m] = month.split('-').map(Number);
  const first = new Date(year, m - 1, 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const length = new Date(year, m, 0).getDate();
  function shift(delta: number) { setMonth(dateKey(new Date(year, m - 1 + delta, 1, 12)).slice(0, 7)); }
  return <section className="twin-calendar" aria-label="Календарь сроков">
    <div className="twin-calendar-head">
      <button type="button" aria-label="Предыдущий месяц" onClick={() => shift(-1)}>‹</button>
      <strong aria-live="polite">{first.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</strong>
      <button type="button" aria-label="Следующий месяц" onClick={() => shift(1)}>›</button>
    </div>
    <div className="twin-calendar-grid">
      {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => <small key={d}>{d}</small>)}
      {Array.from({ length: offset }, (_, i) => <span key={`blank-${i}`} />)}
      {Array.from({ length }, (_, i) => {
        const value = `${month}-${String(i + 1).padStart(2, '0')}`;
        const selected = fields.filter(([key]) => day(task[key]) === value);
        return <button type="button" key={value} disabled={disabled}
          data-start={day(task.startsAt) === value} data-end={day(task.dueAt) === value}
          data-deadline={day(task.deadlineAt) === value}
          aria-label={`${value}${selected.length ? ` · ${selected.map(([, label]) => label).join(', ')}` : ''}`}
          aria-pressed={selected.length > 0} onClick={() => {
            const original = task[field];
            const time = original?.includes('T') ? new Date(original).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
            onDate(field, value + (time ? `T${time}` : ''));
          }}>{i + 1}</button>;
      })}
    </div>
    <div className="twin-calendar-legend" aria-label="Какую дату выбрать">
      {fields.map(([key, label]) => <button type="button" key={key} disabled={disabled}
        data-deadline={key === 'deadlineAt'} aria-pressed={field === key} onClick={() => { setField(key); if (task[key]) setMonth(day(task[key]).slice(0, 7)); }}>{label}</button>)}
    </div>
    <small>Выбери тип даты, затем день.</small>
  </section>;
}
