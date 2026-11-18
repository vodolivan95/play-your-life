import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialState } from '../src/game.ts';
import { importFinanceReport, parseFinanceReport, transactions, categoryBreakdown } from '../src/finance.ts';
import { validateState } from '../src/stateValidation.ts';

const report = {
  format: 'pyl-finance-report', version: 1, title: 'Личный отчёт',
  categories: [{ id: 'lr-in-1', name: 'Бизнес', icon: '💼', type: 'income' }, { id: 'lr-ex-1', name: 'Оплата квартиры', icon: '🏠', type: 'expense' }],
  items: [{ type: 'income', categoryId: 'lr-in-1', month: '2025-01', amount: 50000 }, { type: 'expense', categoryId: 'lr-ex-1', month: '2025-01', amount: 22500 }, { type: 'expense', categoryId: 'нет', month: '2025-01', amount: 1 }],
};

test('импорт личного отчёта: суммы по месяцам, повтор не дублирует, сохранение валидно', () => {
  const parsed = parseFinanceReport(JSON.stringify(report));
  assert.equal(parsed.items.length, 2, 'строка с неизвестной категорией отброшена');
  const base = initialState();
  const once = importFinanceReport(base, parsed);
  assert.equal(once.added, 2);
  assert.equal(transactions(once.state).find((t) => t.categoryId === 'lr-ex-1')?.date, '2025-01-01');
  const twice = importFinanceReport(once.state, parsed);
  assert.equal(transactions(twice.state).length, transactions(once.state).length);
  assert.doesNotThrow(() => validateState(twice.state), 'состояние после импорта проходит проверку сохранения');
  assert.equal(categoryBreakdown(twice.state, transactions(twice.state), 'expense')[0].amount ?? categoryBreakdown(twice.state, transactions(twice.state), 'expense')[0].total, 22500);
  assert.throws(() => parseFinanceReport('{}'));
});

test('раздел «Психология» виден только аккаунту владельца', async () => {
  const { isOwnerEmail } = await import('../src/privateAccess.ts');
  const { visibleNavigation } = await import('../src/navigation.ts');
  assert.equal(await isOwnerEmail(' Sanek.Alex1995@Yandex.ru '), true);
  assert.equal(await isOwnerEmail('someone@example.com'), false);
  assert.equal(await isOwnerEmail(undefined), false);
  assert.ok(visibleNavigation(true).some((i) => i.id === 'psychology'));
  assert.ok(!visibleNavigation(false).some((i) => i.id === 'psychology'));
});
