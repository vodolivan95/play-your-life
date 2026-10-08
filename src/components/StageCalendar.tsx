import { useState } from "react";
import type { GoalStage, Quest } from "../game";
import { calendarDay, monthCells, timeline } from "../goalSystem";
export default function StageCalendar({
  stage,
  tasks,
  onTask,
  onCreate,
}: {
  stage: GoalStage;
  tasks: Quest[];
  onTask: (id: string) => void;
  onCreate: (day: string) => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear()),
    [month, setMonth] = useState(now.getMonth()),
    [selected, setSelected] = useState<string>();
  const t = timeline(stage);
  function shift(amount: number) {
    const date = new Date(year, month + amount, 1);
    setYear(date.getFullYear());
    setMonth(date.getMonth());
  }
  return (
    <section className="panel stage-calendar">
      <h3>Календарь этапа</h3>
      <div className="calendar-controls">
        <button aria-label="Предыдущий месяц" onClick={() => shift(-1)}>
          ‹
        </button>
        <select
          aria-label="Месяц календаря"
          value={month}
          onChange={(e) => setMonth(Number(e.target.value))}
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option value={i} key={i}>
              {new Date(2026, i, 1).toLocaleDateString("ru-RU", {
                month: "long",
              })}
            </option>
          ))}
        </select>
        <input
          aria-label="Год календаря"
          type="number"
          min="1900"
          max="2200"
          value={year}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (n >= 1900 && n <= 2200) setYear(n);
          }}
        />
        <button aria-label="Следующий месяц" onClick={() => shift(1)}>
          ›
        </button>
      </div>
      <div className="calendar-grid">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
          <small key={d}>{d}</small>
        ))}
        {monthCells(year, month).map((day, i) =>
          day ? (
            <button
              key={day}
              aria-label={day}
              aria-pressed={selected === day}
              data-start={day === t.start}
              data-end={day === t.end}
              data-today={day === t.today}
              data-period={
                !!t.start && day >= t.start && (!t.end || day <= t.end)
              }
              data-overdue={
                !!t.end &&
                day > t.end &&
                day <= t.today &&
                stage.status !== "completed"
              }
              onClick={() => setSelected(day)}
            >
              {Number(day.slice(-2))}
              {tasks.some((q) => q.dueAt && calendarDay(q.dueAt) === day) && (
                <span className="calendar-task-dot" />
              )}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
      <small>Начало · период · сегодня · окончание · просрочка</small>
      {selected && (
        <div className="calendar-day-tasks">
          <h4>{selected}</h4>
          {tasks
            .filter((q) => q.dueAt && calendarDay(q.dueAt) === selected)
            .map((q) => (
              <button key={q.id} onClick={() => onTask(q.id)}>
                {q.done ? "✓ " : ""}
                {q.name}
              </button>
            ))}
          <button className="text-button" onClick={() => onCreate(selected)}>
            + Задача на эту дату
          </button>
        </div>
      )}
    </section>
  );
}
