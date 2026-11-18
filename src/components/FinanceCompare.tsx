import { useMemo, useState } from 'react';
import type { GameState } from '../game';
import { cagr, compareCategories, yearsSummary } from '../finance';
import type { CategoryDelta } from '../finance';
import './FinanceCompare.css';

const money = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₽`;
const signedMoney = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n)).toLocaleString('ru-RU')} ₽`;
const pct = (n: number | null, digits = 0) => (n === null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}%`);
const pp = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(1)} п.п.`;

/** Тон изменения: для расходов рост — плохо, для доходов — хорошо. */
function tone(value: number | null, kind: 'expense' | 'income') {
  if (value === null || Math.abs(value) < 0.5) return 'flat';
  const good = kind === 'income' ? value > 0 : value < 0;
  return good ? 'good' : 'bad';
}

function Delta({ value, kind, text }: { value: number | null; kind: 'expense' | 'income'; text?: string }) {
  const t = tone(value, kind);
  return <span className={`fc-delta is-${t}`}>{t === 'flat' ? '•' : (value ?? 0) > 0 ? '▲' : '▼'} {text ?? pct(value)}</span>;
}

/** Вкладка «Сравнение»: доходы и расходы по годам и статьи расходов год к году. */
export default function FinanceCompare({ state }: { state: GameState }) {
  const years = useMemo(() => yearsSummary(state), [state]);
  const [pickA, setPickA] = useState<string | null>(null);
  const [pickB, setPickB] = useState<string | null>(null);

  if (years.length < 2) {
    return (
      <section className="panel fc-empty">
        <h2>Сравнение по годам</h2>
        <p>Для сравнения нужны записи хотя бы за два года. Добавь операции или загрузи личный отчёт через «Импорт отчёта».</p>
      </section>
    );
  }

  // По умолчанию — два последних полных года: неполный текущий год искажает сравнение.
  const last = years[years.length - 1];
  const defaultB = last.months < 12 && years.length >= 3 ? years[years.length - 2].year : last.year;
  const yearB = pickB ?? defaultB;
  const idxB = years.findIndex((y) => y.year === yearB);
  const yearA = pickA && pickA !== yearB ? pickA : (years[idxB - 1] ?? years[idxB + 1]).year;
  const A = years.find((y) => y.year === yearA)!;
  const B = years.find((y) => y.year === yearB)!;
  const change = (a: number, b: number) => (a > 0 ? ((b - a) / a) * 100 : null);
  const expenseDeltas = compareCategories(state, yearA, yearB, 'expense');
  const incomeDeltas = compareCategories(state, yearA, yearB, 'income');
  const grew = expenseDeltas.filter((d) => d.diff > 0).slice(0, 5);
  const fell = expenseDeltas.filter((d) => d.diff < 0).slice(0, 5);
  // Среднегодовой рост — по полным годам: неполный текущий год занизил бы темп.
  const full = years.filter((y, i) => i < years.length - 1 || y.months === 12);
  const first = full[0];
  const lastFull = full[full.length - 1];
  const span = Number(lastFull.year) - Number(first.year);
  const incomeCagr = cagr(first.income, lastFull.income, span);
  const expenseCagr = cagr(first.expense, lastFull.expense, span);
  const best = [...full].filter((y) => y.savingsRate !== null).sort((a, b) => (b.savingsRate ?? 0) - (a.savingsRate ?? 0))[0];
  const maxValue = Math.max(1, ...years.flatMap((y) => [y.income, y.expense]));
  const incomeChange = change(A.income, B.income);
  const expenseChange = change(A.expense, B.expense);
  const rateDiff = A.savingsRate !== null && B.savingsRate !== null ? B.savingsRate - A.savingsRate : null;
  const partial = B.months < 12 ? ` · ${B.year}: данные за ${B.months} мес.` : '';

  const insights: string[] = [];
  if (incomeChange !== null && expenseChange !== null) {
    insights.push(
      `Доход ${pct(incomeChange)}, расходы ${pct(expenseChange)} к ${yearA}. ` +
        (B.net >= A.net ? `Остаток за год вырос на ${signedMoney(B.net - A.net).replace('+', '')} — запас прочности увеличился.` : `Остаток за год сократился на ${signedMoney(B.net - A.net).replace('−', '')} — расходы съедают сбережения.`),
    );
  }
  if (grew[0]) insights.push(`Сильнее всего выросла статья «${grew[0].category.name}»: ${signedMoney(grew[0].diff)} (${grew[0].pct === null ? 'новая статья' : pct(grew[0].pct)}).`);
  if (fell[0]) insights.push(`Больше всего сэкономлено на «${fell[0].category.name}»: ${signedMoney(fell[0].diff)} (${pct(fell[0].pct)}).`);
  if (best) insights.push(`Лучший год по норме сбережений — ${best.year}: ${best.savingsRate!.toFixed(0)}% дохода осталось.`);

  const rows = (list: CategoryDelta[], kind: 'expense' | 'income') => {
    const max = Math.max(1, ...list.flatMap((d) => [d.a, d.b]));
    return list.map((d) => (
      <tr key={d.category.id}>
        <th scope="row"><span aria-hidden="true">{d.category.icon}</span> {d.category.name}</th>
        <td>{money(d.a)}</td>
        <td>{money(d.b)}</td>
        <td className="fc-num">{signedMoney(d.diff)}</td>
        <td>{d.a === 0 ? <span className="fc-tag is-new">новая</span> : d.b === 0 ? <span className="fc-tag">нет в {yearB}</span> : <Delta value={d.pct} kind={kind} />}</td>
        <td className="fc-bars" aria-hidden="true">
          <i className="is-a" style={{ width: `${(d.a / max) * 100}%` }} />
          <i className={`is-b is-${kind}`} style={{ width: `${(d.b / max) * 100}%` }} />
        </td>
      </tr>
    ));
  };

  return (
    <div className="fc">
      <div className="fc-pick">
        <label>Сравнить <select aria-label="Год A" value={yearA} onChange={(e) => setPickA(e.target.value)}>{years.filter((y) => y.year !== yearB).map((y) => <option key={y.year}>{y.year}</option>)}</select></label>
        <span aria-hidden="true">→</span>
        <label>с <select aria-label="Год B" value={yearB} onChange={(e) => setPickB(e.target.value)}>{years.map((y) => <option key={y.year}>{y.year}</option>)}</select></label>
        <small>{years[0].year}–{years[years.length - 1].year}: {years.length} {years.length < 5 ? 'года' : 'лет'} данных{partial}</small>
      </div>

      <div className="fc-kpis">
        <div className="panel fc-kpi"><span>Доход {yearA} → {yearB}</span><b>{money(B.income)}</b><em>было {money(A.income)} · <Delta value={incomeChange} kind="income" /></em></div>
        <div className="panel fc-kpi"><span>Расходы {yearA} → {yearB}</span><b>{money(B.expense)}</b><em>было {money(A.expense)} · <Delta value={expenseChange} kind="expense" /></em></div>
        <div className="panel fc-kpi"><span>Остаток за год</span><b className={B.net < 0 ? 'negative' : ''}>{signedMoney(B.net)}</b><em>было {signedMoney(A.net)} · <Delta value={B.net - A.net} kind="income" text={signedMoney(B.net - A.net)} /></em></div>
        <div className="panel fc-kpi"><span>Норма сбережений</span><b>{B.savingsRate === null ? '—' : `${B.savingsRate.toFixed(0)}%`}</b><em>было {A.savingsRate === null ? '—' : `${A.savingsRate.toFixed(0)}%`}{rateDiff !== null && <> · <Delta value={rateDiff} kind="income" text={pp(rateDiff)} /></>}</em></div>
        <div className="panel fc-kpi"><span>Среднегодовой рост дохода</span><b>{pct(incomeCagr, 1)}</b><em>CAGR {first.year}–{lastFull.year}</em></div>
        <div className="panel fc-kpi"><span>Среднегодовой рост расходов</span><b>{pct(expenseCagr, 1)}</b><em>CAGR {first.year}–{lastFull.year}</em></div>
      </div>

      {insights.length > 0 && (
        <section className="panel fc-insights">
          <h2>Выводы</h2>
          <ul>{insights.map((t) => <li key={t}>{t}</li>)}</ul>
        </section>
      )}

      <section className="panel fc-years">
        <div className="section-heading"><div><h2>Доходы и расходы по годам</h2><p>Рост к предыдущему году; в среднем в месяц — по месяцам с записями</p></div></div>
        <div className="fc-table-wrap">
          <table className="fc-table">
            <thead><tr><th>Год</th><th>Доход</th><th>г/г</th><th>Расходы</th><th>г/г</th><th>Остаток</th><th>Норма сбер.</th><th>Расходы в месяц</th><th className="fc-bars-head">Доход / расходы</th></tr></thead>
            <tbody>
              {[...years].reverse().map((y) => (
                <tr key={y.year} className={y.year === yearA || y.year === yearB ? 'is-picked' : ''}>
                  <th scope="row">{y.year}{y.months < 12 && <small> · {y.months} мес.</small>}</th>
                  <td>{money(y.income)}</td>
                  <td><Delta value={y.incomeChange} kind="income" /></td>
                  <td>{money(y.expense)}</td>
                  <td><Delta value={y.expenseChange} kind="expense" /></td>
                  <td className={y.net < 0 ? 'negative' : ''}>{signedMoney(y.net)}</td>
                  <td>{y.savingsRate === null ? '—' : `${y.savingsRate.toFixed(0)}%`}</td>
                  <td>{money(y.expense / Math.max(1, y.months))}</td>
                  <td className="fc-bars" aria-hidden="true">
                    <i className="is-b is-income" style={{ width: `${(y.income / maxValue) * 100}%` }} />
                    <i className="is-b is-expense" style={{ width: `${(y.expense / maxValue) * 100}%` }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="fc-movers">
        <section className="panel fc-mover is-up">
          <h2>Расходы выросли</h2>
          {grew.length ? <ol>{grew.map((d) => <li key={d.category.id}><span>{d.category.icon} {d.category.name}</span><b>{signedMoney(d.diff)}</b><Delta value={d.pct} kind="expense" text={d.pct === null ? 'новая' : undefined} /></li>)}</ol> : <p>Ни одна статья не выросла.</p>}
        </section>
        <section className="panel fc-mover is-down">
          <h2>Расходы снизились</h2>
          {fell.length ? <ol>{fell.map((d) => <li key={d.category.id}><span>{d.category.icon} {d.category.name}</span><b>{signedMoney(d.diff)}</b><Delta value={d.pct} kind="expense" /></li>)}</ol> : <p>Ни одна статья не снизилась.</p>}
        </section>
      </div>

      <section className="panel fc-cats">
        <div className="section-heading"><div><h2>Статьи расходов: {yearA} → {yearB}</h2><p>По величине изменения; серая полоса — {yearA}, цветная — {yearB}</p></div></div>
        <div className="fc-table-wrap">
          <table className="fc-table">
            <thead><tr><th>Статья</th><th>{yearA}</th><th>{yearB}</th><th>Изменение</th><th>%</th><th className="fc-bars-head">Сравнение</th></tr></thead>
            <tbody>{rows(expenseDeltas, 'expense')}</tbody>
          </table>
        </div>
      </section>

      {incomeDeltas.length > 0 && (
        <section className="panel fc-cats">
          <div className="section-heading"><div><h2>Источники дохода: {yearA} → {yearB}</h2><p>Откуда пришли деньги и как это изменилось</p></div></div>
          <div className="fc-table-wrap">
            <table className="fc-table">
              <thead><tr><th>Источник</th><th>{yearA}</th><th>{yearB}</th><th>Изменение</th><th>%</th><th className="fc-bars-head">Сравнение</th></tr></thead>
              <tbody>{rows(incomeDeltas, 'income')}</tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
