import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameState } from '../game';
import { monthKey, monthLabel, moveMonth, validMonth } from '../monthly';
import { monthReport, setImportance } from '../monthReport';
import { victoryOf } from '../personalResults';
import { carriedPlans } from '../keyResults';
import './MonthReport.css';

const ratingTitles = ['', 'Тяжёлый месяц', 'Неровный месяц', 'Спокойный месяц', 'Хороший месяц', 'Отличный месяц'];
const flagText = { focus: 'Важно, но мало внимания', overload: 'Усилий больше, чем важности', ok: 'Совпадает', none: 'Отметь важность' } as const;

function radarPoint(index: number, total: number, value: number, radius = 110, cx = 190, cy = 165) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const r = (value / 10) * radius;
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}
const polygon = (values: (number | null)[]) =>
  values.map((v, i) => radarPoint(i, values.length, v ?? 0)).map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

/** «Ключевые итоги → Отчёт месяца»: итог месяца по сохранённой истории. */
export default function MonthReport({
  state,
  onChange,
  onOpenMine,
  selectedMonth,
  onOpenVictory,
}: {
  state: GameState;
  onChange: Dispatch<SetStateAction<GameState>>;
  onOpenMine: () => void;
  selectedMonth?: string;
  onOpenVictory?: () => void;
}) {
  const [localMonth, setMonth] = useState(monthKey);
  const month = selectedMonth ?? localMonth;
  const r = monthReport(state, month);
  const s = r.summary;
  const change = r.xpChange;
  const heroText =
    change === null
      ? s.xp > 0
        ? 'Сравнение появится, когда будет история прошлого месяца.'
        : 'Не каждый результат измеряется XP. Заметь то, что было важно тебе.'
      : change >= 0
        ? `На ${change}% больше XP, чем в прошлом месяце (${r.previousXp} XP).${r.growth ? ` Сильнее всего вырос «${r.growth.name}»: оценка ${r.growth.before} → ${r.growth.after}.` : ''}`
        : `На ${Math.abs(change)}% меньше XP, чем в прошлом месяце (${r.previousXp} XP). Это нормально: важно, что ты продолжаешь.`;
  const kpis = [
    { label: 'XP за месяц', value: String(s.xp), unit: 'XP', note: change === null ? 'нет данных для сравнения' : `${change >= 0 ? '+' : ''}${change}% к прошлому` },
    { label: 'Задач выполнено', value: String(s.quests), unit: '', note: `было ${r.previousQuests}` },
    { label: 'Целей достигнуто', value: String(s.goals), unit: '', note: s.goals ? 'Отличный результат' : 'в этом месяце пока нет' },
    { label: 'Активных дней', value: String(s.activeDays), unit: `из ${r.daysPassed}`, note: `лучшая серия ${s.longest} дн.` },
    { label: 'Привычки', value: r.habits.rate === null ? '—' : `${r.habits.rate}%`, unit: '', note: r.habits.rate === null ? 'привычек пока нет' : `${r.habits.totalMade} из ${r.habits.totalDue} отметок` },
  ];
  const total = r.sphereRows.length;
  const before = r.sphereRows.map((x) => x.before);
  const after = r.sphereRows.map((x) => x.after);
  const hasRadar = r.balance !== null;
  const importanceCount = r.values.filter((v) => v.importance > 0).length;

  return (
    <div className="mrep">
      {!selectedMonth && <div className="mrep-bar">
        <div className="mrep-nav">
          <button className="icon-button outlined" aria-label="Предыдущий месяц" onClick={() => setMonth(moveMonth(month, -1))}>←</button>
          <b>{monthLabel(month)}</b>
          <button className="icon-button outlined" aria-label="Следующий месяц" disabled={month >= monthKey()} onClick={() => { const next = moveMonth(month, 1); if (validMonth(next) && next <= monthKey()) setMonth(next); }}>→</button>
        </div>
      </div>}

      <section className="mrep-hero">
        <div className="mrep-hero-main">
          <span className="mrep-pill">ОТЧЁТ МЕСЯЦА · {r.current ? 'ИДЁТ' : 'ЗАВЕРШЁН'}</span>
          <h2>{monthLabel(month)}</h2>
          <p>{heroText}</p>
          <div className="mrep-days">
            <div><span>Прошло {r.daysPassed} из {r.daysTotal} дн.</span><span>{r.current ? `до конца месяца ${r.daysLeft} дн.` : 'месяц закончен'}</span></div>
            <div className="mrep-track"><i style={{ width: `${(r.daysPassed / r.daysTotal) * 100}%` }} /></div>
          </div>
        </div>
        <div className="mrep-ring">
          <div className="mrep-ring-box">
            <svg viewBox="0 0 220 220" role="img" aria-label={r.balance ? `Баланс сфер ${r.balance.after.toFixed(1)} из 10` : 'Баланс сфер пока неизвестен'}>
              <circle cx="110" cy="110" r="90" className="bg" />
              <circle cx="110" cy="110" r="90" className="fg" strokeDasharray={`${(r.balance ? r.balance.after / 10 : 0) * 565} 565`} transform="rotate(-90 110 110)" />
            </svg>
            <div><b>{r.balance ? r.balance.after.toFixed(1) : '—'}</b><span>баланс сфер из 10</span></div>
          </div>
          {r.balance && (
            <div className="mrep-ring-side">
              <span>В начале месяца</span>
              <b>{r.balance.before.toFixed(1)}</b>
              <em className={r.balance.after >= r.balance.before ? 'up' : 'down'}>{r.balance.after - r.balance.before >= 0 ? '+' : ''}{(r.balance.after - r.balance.before).toFixed(1)}</em>
            </div>
          )}
        </div>
        <div className="mrep-kpis">
          {kpis.map((k) => (
            <div key={k.label}><span>{k.label}</span><b>{k.value}<small>{k.unit}</small></b><em>{k.note}</em></div>
          ))}
        </div>
      </section>

      {s.partial && (
        <p className="mrep-note">ⓘ Подробный учёт задач, целей и оценок сфер {s.trackingSince ? `ведётся с ${new Date(s.trackingSince).toLocaleDateString('ru-RU')}` : 'ещё не начат'}. Старые записи могут быть неполными; их XP включён в общий результат.</p>
      )}

      <div className="mrep-two">
        <section className="mrep-card mrep-wide">
          <header>
            <div>
              <h3>XP по дням</h3>
              <p>{r.bestDay ? `Лучший день — ${new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, r.bestDay.number, 12).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}, ${r.bestDay.xp} XP.` : 'Здесь появятся дни с XP.'} {r.emptyDays ? `Дней без задач: ${r.emptyDays}.` : ''}</p>
            </div>
            <div className="mrep-big"><b>+{s.xp}</b> XP</div>
          </header>
          <div className="mrep-bars" role="img" aria-label="XP по дням месяца">
            {s.days.map((d) => (
              <div key={d.key} title={`${d.number}: ${d.xp} XP, задач ${d.quests}`}>
                <i className={d.future ? 'future' : d.xp === 0 ? 'zero' : ''} style={{ height: `${d.xp ? Math.max(6, (d.xp / r.maxDayXp) * 100) : 3}%` }} />
                <span>{d.number % 5 === 1 || d.number === r.daysTotal ? d.number : ''}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="mrep-card">
          <header><div><h3>Из чего сложился XP</h3><p>Реальные действия и заслуженные бонусы.</p></div></header>
          {s.breakdown.filter((b) => b.kind !== 'legacy' || b.xp > 0).map((b) => (
            <div className="mrep-row" key={b.kind}>
              <div><span>{b.label}</span><b>+{b.xp} XP</b></div>
              <div className="mrep-track"><i style={{ width: `${s.xp ? (b.xp / s.xp) * 100 : 0}%` }} /></div>
            </div>
          ))}
          <p className="mrep-small">За заполнение итогов XP не начисляется.</p>
        </section>
      </div>

      <section className="mrep-block">
        <header className="mrep-head">
          <div>
            <h3>Сферы жизни</h3>
            <p>Уровни и XP — из игры. Закрытые задачи — из «Моих итогов». Личная победа — из «Ключевого результата».</p>
          </div>
          <div className="mrep-head-side">
            <span>Личных побед записано: {r.sphereRows.filter((row) => victoryOf(r.review, row.id).trim()).length}</span>
            <button className="mrep-cta" onClick={onOpenVictory ?? onOpenMine}>Личные победы по сферам</button>
          </div>
        </header>
        <div className="mrep-spheres-layout">
          <div className="mrep-summary-column">
            <div className="mrep-card mrep-radar">
              <h4>Колесо баланса</h4>
              {hasRadar ? (
                <>
                  <svg viewBox="0 0 380 340" role="img" aria-label="Колесо баланса: оценки сфер в начале месяца и сейчас">
                    {[2, 4, 6, 8, 10].map((ring) => <polygon key={ring} points={polygon(Array(total).fill(ring))} className="ring" />)}
                    <polygon points={polygon(before)} className="before" />
                    <polygon points={polygon(after)} className="after" />
                    {r.sphereRows.map((x, i) => {
                      const p = radarPoint(i, total, after[i] ?? 0);
                      const l = radarPoint(i, total, 11.8);
                      return (
                        <g key={x.id}>
                          <circle cx={p.x} cy={p.y} r="5" fill={x.color} className="dot" />
                          <text x={l.x} y={l.y + 4} textAnchor={l.x < 150 ? 'end' : l.x > 230 ? 'start' : 'middle'}>{x.name.length > 12 ? `${x.name.slice(0, 11)}…` : x.name}</text>
                        </g>
                      );
                    })}
                  </svg>
                  <div className="mrep-legend"><span className="dash">Начало месяца</span><span className="fill">Сейчас</span></div>
                </>
              ) : (
                <p className="mrep-small">Колесо появится, когда накопятся оценки всех десяти сфер за месяц.</p>
              )}
            </div>
            <div className="mrep-summary-stack">
              <section className="mrep-card mrep-goals">
                <header><div><h3>Главные цели</h3><p>Где сейчас прогресс.</p></div></header>
                {r.goals.length === 0 && <p className="mrep-small">Целей пока нет.</p>}
                {r.goals.map((g) => (
                  <div className="mrep-row" key={g.id}>
                    <div><span>{g.name}</span><b>{g.percent}%</b></div>
                    <div className="mrep-track green"><i style={{ width: `${g.percent}%` }} /></div>
                    <small>{g.text}</small>
                  </div>
                ))}
              </section>
              <section className="mrep-card mrep-habits">
                <header><div><h3>Привычки и серии</h3><p>{r.habits.rate === null ? 'Привычек пока нет. Они появятся в разделе «Привычки».' : `Выполнено ${r.habits.rate}% отметок.`}</p></div>{r.habits.rate !== null && <span className="mrep-badge">{r.habits.rate}%</span>}</header>
                {r.habits.rows.map((h) => (
                  <div className="mrep-habit" key={h.id}>
                    <div><b>{h.name}</b><span>{h.rate === null ? 'ещё нет плановых дней' : `${h.made} из ${h.due} · серия ${h.streak}, рекорд ${h.best}`}</span></div>
                    <div className="mrep-cells" aria-label={`Отметки привычки ${h.name}`}>
                      {h.cells.map((c, i) => <span key={i} className={c} />)}
                    </div>
                  </div>
                ))}
              </section>
              <section className="mrep-card mrep-achievements">
                <header><div><h3>Достижения месяца</h3></div></header>
                {r.achievements.length === 0 && <p className="mrep-small">Достигнутые цели месяца появятся здесь.</p>}
                {r.achievements.map((a) => (
                  <div className="mrep-ach" key={a.name + a.date}><span>★</span><div><b>{a.name}</b><small>{a.date}</small></div></div>
                ))}
              </section>
            </div>
          </div>
          <div className="mrep-sphere-grid">
            {r.sphereRows.map((x) => (
              <div className="mrep-sphere" key={x.id} style={{ ['--sphere' as string]: x.color }}>
                <div className="mrep-sphere-head">
                  <i />
                  <div><b>{x.name}</b><span>{x.levels}</span></div>
                  <div><b>+{x.xp}</b><span>XP</span></div>
                </div>
                <div className="mrep-track sphere"><i style={{ width: `${x.share}%` }} /></div>
                <div className="kr-report-personal">
                  <span>Закрыто задач вручную: <b>{r.review.spheres[x.id]?.tasksDone ?? 'не указано'}</b></span>
                  <p>{victoryOf(r.review, x.id) || 'Личная победа пока не записана'}</p>
                </div>
                <div className={`mrep-status ${victoryOf(r.review, x.id) ? 'done' : 'none'}`}>
                  <span>{victoryOf(r.review, x.id) ? 'Личная победа сохранена' : 'Можно дополнить месяц'}</span>
                  <button onClick={victoryOf(r.review, x.id) ? onOpenMine : onOpenVictory ?? onOpenMine}>{victoryOf(r.review, x.id) ? 'Мои итоги' : 'Записать победу'}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mrep-card mrep-compare">
        <div className="mrep-compare-main">
          <header><div><h3>Шесть месяцев подряд</h3><p>XP по месяцам.{r.current ? ' Текущий ещё идёт.' : ''}</p></div></header>
          <div className="mrep-months">
            {r.months.map((m) => (
              <div key={m.key}>
                <b>{m.xp}</b>
                <i className={m.current ? 'current' : ''} style={{ height: `${m.xp ? Math.max(4, (m.xp / r.maxMonth) * 100) : 2}%` }} />
                <span>{m.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mrep-insights">
          {r.insights.length === 0 && <p className="mrep-small">Наблюдения появятся после первых действий.</p>}
          {r.insights.map((i) => <div key={i.label}><span>{i.label}</span><b>{i.value}</b></div>)}
        </div>
      </section>

      <section className="mrep-card mrep-values">
        <header className="mrep-head">
          <div>
            <span className="mrep-pill violet">РАЗ В КВАРТАЛ</span>
            <h3>Важное и усилия</h3>
            <p>Отметь, насколько важна каждая сфера именно сейчас, и сравни с тем, куда ушли силы. Совпадает ли?</p>
          </div>
          <div className="mrep-legend"><span className="gold">Важность для меня</span><span className="blue">Доля усилий (XP)</span></div>
        </header>
        {!r.importanceFresh && <p className="mrep-hint">Новый квартал: отметь важность сфер от 1 до 5 (нажми на точки). Правильного ответа нет.</p>}
        {r.values.map((v) => (
          <div className="mrep-value" key={v.id} style={{ ['--sphere' as string]: v.color }}>
            <b>{v.name}</b>
            <div className="mrep-dots" role="group" aria-label={`Важность сферы ${v.name} от 1 до 5`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} aria-label={`${n} из 5`} aria-pressed={v.importance === n} className={n <= v.importance ? 'on' : ''} onClick={() => onChange((st) => setImportance(st, v.id, n))} />
              ))}
            </div>
            <div className="mrep-share"><div className="mrep-track blue"><i style={{ width: `${Math.min(100, v.share * 2)}%` }} /></div><b>{v.share}%</b></div>
            <em className={v.flag}>{flagText[v.flag]}</em>
          </div>
        ))}
        {r.focusNote && importanceCount > 0 && <div className="mrep-focus-note">{r.focusNote}</div>}
      </section>

      <section className="mrep-card">
        <header className="mrep-head">
          <div><h3>Мой взгляд на месяц</h3><p>Цифры — только часть истории. Остальное — в «Мои итоги».</p></div>
          <button className="mrep-cta" onClick={onOpenMine}>Открыть «Мои итоги»</button>
        </header>
        <div className="kr-report-conclusion">
          <div><h4>Главный вывод</h4><p>{r.review.conclusion ?? state.monthlyReflections?.[month]?.lessons ?? 'Вывод пока не записан'}</p></div>
          <div><h4>Планы на следующий месяц</h4>
            {(r.review.nextPlans?.filter((plan) => plan.title.trim()).length ?? 0) > 0
              ? <ol>{r.review.nextPlans!.filter((plan) => plan.title.trim()).map((plan) => <li key={plan.id}>{plan.title}</li>)}</ol>
              : <p>{carriedPlans(state, moveMonth(month, 1)).map((plan) => plan.text).join(' · ') || 'Планы пока не записаны'}</p>}
          </div>
        </div>
        {r.rating !== null && <p className="mrep-small">Прежняя оценка месяца: {r.rating} из 5 · {ratingTitles[r.rating]}</p>}
      </section>
    </div>
  );
}
