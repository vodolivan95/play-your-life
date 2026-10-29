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

// Реестр регулярных и разовых платежей (коммуналка, подписки, кредиты) — отдельно от
// операций выше: здесь не факт прошлой траты, а план будущего платежа с датой и
// периодичностью. Перенесён из согласованного с Иваном прототипа Claude Design
// («Финансы — редизайн вкладки», артборд «Реестр платежей»).
export type PaymentInterval = number | 'once' | 'unknown';
// число — раз в столько месяцев; 'once' — разовый платёж без повторения;
// 'unknown' — повторяется, но периодичность пока не указана.

export type PaymentGroup = 'housing' | 'subs' | 'credit' | 'other';

export const paymentGroupLabels: Record<PaymentGroup, string> = {
  housing: 'Жильё',
  subs: 'Подписки',
  credit: 'Кредиты',
  other: 'Разовые',
};

export const paymentIntervalChoices: { interval: PaymentInterval; label: string }[] = [
  { interval: 1, label: 'Ежемесячно' },
  { interval: 3, label: 'Раз в 3 месяца' },
  { interval: 6, label: 'Раз в полгода' },
  { interval: 12, label: 'Ежегодно' },
  { interval: 'once', label: 'Разово' },
];

export function paymentIntervalLabel(interval: PaymentInterval): string {
  if (interval === 'unknown') return 'Уточнить период';
  if (interval === 'once') return 'Разово';
  const found = paymentIntervalChoices.find((c) => c.interval === interval);
  return found ? found.label : `Раз в ${interval} мес.`;
}

export type PaymentEntry = {
  id: string;
  name: string;
  icon: string;
  /** Сумма в рублях; null — сумма пока не известна («уточнить»). */
  amount: number | null;
  interval: PaymentInterval;
  /** 'YYYY-MM-DD'; пустая строка — дата следующего платежа пока не известна (ждёт
   * внешней синхронизации, например кредитная карта до подключения ZenMoney). */
  nextDate: string;
  group: PaymentGroup;
  autopay: boolean;
  note?: string;
  createdAt: string;
};

export const MAX_FINANCE_PAYMENTS = 200;
const MAX_PAYMENT_NAME = 60;

export function payments(state: GameState): PaymentEntry[] {
  return state.financePayments ?? [];
}

/** Платёж без известной даты считается ждущим синхронизации — он не попадает в
 * «Ближайшие 7 дней» и всегда уходит в конец отсортированного списка. */
export function isPendingPayment(p: PaymentEntry): boolean {
  return p.nextDate === '';
}

/** Целых дней до следующего платежа; Infinity — дата не известна (см. isPendingPayment). */
export function daysUntilPayment(nextDate: string, now = new Date()): number {
  if (!nextDate) return Infinity;
  const target = new Date(`${nextDate}T00:00:00`).getTime();
  const today = new Date(`${now.toISOString().slice(0, 10)}T00:00:00`).getTime();
  return Math.round((target - today) / 86400000);
}

/** От ближней даты к сегодняшнему дню сверху; платежи без даты — всегда внизу. */
export function sortedPayments(list: PaymentEntry[], now = new Date()): PaymentEntry[] {
  return [...list].sort((a, b) => daysUntilPayment(a.nextDate, now) - daysUntilPayment(b.nextDate, now));
}

export function paymentsDueSoon(list: PaymentEntry[], now = new Date(), withinDays = 7): PaymentEntry[] {
  return sortedPayments(list, now).filter((p) => {
    const days = daysUntilPayment(p.nextDate, now);
    return days >= 0 && days <= withinDays;
  });
}

export type PaymentInput = {
  name: string;
  icon: string;
  amount: number | null;
  interval: PaymentInterval;
  nextDate: string;
  group: PaymentGroup;
  autopay: boolean;
  note?: string;
};

const paymentDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const isPaymentGroup = (v: unknown): v is PaymentGroup =>
  v === 'housing' || v === 'subs' || v === 'credit' || v === 'other';
const isPaymentInterval = (v: unknown): v is PaymentInterval =>
  v === 'once' || v === 'unknown' || (typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 36);

function validPaymentInput(input: PaymentInput) {
  const name = input.name.trim();
  const icon = input.icon.trim();
  return (
    !!name &&
    name.length <= MAX_PAYMENT_NAME &&
    !!icon &&
    icon.length <= 8 &&
    (input.amount === null ||
      (Number.isFinite(input.amount) && input.amount > 0 && input.amount <= MAX_FINANCE_AMOUNT)) &&
    isPaymentInterval(input.interval) &&
    (input.nextDate === '' || paymentDatePattern.test(input.nextDate)) &&
    isPaymentGroup(input.group) &&
    (input.note === undefined || input.note.length <= MAX_FINANCE_NOTE)
  );
}

export function addPayment(state: GameState, input: PaymentInput, now = new Date()): GameState {
  if (!validPaymentInput(input)) throw new Error('Проверь название, сумму, период и дату платежа.');
  const list = payments(state);
  if (list.length >= MAX_FINANCE_PAYMENTS) throw new Error('Слишком много платежей в реестре.');
  const item: PaymentEntry = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    icon: input.icon.trim(),
    amount: input.amount,
    interval: input.interval,
    nextDate: input.nextDate,
    group: input.group,
    autopay: input.autopay,
    note: input.note?.trim() || undefined,
    createdAt: now.toISOString(),
  };
  return { ...state, financePayments: [...list, item] };
}

export function updatePayment(state: GameState, id: string, input: PaymentInput): GameState {
  if (!validPaymentInput(input)) throw new Error('Проверь название, сумму, период и дату платежа.');
  const list = payments(state);
  if (!list.some((p) => p.id === id)) return state;
  return {
    ...state,
    financePayments: list.map((p) =>
      p.id === id
        ? {
            ...p,
            name: input.name.trim(),
            icon: input.icon.trim(),
            amount: input.amount,
            interval: input.interval,
            nextDate: input.nextDate,
            group: input.group,
            autopay: input.autopay,
            note: input.note?.trim() || undefined,
          }
        : p,
    ),
  };
}

export function removePayment(state: GameState, id: string): GameState {
  const list = payments(state);
  if (!list.some((p) => p.id === id)) return state;
  return { ...state, financePayments: list.filter((p) => p.id !== id) };
}

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

export function validFinancePayments(value: unknown): value is PaymentEntry[] {
  if (!Array.isArray(value) || value.length > MAX_FINANCE_PAYMENTS) return false;
  const ids = new Set<string>();
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.id !== 'string' ||
      !idPattern.test(item.id) ||
      typeof item.name !== 'string' ||
      !item.name.trim() ||
      item.name.length > MAX_PAYMENT_NAME ||
      typeof item.icon !== 'string' ||
      !item.icon ||
      item.icon.length > 8 ||
      !(
        item.amount === null ||
        (typeof item.amount === 'number' &&
          Number.isFinite(item.amount) &&
          item.amount > 0 &&
          item.amount <= MAX_FINANCE_AMOUNT)
      ) ||
      !isPaymentInterval(item.interval) ||
      typeof item.nextDate !== 'string' ||
      (item.nextDate !== '' && !datePattern.test(item.nextDate)) ||
      !isPaymentGroup(item.group) ||
      typeof item.autopay !== 'boolean' ||
      (item.note !== undefined &&
        (typeof item.note !== 'string' || item.note.length > MAX_FINANCE_NOTE)) ||
      typeof item.createdAt !== 'string' ||
      !Number.isFinite(new Date(item.createdAt).getTime())
    )
      return false;
    if (ids.has(item.id)) return false;
    ids.add(item.id);
  }
  return true;
}
