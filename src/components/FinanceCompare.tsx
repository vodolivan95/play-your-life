import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GameState } from '../game';
import { cagr, categoryBreakdown, compareCategories, yearTransactions, yearsSummary } from '../finance';
import type { FinanceCategory } from '../finance';
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
export default function FinanceCompare({ state, slot }: { state: GameState; slot?: HTMLElement | null }) {
  const years = useMemo(() => yearsSummary(state), [state]);
  const [picked, setPicked] = useState<string[] | null>(null);

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
  const desc = [...years].reverse(); // в списках — сверху вниз, начиная с нового года
  const idxDefault = years.findIndex((y) => y.year === defaultB);
  const defaults = [defaultB, (years[idxDefault - 1] ?? years[idxDefault + 1]).year];
  const sel = (picked ?? defaults).filter((y) => years.some((x) => x.year === y));
  // До четырёх лет: в таблицах — от нового к старому; сводка сравнивает самый старый с самым новым.
  let chosen = [...new Set(sel)].sort((a, b) => Number(b) - Number(a));
  if (chosen.length < 2) chosen = [...new Set([...chosen, ...desc.map((y) => y.year)])].slice(0, 2).sort((a, b) => Number(b) - Number(a));
  const yearB = chosen[0];
  const yearA = chosen[chosen.length - 1];
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

  const matrix = (kind: 'expense' | 'income') => {
    const per = chosen.map((y) => categoryBreakdown(state, yearTransactions(state, y), kind));
    const cats = new Map<string, FinanceCategory>();
    per.forEach((rows) => rows.forEach((r) => cats.set(r.category.id, r.category)));
    return [...cats.values()]
      .map((category) => {
        const values = per.map((rows) => rows.find((r) => r.category.id === category.id)?.amount ?? 0);
        const first = values[values.length - 1];
        const last = values[0];
        return { category, values, diff: last - first, pct: change(first, last), first, last };
      })
      .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
  };
  const table = (kind: 'expense' | 'income', label: string) => {
    const list = matrix(kind);
    const max = Math.max(1, ...list.flatMap((d) => d.values));
    return (
      <table className="fc-table">
        <thead><tr><th>{label}</th>{chosen.map((y) => <th key={y}>{y}</th>)}<th>{yearA} → {yearB}</th><th>%</th><th className="fc-bars-head">Сравнение</th></tr></thead>
        <tbody>
          {list.map((d) => (
            <tr key={d.category.id}>
              <th scope="row"><span aria-hidden="true">{d.category.icon}</span> {d.category.name}</th>
              {d.values.map((v, i) => <td key={chosen[i]}>{money(v)}</td>)}
              <td className="fc-num">{signedMoney(d.diff)}</td>
              <td>{d.first === 0 ? <span className="fc-tag is-new">новая</span> : d.last === 0 ? <span className="fc-tag">нет в {yearB}</span> : <Delta value={d.pct} kind={kind} />}</td>
              <td className="fc-bars" aria-hidden="true">
                {d.values.map((v, i) => <i key={chosen[i]} className={`is-b is-${kind} is-y${i}`} style={{ width: `${(v / max) * 100}%` }} />)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const picker = (
    <div className="fc-pick" role="group" aria-label="Годы для сравнения">
      <span>Годы</span>
      {chosen.map((y, i) => (
        <span className="fc-pick-slot" key={`${i}-${y}`}>
          <select aria-label={`Год ${i + 1}`} value={y} onChange={(e) => { const next = [...chosen]; next[i] = e.target.value; setPicked(next); }}>
            {desc.map((x) => <option key={x.year} value={x.year}>{x.year}</option>)}
          </select>
          {chosen.length > 2 && <button type="button" aria-label={`Убрать ${y}`} onClick={() => setPicked(chosen.filter((_, j) => j !== i))}>×</button>}
        </span>
      ))}
      {chosen.length < 4 && desc.length > chosen.length && (
        <button type="button" className="fc-add" onClick={() => setPicked([...chosen, desc.find((x) => !chosen.includes(x.year))!.year])}>+ год</button>
      )}
    </div>
  );

  return (
    <div className="fc">
      {slot ? createPortal(picker, slot) : picker}
      <small className="fc-span">{years[0].year}–{years[years.length - 1].year}: {years.length} {years.length < 5 ? 'года' : 'лет'} данных{partial}</small>

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
                <tr key={y.year} className={chosen.includes(y.year) ? 'is-picked' : ''}>
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
        <div className="section-heading"><div><h2>Статьи расходов: {chosen.slice().reverse().join(' → ')}</h2><p>По величине изменения {yearA} → {yearB}; полосы сверху вниз — от {yearB} к {yearA}</p></div></div>
        <div className="fc-table-wrap">
          {table('expense', 'Статья')}
        </div>
      </section>

      {incomeDeltas.length > 0 && (
        <section className="panel fc-cats">
          <div className="section-heading"><div><h2>Источники дохода: {chosen.slice().reverse().join(' → ')}</h2><p>Откуда пришли деньги и как это изменилось</p></div></div>
          <div className="fc-table-wrap">
            {table('income', 'Источник')}
          </div>
        </section>
      )}
    </div>
  );
}
