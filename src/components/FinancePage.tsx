import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { GameState } from '../game';
import {
  addCategory,
  addPayment,
  addTransaction,
  categoryBreakdown,
  financeCategories,
  financeYears,
  isPendingPayment,
  monthTransactions,
  paymentGroupLabels,
  paymentIntervalChoices,
  paymentIntervalLabel,
  payments,
  paymentsDueSoon,
  removePayment,
  removeTransaction,
  sortedPayments,
  daysUntilPayment,
  totals,
  updatePayment,
  updateTransaction,
  yearMonthlySeries,
  yearTransactions,
} from '../finance';
import type {
  FinanceKind,
  FinanceTransaction,
  PaymentEntry,
  PaymentGroup,
  PaymentInput,
  PaymentInterval,
  TransactionInput,
} from '../finance';
import { monthKey, monthLabel, moveMonth, validMonth } from '../monthly';
import { validYear, yearKey, yearLabel } from '../yearReport';
import { matchBrand } from '../brands';
import BrandIcon from '../brandIcons';
import Icon from './Icon';
import './FinancePage.css';

const money = (n: number) =>
  `${Math.round(n).toLocaleString('ru-RU')} ₽`;
const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
const paymentDayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
function daysLeftLabel(days: number) {
  if (days < 0) return `просрочен на ${Math.abs(days)} ${wordDays(Math.abs(days))}`;
  if (days === 0) return 'сегодня';
  return `через ${days} ${wordDays(days)}`;
}
function wordDays(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
  return 'дней';
}

type View = 'month' | 'year' | 'payments';

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

type PaymentFormState = {
  name: string;
  icon: string;
  amount: string;
  unknown: boolean;
  interval: PaymentInterval;
  nextDate: string;
  group: PaymentGroup;
  autopay: boolean;
  note: string;
};

function blankPaymentForm(date: string): PaymentFormState {
  return { name: '', icon: '💳', amount: '', unknown: false, interval: 1, nextDate: date, group: 'subs', autopay: true, note: '' };
}

const paymentFilterIds: ('all' | PaymentGroup)[] = ['all', 'housing', 'subs', 'credit', 'other'];

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
  const [paymentFilter, setPaymentFilter] = useState<'all' | PaymentGroup>('all');
  const [paymentEditId, setPaymentEditId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState | null>(null);

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

  const allPayments = payments(state);
  const dueSoon = paymentsDueSoon(allPayments);
  const filteredPayments = paymentFilter === 'all' ? allPayments : allPayments.filter((p) => p.group === paymentFilter);
  const sortedFilteredPayments = sortedPayments(filteredPayments);
  const upcoming = sortedPayments(allPayments).find((p) => !isPendingPayment(p));
  const thisMonthPayments = allPayments.filter((p) => p.nextDate.slice(0, 7) === monthKey());
  const thisMonthPaymentsTotal = thisMonthPayments.reduce((sum, p) => sum + (p.amount ?? 0), 0);
  const thisMonthPaymentsUnknown = thisMonthPayments.filter((p) => p.amount === null).length;

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

  function openCreatePayment() {
    setPaymentEditId(null);
    setPaymentForm(blankPaymentForm(todayKey()));
  }
  function openEditPayment(p: PaymentEntry) {
    setPaymentEditId(p.id);
    setPaymentForm({
      name: p.name,
      icon: p.icon,
      amount: p.amount === null ? '' : String(p.amount),
      unknown: p.nextDate === '',
      interval: p.interval,
      nextDate: p.nextDate || todayKey(),
      group: p.group,
      autopay: p.autopay,
      note: p.note ?? '',
    });
  }
  function closePaymentForm() {
    setPaymentForm(null);
    setPaymentEditId(null);
  }
  function savePayment() {
    if (!paymentForm) return;
    const input: PaymentInput = {
      name: paymentForm.name,
      icon: paymentForm.icon,
      amount: paymentForm.unknown || !paymentForm.amount ? null : Number(paymentForm.amount.replace(',', '.')),
      interval: paymentForm.unknown ? 'unknown' : paymentForm.interval,
      nextDate: paymentForm.unknown ? '' : paymentForm.nextDate,
      group: paymentForm.group,
      autopay: paymentForm.autopay,
      note: paymentForm.note.trim() || undefined,
    };
    try {
      onChange((s) => (paymentEditId ? updatePayment(s, paymentEditId, input) : addPayment(s, input)));
      notify(paymentEditId ? 'Платёж обновлён' : 'Платёж добавлен в реестр');
      closePaymentForm();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Проверь название, сумму, период и дату.');
    }
  }
  function removePaymentEntry(id: string) {
    onChange((s) => removePayment(s, id));
    notify('Платёж удалён из реестра');
    if (paymentEditId === id) closePaymentForm();
  }

  return (
    <div className="fin">
      <div className="fin-top">
        <div className="fin-tabs" role="tablist" aria-label="Раздел">
          <button type="button" role="tab" aria-selected={view === 'month'} className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>Помесячно</button>
          <button type="button" role="tab" aria-selected={view === 'year'} className={view === 'year' ? 'active' : ''} onClick={() => setView('year')}>По году</button>
          <button type="button" role="tab" aria-selected={view === 'payments'} className={view === 'payments' ? 'active' : ''} onClick={() => setView('payments')}>Платежи</button>
        </div>
        {view === 'payments' ? (
          <button type="button" className="primary-button fin-add" onClick={openCreatePayment}>
            <Icon name="plus" size={16} /> Добавить платёж
          </button>
        ) : (
          <button type="button" className="primary-button fin-add" onClick={() => openCreate('expense')}>
            <Icon name="plus" size={16} /> Добавить запись
          </button>
        )}
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
      ) : view === 'year' ? (
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
      ) : (
        <>
          {dueSoon.length > 0 && (
            <section className="fin-soon">
              <h2>Ближайшие 7 дней</h2>
              <div className="fin-soon-strip">
                {dueSoon.map((p) => (
                  <div className="fin-soon-item" key={p.id}>
                    <span aria-hidden="true">{p.icon}</span>
                    <span className="fin-soon-text">
                      <strong>{p.name}</strong>
                      <small>{p.amount === null ? 'уточнить' : money(p.amount)} · {daysLeftLabel(daysUntilPayment(p.nextDate))}</small>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="fin-kpis">
            <div className="panel fin-kpi">
              <span>Следующий платёж</span>
              <b>{upcoming ? (upcoming.amount === null ? 'уточнить' : money(upcoming.amount)) : '—'}</b>
              <em>{upcoming ? `${paymentDayLabel(upcoming.nextDate)} · ${upcoming.name}` : 'реестр пуст'}</em>
            </div>
            <div className="panel fin-kpi">
              <span>Подписки в этом месяце</span>
              <b>{thisMonthPayments.length ? money(thisMonthPaymentsTotal) : '—'}</b>
              <em>
                {thisMonthPayments.length
                  ? `${thisMonthPayments.length} ${wordRecords(thisMonthPayments.length)}${thisMonthPaymentsUnknown ? `, ${thisMonthPaymentsUnknown} без суммы` : ''}`
                  : 'в этом месяце платежей нет'}
              </em>
            </div>
            <div className="panel fin-kpi">
              <span>Платежей в реестре</span>
              <b>{allPayments.length}</b>
              <em>регулярных и разовых</em>
            </div>
          </div>

          <section className="panel fin-list">
            <div className="section-heading">
              <div><h2>Реестр</h2><p>Коммуналка, подписки и другие обязательства</p></div>
              <span className="count-chip">{filteredPayments.length}</span>
            </div>
            <div className="fin-payment-filters">
              {paymentFilterIds.map((id) => (
                <button
                  type="button"
                  key={id}
                  className={paymentFilter === id ? 'active' : ''}
                  onClick={() => setPaymentFilter(id)}
                >
                  {id === 'all' ? 'Все' : paymentGroupLabels[id]}
                </button>
              ))}
            </div>
            {sortedFilteredPayments.length === 0 ? (
              <p className="fin-empty">Пока нет платежей в этой категории. Добавь первый.</p>
            ) : (
              <div className="fin-rows">
                {sortedFilteredPayments.map((p) => {
                  const pending = isPendingPayment(p);
                  const days = daysUntilPayment(p.nextDate);
                  const editing = paymentEditId === p.id && paymentForm;
                  return (
                    <div className="fin-payment-row" key={p.id}>
                      <div className="fin-row">
                        <button type="button" className="fin-row-main" onClick={() => (editing ? closePaymentForm() : openEditPayment(p))}>
                          {matchBrand(p.name) ? (
                            <span className="fin-row-icon fin-brand-icon" aria-hidden="true">
                              <BrandIcon name={p.name} size={17} />
                            </span>
                          ) : (
                            <span className="fin-row-icon" aria-hidden="true">{p.icon}</span>
                          )}
                          <span className="fin-row-text">
                            <strong>{p.name}</strong>
                            <small>
                              {pending
                                ? '⏳ ждёт синхронизации'
                                : `след. платёж ${paymentDayLabel(p.nextDate)} · ${p.autopay ? 'автосписание' : 'вручную'}`}
                            </small>
                          </span>
                          <span className="fin-payment-badge">{paymentIntervalLabel(p.interval)}</span>
                          <span className={pending ? 'fin-row-amount fin-payment-status' : days < 0 ? 'fin-row-amount negative' : 'fin-row-amount'}>
                            {pending ? 'ждёт' : daysLeftLabel(days)}
                          </span>
                          <strong className={p.amount === null ? 'fin-payment-amount unknown' : 'fin-payment-amount'}>
                            {p.amount === null ? 'уточнить' : money(p.amount)}
                          </strong>
                        </button>
                        <button type="button" className="icon-button" aria-label={`Удалить платёж: ${p.name}`} onClick={() => removePaymentEntry(p.id)}>
                          <Icon name="trash" size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
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

      {paymentForm && (
        <div className="fin-modal-backdrop" role="presentation" onClick={closePaymentForm}>
          <section className="panel fin-modal" role="dialog" aria-label={paymentEditId ? 'Изменить платёж' : 'Новый платёж'} onClick={(e) => e.stopPropagation()}>
            <div className="section-heading">
              <h2>{paymentEditId ? 'Изменить платёж' : 'Новый платёж'}</h2>
              <button type="button" className="icon-button" aria-label="Закрыть" onClick={closePaymentForm}><Icon name="close" size={18} /></button>
            </div>
            <label className="fin-field">Название
              <input value={paymentForm.name} onChange={(e) => setPaymentForm({ ...paymentForm, name: e.target.value })} maxLength={60} placeholder="Например, VPN" autoFocus />
            </label>
            <label className="fin-field">Иконка (эмодзи)
              <input value={paymentForm.icon} onChange={(e) => setPaymentForm({ ...paymentForm, icon: e.target.value })} maxLength={4} className="fin-icon-input" />
            </label>
            <div className="fin-field">
              <span>Группа</span>
              <div className="fin-category-grid">
                {(['housing', 'subs', 'credit', 'other'] as PaymentGroup[]).map((g) => (
                  <button type="button" key={g} className={paymentForm.group === g ? 'active' : ''} onClick={() => setPaymentForm({ ...paymentForm, group: g })}>
                    {paymentGroupLabels[g]}
                  </button>
                ))}
              </div>
            </div>
            <label className="fin-checkbox">
              <input type="checkbox" checked={paymentForm.unknown} onChange={(e) => setPaymentForm({ ...paymentForm, unknown: e.target.checked })} />
              Сумма и дата пока не известны (например, ждёт синхронизации с другим сервисом)
            </label>
            {!paymentForm.unknown && (
              <>
                <label className="fin-field">Сумма, ₽ (необязательно, если пока не известна)
                  <input inputMode="decimal" placeholder="уточнить" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                </label>
                <div className="fin-field">
                  <span>Периодичность</span>
                  <div className="fin-category-grid">
                    {paymentIntervalChoices.map((c) => (
                      <button type="button" key={String(c.interval)} className={paymentForm.interval === c.interval ? 'active' : ''} onClick={() => setPaymentForm({ ...paymentForm, interval: c.interval })}>
                        {c.label}
                      </button>
                    ))}
                    <button type="button" className={paymentForm.interval === 'unknown' ? 'active' : ''} onClick={() => setPaymentForm({ ...paymentForm, interval: 'unknown' })}>
                      Уточнить период
                    </button>
                  </div>
                </div>
                <label className="fin-field">Следующий платёж
                  <input type="date" value={paymentForm.nextDate} onChange={(e) => setPaymentForm({ ...paymentForm, nextDate: e.target.value })} />
                </label>
                <label className="fin-checkbox">
                  <input type="checkbox" checked={paymentForm.autopay} onChange={(e) => setPaymentForm({ ...paymentForm, autopay: e.target.checked })} />
                  Списывается автоматически
                </label>
              </>
            )}
            <label className="fin-field">Заметка (необязательно)
              <input value={paymentForm.note} onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })} maxLength={300} />
            </label>
            <div className="fin-modal-actions">
              {paymentEditId && <button type="button" className="icon-button outlined" aria-label="Удалить платёж" onClick={() => removePaymentEntry(paymentEditId)}><Icon name="trash" size={16} /></button>}
              <button type="button" className="secondary-button" onClick={closePaymentForm}>Отмена</button>
              <button type="button" className="primary-button" disabled={!paymentForm.name.trim()} onClick={savePayment}>{paymentEditId ? 'Сохранить' : 'Добавить'}</button>
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
