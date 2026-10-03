import type { GameState } from "../types";
import { dayKey, streak } from "../utils/date";
import { Section, Progress } from "../components/ui";
export function Stats({ state }: { state: GameState }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    const key = dayKey(d);
    return {
      label: d.toLocaleDateString("ru-RU", { weekday: "short" }),
      xp: state.events
        .filter((e) => dayKey(new Date(e.date)) === key)
        .reduce((sum, e) => sum + e.xp, 0),
    };
  });
  const max = Math.max(50, ...days.map((d) => d.xp));
  return (
    <>
      <p className="eyebrow">ТВОЙ ПУТЬ В ЦИФРАХ</p>
      <h1>Статистика</h1>
      <div className="metric-grid">
        {[
          ["⚡", days.reduce((s, d) => s + d.xp, 0), "XP за неделю"],
          [
            "✓",
            state.events.filter((e) => e.kind === "action").length,
            "Выполнено квестов",
          ],
          ["🔥", streak(state.activityDays), "Дней подряд"],
          [
            "◎",
            (state.spheres.reduce((s, a) => s + a.score, 0) / 9).toFixed(1),
            "Средний Life Score",
          ],
        ].map(([icon, value, label]) => (
          <div className="card metric" key={label}>
            <span>{icon}</span>
            <strong>{value}</strong>
            <small>{label}</small>
          </div>
        ))}
      </div>
      <Section title="Активность за неделю">
        <div className="card">
          <p className="muted">Все начисления XP за последние 7 дней</p>
          <div
            className="bar-chart"
            role="img"
            aria-label={days.map((d) => `${d.label}: ${d.xp} XP`).join(", ")}
          >
            {days.map((d, i) => (
              <div key={i}>
                <span>{d.xp}</span>
                <i style={{ height: `${Math.max(3, (d.xp / max) * 140)}px` }} />
                <small>{d.label}</small>
              </div>
            ))}
          </div>
          {!state.events.length && (
            <p className="muted">
              Демонстрационный стартовый XP не входит в график. Выполни квест,
              чтобы увидеть прогресс.
            </p>
          )}
        </div>
      </Section>
      <Section title="Баланс сфер">
        <div className="card">
          {state.spheres.map((s) => (
            <div className="balance-row" key={s.id}>
              <span>
                {s.icon} {s.name}
              </span>
              <Progress value={(s.score / 9) * 100} />
              <b>{s.score}/9</b>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Общий прогресс">
        <div className="card summary">
          <strong>{state.xp.toLocaleString("ru-RU")} XP</strong>
          <span>
            {state.goals.filter((g) => g.rewarded).length} завершённых целей ·{" "}
            {state.achievements.length} достижений
          </span>
        </div>
      </Section>
    </>
  );
}
