// Вкладка «Финансы»: личный учёт трат и доходов (реальные деньги, не игровая экономика).
// Хранится отдельно от лайфкоинов/XP и не влияет на них. Структура категорий намеренно
// похожа на ZenMoney, чтобы будущая синхронизация (см. docs/FINANCE.md) могла сопоставлять
// категории по имени/иконке, а не переизобретать список.
import type { GameState } from './game.ts';
import { monthKey, monthLabel, validMonth } from './monthly.ts';
import { validYear, yearKey, yearMonths } from './yearReport.ts';

export type FinanceKind = 'expense' | 'income';

export type FinanceCategory = {
  id: string;
  name: string;
  icon: string;
  type: FinanceKind;
  /** Категория создана игроком, а не входит в стандартный набор. */
  custom?: boolean;
};

export type FinanceTransaction = {
  id: string;
  type: FinanceKind;
  /** Сумма в рублях, всегда положительная; знак задаёт поле type. */
  amount: number;
  categoryId: string;
  /** 'YYYY-MM-DD' */
  date: string;
  note?: string;
  createdAt: string;
  /** Как запись попала в игру; сейчас всегда 'manual', задел под будущую синхронизацию с ZenMoney. */
  source: 'manual' | 'zenmoney';
};

// Пока хранится одним массивом в основном облачном документе (лимит Firestore — 1 МиБ
// на документ). Для ручного ввода этого надолго хватит; если/когда подключится
// синхронизация с ZenMoney и записей станет на порядки больше, записи нужно будет
// шардировать по месяцам так же, как `events` в cloudSplit.ts — это отдельная задача.
export const MAX_FINANCE_TRANSACTIONS = 6000;
export const MAX_FINANCE_CATEGORIES = 60;
export const MAX_FINANCE_NOTE = 300;
export const MAX_FINANCE_AMOUNT = 100000000;

export const defaultFinanceCategories: FinanceCategory[] = [
  { id: 'groceries', name: 'Продукты', icon: '🛒', type: 'expense' },
  { id: 'cafe', name: 'Кафе и рестораны', icon: '🍽️', type: 'expense' },
  { id: 'transport', name: 'Транспорт', icon: '🚗', type: 'expense' },
  { id: 'housing', name: 'Жильё и коммуналка', icon: '🏠', type: 'expense' },
  { id: 'health', name: 'Здоровье и аптека', icon: '💊', type: 'expense' },
  { id: 'clothes', name: 'Одежда и обувь', icon: '👕', type: 'expense' },
  { id: 'entertainment', name: 'Развлечения', icon: '🎬', type: 'expense' },
  { id: 'subscriptions', name: 'Подписки и связь', icon: '📱', type: 'expense' },
  { id: 'education', name: 'Образование', icon: '📚', type: 'expense' },
  { id: 'travel', name: 'Путешествия', icon: '✈️', type: 'expense' },
  { id: 'gifts', name: 'Подарки', icon: '🎁', type: 'expense' },
  { id: 'family', name: 'Семья и дети', icon: '👪', type: 'expense' },
  { id: 'beauty', name: 'Красота и уход', icon: '💅', type: 'expense' },
  { id: 'home-goods', name: 'Товары для дома', icon: '🛋️', type: 'expense' },
  { id: 'other-expense', name: 'Прочие траты', icon: '🧾', type: 'expense' },
  { id: 'salary', name: 'Зарплата', icon: '💼', type: 'income' },
  { id: 'freelance', name: 'Подработка', icon: '🧑‍💻', type: 'income' },
  { id: 'gifts-income', name: 'Подарки и возвраты', icon: '🎉', type: 'income' },
  { id: 'other-income', name: 'Прочие доходы', icon: '💰', type: 'income' },
];
const defaultCategoryIds = new Set(defaultFinanceCategories.map((c) => c.id));

/** Итоговый список категорий: стандартные + свои, свои могут переопределить стандартные по id. */
export function financeCategories(state: GameState): FinanceCategory[] {
  const own = state.financeCategories ?? [];
  const byId = new Map(defaultFinanceCategories.map((c) => [c.id, c]));
  for (const c of own) byId.set(c.id, c);
  return [...byId.values()];
}
export function findCategory(state: GameState, id: string): FinanceCategory | undefined {
  return financeCategories(state).find((c) => c.id === id);
}
export function transactions(state: GameState): FinanceTransaction[] {
  return state.financeTransactions ?? [];
}

function slugify(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-zа-я0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return (base || 'category').slice(0, 40);
}

export function addCategory(
  state: GameState,
  input: { name: string; icon: string; type: FinanceKind },
): GameState {
  const name = input.name.trim().slice(0, 40);
  const icon = input.icon.trim().slice(0, 8) || '🏷️';
  if (!name || (input.type !== 'expense' && input.type !== 'income')) return state;
  const existing = financeCategories(state);
  if (existing.length >= MAX_FINANCE_CATEGORIES) return state;
  let id = slugify(name);
  if (defaultCategoryIds.has(id) || existing.some((c) => c.id === id))
    id = `${id}-${crypto.randomUUID().slice(0, 6)}`;
  const category: FinanceCategory = { id, name, icon, type: input.type, custom: true };
  return { ...state, financeCategories: [...(state.financeCategories ?? []), category] };
}

export type TransactionInput = {
  type: FinanceKind;
  amount: number;
  categoryId: string;
  date: string;
  note?: string;
};

function validInput(state: GameState, input: TransactionInput) {
  const category = findCategory(state, input.categoryId);
  return (
    (input.type === 'expense' || input.type === 'income') &&
    Number.isFinite(input.amount) &&
    input.amount > 0 &&
    input.amount <= MAX_FINANCE_AMOUNT &&
    /^\d{4}-\d{2}-\d{2}$/.test(input.date) &&
    !!category &&
    category.type === input.type &&
    (input.note === undefined || input.note.length <= MAX_FINANCE_NOTE)
  );
}

export function addTransaction(
  state: GameState,
  input: TransactionInput,
  now = new Date(),
): GameState {
  if (!validInput(state, input)) throw new Error('Проверь сумму, категорию и дату.');
  const list = transactions(state);
  if (list.length >= MAX_FINANCE_TRANSACTIONS) throw new Error('Слишком много записей.');
  const item: FinanceTransaction = {
    id: crypto.randomUUID(),
    type: input.type,
    amount: Math.round(input.amount * 100) / 100,
    categoryId: input.categoryId,
    date: input.date,
    note: input.note?.trim() || undefined,
    createdAt: now.toISOString(),
    source: 'manual',
  };
  return { ...state, financeTransactions: [...list, item] };
}

export function updateTransaction(
  state: GameState,
  id: string,
  input: TransactionInput,
): GameState {
  if (!validInput(state, input)) throw new Error('Проверь сумму, категорию и дату.');
  const list = transactions(state);
  if (!list.some((t) => t.id === id)) return state;
  return {
    ...state,
    financeTransactions: list.map((t) =>
      t.id === id
        ? {
            ...t,
            type: input.type,
            amount: Math.round(input.amount * 100) / 100,
            categoryId: input.categoryId,
            date: input.date,
            note: input.note?.trim() || undefined,
          }
        : t,
    ),
  };
}

export function removeTransaction(state: GameState, id: string): GameState {
  const list = transactions(state);
  if (!list.some((t) => t.id === id)) return state;
  return { ...state, financeTransactions: list.filter((t) => t.id !== id) };
}

/** Годы, за которые есть хотя бы одна запись, плюс текущий год. */
export function financeYears(state: GameState, now = new Date()) {
  const current = yearKey(now);
  const years = new Set(transactions(state).map((t) => t.date.slice(0, 4)));
  years.add(current);
  return [...years].sort((a, b) => Number(b) - Number(a));
}

export type FinanceTotals = { expense: number; income: number; net: number; count: number };
export function totals(list: FinanceTransaction[]): FinanceTotals {
  let expense = 0;
  let income = 0;
  for (const t of list) if (t.type === 'expense') expense += t.amount; else income += t.amount;
  return { expense, income, net: income - expense, count: list.length };
}

export type CategoryBreakdownRow = {
  category: FinanceCategory;
  amount: number;
  count: number;
  share: number;
};
/** Траты (или доходы) по категориям за переданные записи, по убыванию суммы. */
export function categoryBreakdown(
  state: GameState,
  list: FinanceTransaction[],
  kind: FinanceKind = 'expense',
): CategoryBreakdownRow[] {
  const filtered = list.filter((t) => t.type === kind);
  const total = filtered.reduce((sum, t) => sum + t.amount, 0);
  const byCategory = new Map<string, { amount: number; count: number }>();
  for (const t of filtered) {
    const row = byCategory.get(t.categoryId) ?? { amount: 0, count: 0 };
    row.amount += t.amount;
    row.count += 1;
    byCategory.set(t.categoryId, row);
  }
  const categories = financeCategories(state);
  return [...byCategory.entries()]
    .map(([categoryId, row]) => {
      const category = categories.find((c) => c.id === categoryId) ?? {
        id: categoryId,
        name: 'Без категории',
        icon: '❔',
        type: kind,
      };
      return { category, amount: row.amount, count: row.count, share: total ? (row.amount / total) * 100 : 0 };
    })
    .sort((a, b) => b.amount - a.amount);
}

export type MonthPoint = { month: string; label: string; expense: number; income: number };
/** Расходы и доходы по всем 12 месяцам выбранного года — для годового графика. */
export function yearMonthlySeries(state: GameState, year: string): MonthPoint[] {
  if (!validYear(year)) throw new Error('Неверный год');
  const list = transactions(state);
  return yearMonths(year).map((month) => {
    const monthList = list.filter((t) => t.date.slice(0, 7) === month);
    const t = totals(monthList);
    return { month, label: monthLabel(month), expense: t.expense, income: t.income };
  });
}

export function monthTransactions(state: GameState, month: string): FinanceTransaction[] {
  if (!validMonth(month)) throw new Error('Неверный месяц');
  return transactions(state).filter((t) => t.date.slice(0, 7) === month);
}

export function yearTransactions(state: GameState, year: string): FinanceTransaction[] {
  if (!validYear(year)) throw new Error('Неверный год');
  return transactions(state).filter((t) => t.date.slice(0, 4) === year);
}

export { monthKey, monthLabel, yearKey };

const idPattern = /^[A-Za-z0-9_-]{1,80}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const isKind = (v: unknown): v is FinanceKind => v === 'expense' || v === 'income';
const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

export function validFinanceCategories(value: unknown): value is FinanceCategory[] {
  if (!Array.isArray(value) || value.length > MAX_FINANCE_CATEGORIES) return false;
  const ids = new Set<string>();
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      !idPattern.test(item.id) ||
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      item.name.length > 40 ||
      typeof item.icon !== 'string' ||
      item.icon.length > 8 ||
      !isKind(item.type) ||
      (item.custom !== undefined && item.custom !== true)
    )
      return false;
    if (ids.has(item.id)) return false;
    ids.add(item.id);
  }
  return true;
}

export function validFinanceTransactions(
  value: unknown,
  categoryIds: Set<string>,
): value is FinanceTransaction[] {
  if (!Array.isArray(value) || value.length > MAX_FINANCE_TRANSACTIONS) return false;
  const ids = new Set<string>();
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      !idPattern.test(item.id) ||
      !isKind(item.type) ||
      typeof item.amount !== 'number' ||
      !Number.isFinite(item.amount) ||
      item.amount <= 0 ||
      item.amount > MAX_FINANCE_AMOUNT ||
      typeof item.categoryId !== 'string' ||
      !categoryIds.has(item.categoryId) ||
      typeof item.date !== 'string' ||
      !datePattern.test(item.date) ||
      (item.note !== undefined &&
        (typeof item.note !== 'string' || item.note.length > MAX_FINANCE_NOTE)) ||
      typeof item.createdAt !== 'string' ||
      !Number.isFinite(new Date(item.createdAt).getTime()) ||
      (item.source !== 'manual' && item.source !== 'zenmoney')
    )
      return false;
    if (ids.has(item.id)) return false;
    ids.add(item.id);
  }
  return true;
}
