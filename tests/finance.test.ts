import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/game.ts';
import {
  addCategory,
  addTransaction,
  categoryBreakdown,
  defaultFinanceCategories,
  financeCategories,
  financeYears,
  removeTransaction,
  totals,
  transactions,
  updateTransaction,
  validFinanceCategories,
  validFinanceTransactions,
  yearMonthlySeries,
} from '../src/finance.ts';

const now = new Date(2026, 9, 29, 12); // 2026-10-29

test('добавление траты и дохода считает итоги и остаток', () => {
  let state = initialState();
  state = addTransaction(state, { type: 'expense', amount: 1500, categoryId: 'groceries', date: '2026-10-05' }, now);
  state = addTransaction(state, { type: 'income', amount: 90000, categoryId: 'salary', date: '2026-10-01' }, now);
  const list = transactions(state);
  assert.equal(list.length, 2);
  const t = totals(list);
  assert.equal(t.expense, 1500);
  assert.equal(t.income, 90000);
  assert.equal(t.net, 88500);
});

test('отклоняет запись с категорией не того типа, с отрицательной или нечисловой суммой', () => {
  const state = initialState();
  assert.throws(() => addTransaction(state, { type: 'expense', amount: 100, categoryId: 'salary', date: '2026-10-05' }, now));
  assert.throws(() => addTransaction(state, { type: 'expense', amount: -5, categoryId: 'groceries', date: '2026-10-05' }, now));
  assert.throws(() => addTransaction(state, { type: 'expense', amount: NaN, categoryId: 'groceries', date: '2026-10-05' }, now));
  assert.throws(() => addTransaction(state, { type: 'expense', amount: 100, categoryId: 'groceries', date: '2026/10/05' }, now));
});

test('updateTransaction меняет сумму и категорию существующей записи, не трогая остальные', () => {
  let state = initialState();
  state = addTransaction(state, { type: 'expense', amount: 100, categoryId: 'groceries', date: '2026-10-05' }, now);
  const id = transactions(state)[0].id;
  state = updateTransaction(state, id, { type: 'expense', amount: 250, categoryId: 'transport', date: '2026-10-06', note: 'такси' });
  const t = transactions(state)[0];
  assert.equal(t.amount, 250);
  assert.equal(t.categoryId, 'transport');
  assert.equal(t.note, 'такси');
});

test('removeTransaction убирает только указанную запись', () => {
  let state = initialState();
  state = addTransaction(state, { type: 'expense', amount: 100, categoryId: 'groceries', date: '2026-10-05' }, now);
  state = addTransaction(state, { type: 'expense', amount: 200, categoryId: 'cafe', date: '2026-10-06' }, now);
  const [first, second] = transactions(state);
  state = removeTransaction(state, first.id);
  assert.deepEqual(transactions(state).map((t) => t.id), [second.id]);
});

test('addCategory создаёт свою категорию без пересечения id со стандартными', () => {
  let state = initialState();
  state = addCategory(state, { name: 'Продукты', icon: '🛒', type: 'expense' });
  const custom = financeCategories(state).filter((c) => c.custom);
  assert.equal(custom.length, 1);
  assert.notEqual(custom[0].id, 'groceries');
  assert.equal(custom[0].name, 'Продукты');
});

test('categoryBreakdown считает сумму, долю и сортирует по убыванию для нужного типа операций', () => {
  let state = initialState();
  state = addTransaction(state, { type: 'expense', amount: 300, categoryId: 'groceries', date: '2026-10-01' }, now);
  state = addTransaction(state, { type: 'expense', amount: 700, categoryId: 'groceries', date: '2026-10-02' }, now);
  state = addTransaction(state, { type: 'expense', amount: 200, categoryId: 'cafe', date: '2026-10-03' }, now);
  state = addTransaction(state, { type: 'income', amount: 1000, categoryId: 'salary', date: '2026-10-04' }, now);
  const rows = categoryBreakdown(state, transactions(state), 'expense');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].category.id, 'groceries');
  assert.equal(rows[0].amount, 1000);
  assert.equal(rows[0].count, 2);
  assert.equal(Math.round(rows[0].share), 83);
  assert.equal(rows[1].category.id, 'cafe');
});

test('yearMonthlySeries возвращает 12 месяцев с нулями там, где записей нет', () => {
  let state = initialState();
  state = addTransaction(state, { type: 'expense', amount: 500, categoryId: 'groceries', date: '2026-03-10' }, now);
  const series = yearMonthlySeries(state, '2026');
  assert.equal(series.length, 12);
  assert.equal(series[2].month, '2026-03');
  assert.equal(series[2].expense, 500);
  assert.equal(series[0].expense, 0);
});

test('financeYears всегда включает текущий год, даже без записей', () => {
  const state = initialState();
  const years = financeYears(state, now);
  assert.ok(years.includes('2026'));
});

test('validFinanceTransactions отклоняет запись с неизвестной категорией и принимает валидные данные', () => {
  const ids = new Set(defaultFinanceCategories.map((c) => c.id));
  assert.equal(
    validFinanceTransactions(
      [{ id: 'a', type: 'expense', amount: 10, categoryId: 'groceries', date: '2026-10-01', createdAt: now.toISOString(), source: 'manual' }],
      ids,
    ),
    true,
  );
  assert.equal(
    validFinanceTransactions(
      [{ id: 'a', type: 'expense', amount: 10, categoryId: 'unknown-category', date: '2026-10-01', createdAt: now.toISOString(), source: 'manual' }],
      ids,
    ),
    false,
  );
});

test('validFinanceCategories отклоняет дубликаты id', () => {
  assert.equal(
    validFinanceCategories([
      { id: 'own', name: 'Своя', icon: '🏷️', type: 'expense', custom: true },
      { id: 'own', name: 'Другая', icon: '🏷️', type: 'expense', custom: true },
    ]),
    false,
  );
});
