import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameState } from '../game';
import {
  addCategory,
  addTransaction,
  categoryBreakdown,
  financeCategories,
  financeYears,
  monthTransactions,
  removeTransaction,
  totals,
  updateTransaction,
  yearMonthlySeries,
  yearTransactions,
} from '../finance';
import type { FinanceKind, FinanceTransaction, TransactionInput } from '../finance';
import { monthKey, monthLabel, moveMonth, validMonth } from '../monthly';
import { validYear, yearKey, yearLabel } from '../yearReport';
import Icon from './Icon';
import './FinancePage.css';

const money = (n: number) =>
  `${Math.round(n).toLocaleString('ru-RU')} ₽`;
const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });

type View = 'month' | 'year';

type FormState = {
  type: FinanceKind;
  amount: string;
  categoryId: string;
  date: string;
  note: string;
};

function blankForm(type: FinanceKind, date: string, categoryId: string): FormState {
  return { type, amount: '', categoryId, date, note: '' };
}

/** «Финансы»: личный учёт трат и доходов (реальные деньги). Не связано с лайфкоинами/XP. */
export default function FinancePage({
  state,
  onChange,
  notify,
}: {
  state: GameState;
  onChange: Dispatch<SetStateAction<GameState>>;
  notify: (message: string) => void;
}) {
  const [view, setView] = useState<View>('month');
  const [month, setMonth] = useState(monthKey);
  const [year, setYear] = useState(yearKey);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);

  const categories = financeCategories(state);
  const years = financeYears(state);

  const monthList = monthTransactions(state, month);
  const monthSorted = [...monthList].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt.localeCompare(a.createdAt)));
  const monthTotals = totals(monthList);
  const prevMonthTotals = totals(monthTransactions(state, moveMonth(month, -1)));
  const monthExpenseChange = prevMonthTotals.expense
    ? Math.round(((monthTotals.expense - prevMonthTotals.expense) / prevMonthTotals.expense) * 100)
    : null;
  const monthCategories = categoryBreakdown(state, monthList, 'expense');

  const yearList = yearTransactions(state, year);
  const yearTotals = totals(yearList);
  const yearCategories = categoryBreakdown(state, yearList, 'expense');
  const series = yearMonthlySeries(state, year);
  const maxMonthExpense = Math.max(1, ...series.map((m) => m.expense));

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function openCreate(type: FinanceKind = 'expense') {
    const firstOfType = categories.find((c) => c.type === type);
    setEditId(null);
    const today = todayKey();
    const defaultDate = view === 'month' && month !== monthKey() ? `${month}-01` : today;
    setForm(blankForm(type, defaultDate, firstOfType?.id ?? ''));
  }
  function openEdit(t: FinanceTransaction) {
    setEditId(t.id);
    setForm({ type: t.type, amount: String(t.amount), categoryId: t.categoryId, date: t.date, note: t.note ?? '' });
  }
  function closeForm() {
    setForm(null);
    setEditId(null);
    setNewCategoryOpen(false);
  }
  function save() {
    if (!form) return;
    const amount = Number(form.amount.replace(',', '.'));
    const input: TransactionInput = {
      type: form.type,
      amount,
      categoryId: form.categoryId,
      date: form.date,
      note: form.note.trim() || undefined,
    };
    try {
      onChange((s) => (editId ? updateTransaction(s, editId, input) : addTransaction(s, input)));
      notify(editId ? 'Запись обновлена' : 'Запись добавлена');
      closeForm();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Проверь сумму, категорию и дату.');
    }
  }
  function remove(id: string) {
    onChange((s) => removeTransaction(s, id));
    notify('Запись удалена');
    if (editId === id) closeForm();
  }
  function createCategory(name: string, icon: string, type: FinanceKind) {
    if (!name.trim()) return;
    onChange((s) => addCategory(s, { name, icon, type }));
    setNewCategoryOpen(false);
  }

  const formCategories = form ? categories.filter((c) => c.type === form.type) : [];

  return (
    <div className="fin">
      <div className="fin-top">
        <div className="fin-tabs" role="tablist" aria-label="Период">
          <button type="button" role="tab" aria-selected={view === 'month'} className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>Помесячно</button>
          <button type="button" role="tab" aria-selected={view === 'year'} className={view === 'year' ? 'active' : ''} onClick={() => setView('year')}>По году</button>
        </div>
        <button type="button" className="primary-button fin-add" onClick={() => openCreate('expense')}>
          <Icon name="plus" size={16} /> Добавить запись
        </button>
      </div>

      {view === 'month' ? (
        <>
          <div className="fin-nav">
            <button className="icon-button outlined" aria-label="Предыдущий месяц" onClick={() => setMonth(moveMonth(month, -1))}>←</button>
            <b>{monthLabel(month)}</b>
            <button className="icon-button outlined" aria-label="Следующий месяц" disabled={month >= monthKey()} onClick={() => { const next = moveMonth(month, 1); if (validMonth(next) && next <= monthKey()) setMonth(next); }}>→</button>
          </div>

          <div className="fin-kpis">
            <div className="panel fin-kpi fin-kpi-expense">
              <span>Траты за месяц</span>
              <b>{money(monthTotals.expense)}</b>
              <em>{monthExpenseChange === null ? 'нет данных за прошлый месяц' : `${monthExpenseChange >= 0 ? '+' : ''}${monthExpenseChange}% к прошлому`}</em>
            </div>
            <div className="panel fin-kpi fin-kpi-income">
              <span>Доход за месяц</span>
              <b>{money(monthTotals.income)}</b>
              <em>{monthTotals.count} {wordRecords(monthTotals.count)}</em>
            </div>
            <div className="panel fin-kpi fin-kpi-net">
              <span>Остаток</span>
              <b className={monthTotals.net < 0 ? 'negative' : ''}>{monthTotals.net >= 0 ? '+' : ''}{money(monthTotals.net)}</b>
              <em>доход минус траты</em>
            </div>
          </div>

          <CategoryBreakdown title="На что ушли траты" rows={monthCategories} total={monthTotals.expense} />

          <section className="panel fin-list">
            <div className="section-heading">
              <div><h2>Операции</h2><p>{monthLabel(month)}, последние сверху</p></div>
              <span className="count-chip">{monthSorted.length}</span>
            </div>
            {monthSorted.length === 0 ? (
              <p className="fin-empty">Пока нет записей за этот месяц. Добавь первую трату или доход.</p>
            ) : (
              <div className="fin-rows">
                {monthSorted.map((t) => {
                  const category = categories.find((c) => c.id === t.categoryId);
                  return (
                    <div className="fin-row" key={t.id}>
                      <button type="button" className="fin-row-main" onClick={() => openEdit(t)}>
                        <span className="fin-row-icon" aria-hidden="true">{category?.icon ?? '❔'}</span>
                        <span className="fin-row-text">
                          <strong>{category?.name ?? 'Без категории'}</strong>
                          <small>{dayLabel(t.date)}{t.note ? ` · ${t.note}` : ''}</small>
                        </span>
                        <span className={t.type === 'expense' ? 'fin-row-amount negative' : 'fin-row-amount positive'}>
                          {t.type === 'expense' ? '−' : '+'}{money(t.amount)}
                        </span>
                      </button>
                      <button type="button" className="icon-button" aria-label={`Удалить запись: ${category?.name ?? ''} ${money(t.amount)}`} onClick={() => remove(t.id)}>
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          <div className="fin-nav">
            <label className="fin-year-select">
              <span>Год</span>
              <select aria-label="Выбрать год" value={year} onChange={(e) => validYear(e.target.value) && setYear(e.target.value)}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>

          <div className="fin-kpis">
            <div className="panel fin-kpi fin-kpi-expense">
              <span>Траты за {yearLabel(year)}</span>
              <b>{money(yearTotals.expense)}</b>
              <em>в среднем {money(yearTotals.expense / 12)} в месяц</em>
            </div>
            <div className="panel fin-kpi fin-kpi-income">
              <span>Доход за {yearLabel(year)}</span>
              <b>{money(yearTotals.income)}</b>
              <em>{yearTotals.count} {wordRecords(yearTotals.count)}</em>
            </div>
            <div className="panel fin-kpi fin-kpi-net">
              <span>Остаток</span>
              <b className={yearTotals.net < 0 ? 'negative' : ''}>{yearTotals.net >= 0 ? '+' : ''}{money(yearTotals.net)}</b>
              <em>доход минус траты</em>
            </div>
          </div>

          <section className="panel fin-chart">
            <div className="section-heading">
              <div><h2>Траты по месяцам</h2><p>{yearLabel(year)}</p></div>
            </div>
            <div className="fin-bars" role="img" aria-label={`Траты по месяцам ${yearLabel(year)}`}>
              {series.map((m) => (
                <button
                  type="button"
                  key={m.month}
                  className={`fin-bar${m.month === month ? ' current' : ''}`}
                  title={`${m.label}: траты ${money(m.expense)}, доход ${money(m.income)}`}
                  onClick={() => { setMonth(m.month); setView('month'); }}
                >
                  <span className="fin-bar-track"><i style={{ height: `${(m.expense / maxMonthExpense) * 100}%` }} /></span>
                  <small>{m.label.slice(0, 3)}</small>
                </button>
              ))}
            </div>
          </section>

          <CategoryBreakdown title="На что ушли траты за год" rows={yearCategories} total={yearTotals.expense} />
        </>
      )}

      {form && (
        <div className="fin-modal-backdrop" role="presentation" onClick={closeForm}>
          <section className="panel fin-modal" role="dialog" aria-label={editId ? 'Изменить запись' : 'Новая запись'} onClick={(e) => e.stopPropagation()}>
            <div className="section-heading">
              <h2>{editId ? 'Изменить запись' : 'Новая запись'}</h2>
              <button type="button" className="icon-button" aria-label="Закрыть" onClick={closeForm}><Icon name="close" size={18} /></button>
            </div>
            <div className="fin-type-toggle" role="group" aria-label="Тип записи">
              <button type="button" className={form.type === 'expense' ? 'active' : ''} onClick={() => setForm({ ...form, type: 'expense', categoryId: categories.find((c) => c.type === 'expense')?.id ?? '' })}>Трата</button>
              <button type="button" className={form.type === 'income' ? 'active' : ''} onClick={() => setForm({ ...form, type: 'income', categoryId: categories.find((c) => c.type === 'income')?.id ?? '' })}>Доход</button>
            </div>
            <label className="fin-field">Сумма, ₽
              <input inputMode="decimal" placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} autoFocus />
            </label>
            <label className="fin-field">Дата
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </label>
            <div className="fin-field">
              <span>Категория</span>
              <div className="fin-category-grid">
                {formCategories.map((c) => (
                  <button type="button" key={c.id} className={c.id === form.categoryId ? 'active' : ''} onClick={() => setForm({ ...form, categoryId: c.id })}>
                    <span aria-hidden="true">{c.icon}</span>{c.name}
                  </button>
                ))}
                <button type="button" className="fin-new-category" onClick={() => setNewCategoryOpen(true)}>
                  <Icon name="plus" size={14} /> Своя
                </button>
              </div>
            </div>
            {newCategoryOpen && (
              <NewCategoryForm type={form.type} onCancel={() => setNewCategoryOpen(false)} onCreate={createCategory} />
            )}
            <label className="fin-field">Заметка (необязательно)
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} maxLength={300} placeholder="Например, магазин или повод" />
            </label>
            <div className="fin-modal-actions">
              {editId && <button type="button" className="icon-button outlined" aria-label="Удалить запись" onClick={() => remove(editId)}><Icon name="trash" size={16} /></button>}
              <button type="button" className="secondary-button" onClick={closeForm}>Отмена</button>
              <button type="button" className="primary-button" disabled={!form.categoryId || !form.amount} onClick={save}>{editId ? 'Сохранить' : 'Добавить'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function wordRecords(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'запись';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'записи';
  return 'записей';
}

function CategoryBreakdown({
  title,
  rows,
  total,
}: {
  title: string;
  rows: ReturnType<typeof categoryBreakdown>;
  total: number;
}) {
  return (
    <section className="panel fin-categories">
      <div className="section-heading">
        <div><h2>{title}</h2><p>Всего {money(total)}</p></div>
      </div>
      {rows.length === 0 ? (
        <p className="fin-empty">Трат пока нет.</p>
      ) : (
        <div className="fin-category-list">
          {rows.map((row) => (
            <div className="fin-category-row" key={row.category.id}>
              <span className="fin-category-name"><i aria-hidden="true">{row.category.icon}</i>{row.category.name}</span>
              <div className="fin-category-track"><i style={{ width: `${row.share}%` }} /></div>
              <strong>{money(row.amount)}</strong>
              <b>{Math.round(row.share)}%</b>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function NewCategoryForm({
  type,
  onCancel,
  onCreate,
}: {
  type: FinanceKind;
  onCancel: () => void;
  onCreate: (name: string, icon: string, type: FinanceKind) => void;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏷️');
  return (
    <div className="fin-new-category-form">
      <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={4} aria-label="Иконка категории" className="fin-icon-input" />
      <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Название категории" aria-label="Название категории" autoFocus />
      <button type="button" className="icon-button outlined" aria-label="Отмена" onClick={onCancel}><Icon name="close" size={14} /></button>
      <button type="button" className="primary-button" disabled={!name.trim()} onClick={() => onCreate(name, icon, type)}>Добавить</button>
    </div>
  );
}
