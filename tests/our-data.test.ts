import assert from 'node:assert/strict';
import test from 'node:test';
import { eventVisible, isPairEmail, meetingProtocol, occurrences, openQuestions, questionStatusesAfter, sortGroups, systemGroups, toggleReaction, unreadOf } from '../src/ourData.ts';
import type { Decision, Group, Meeting, Question } from '../src/ourData.ts';

test('шесть тематических групп в порядке ТЗ 5.3', () => {
  assert.deepEqual(systemGroups.map((g) => g.name), ['Общие вопросы', 'Наши квартиры', 'Семья', 'Работа и бизнес', 'Отдых и развлечения', 'Идеи и планы']);
});

test('пара аккаунтов определяется по почте без учёта регистра', () => {
  assert.ok(isPairEmail('Sanek.alex1995@yandex.ru'));
  assert.ok(isPairEmail(' Vodolivan195@gmail.com '));
  assert.ok(!isPairEmail('someone@gmail.com'));
  assert.ok(!isPairEmail(undefined));
});

test('непрочитанные, порядок групп и реакции', () => {
  assert.equal(unreadOf({ id: 'g', count: 7 }, { counts: { g: 4 } }), 3);
  assert.equal(unreadOf({ id: 'g', count: 2 }, null), 2);
  assert.equal(unreadOf({ id: 'g', count: 2 }, { counts: { g: 5 } }), 0);
  const g = (id: string, order: number, pinned = false) => ({ id, order, pinned, at: 0 }) as Group;
  assert.deepEqual(sortGroups([g('a', 1), g('b', 2, true), g('c', 0)]).map((x) => x.id), ['b', 'c', 'a']);
  let r = toggleReaction({}, '👍', 'alex');
  r = toggleReaction(r, '👍', 'ivan');
  assert.deepEqual(r, { '👍': ['alex', 'ivan'] });
  assert.deepEqual(toggleReaction(toggleReaction(r, '👍', 'alex'), '👍', 'ivan'), {});
});

test('календарь: повторы попадают в диапазон, личные чужие не видны', () => {
  const weekly = { start: '2026-11-02T16:00:00.000Z', end: '2026-11-02T18:00:00.000Z', repeat: 'weekly' as const };
  assert.equal(occurrences(weekly, '2026-11-01', '2026-11-30').length, 5);
  assert.equal(occurrences({ ...weekly, repeat: 'none' }, '2026-11-10', '2026-11-30').length, 0);
  assert.equal(occurrences({ ...weekly, repeat: 'monthly' }, '2026-11-01', '2027-02-28').length, 4);
  const shared = { access: 'shared' as const, authorId: 'alex', rsvp: { alex: 'yes', ivan: 'pending' } as Record<string, 'yes' | 'pending'> };
  assert.ok(eventVisible(shared, 'ivan', 'shared'));
  assert.ok(!eventVisible(shared, 'ivan', 'mine'), 'не принятое приглашение — не в «Моём календаре»');
  assert.ok(eventVisible({ ...shared, rsvp: { ...shared.rsvp, ivan: 'yes' } }, 'ivan', 'mine'), 'принятое — появляется');
  const personal = { access: 'personal' as const, authorId: 'alex', rsvp: {} };
  assert.ok(eventVisible(personal, 'alex', 'mine') && eventVisible(personal, 'alex', 'all'));
  assert.ok(!eventVisible(personal, 'alex', 'shared') && !eventVisible(personal, 'ivan', 'all'));
});

test('собрания: статусы вопросов после завершения, протокол и вопросы без решения', () => {
  const q = (id: string, title: string, status: Question['status'] = 'agenda') => ({ id, title, status, authorId: 'alex', at: 0, description: '', category: 'other', priority: 'mid', comments: [] }) as Question;
  const questions = [q('q1', 'Ремонт кухни'), q('q2', 'Отпуск'), q('q3', 'Подарок маме')];
  const m = { id: 'm1', title: 'Ноябрь', date: '2026-11-22', time: '19:00', format: 'offline', location: 'У Ивана', participants: ['alex', 'ivan'], agenda: [{ questionId: 'q1', done: true }, { questionId: 'q2', done: true }, { questionId: 'q3', done: false }], notes: 'Всё хорошо', history: [] } as unknown as Meeting;
  const decisions = [{ id: 'd1', meetingId: 'm1', questionId: 'q1', title: 'Заказать замер', responsible: 'ivan', due: '2026-11-30', status: 'accepted', description: '' } as Decision];
  assert.deepEqual(questionStatusesAfter(m, decisions), { q1: 'solved', q2: 'discussed', q3: 'postponed' });
  const names = (u: string) => ({ alex: 'Александр', ivan: 'Иван' })[u] ?? u;
  const text = meetingProtocol(m, questions, decisions, names);
  for (const part of ['ПРОТОКОЛ: Ноябрь', 'Участники: Александр, Иван', '1. Ремонт кухни', 'Заказать замер', 'ответственный: Иван', 'срок: 2026-11-30', 'Отложенные вопросы:', 'Подарок маме', 'Всё хорошо']) assert.ok(text.includes(part), part);
  assert.deepEqual(openQuestions([q('a', 'a', 'postponed'), q('b', 'b', 'solved'), q('c', 'c', 'proposed')]).map((x) => x.id), ['a', 'c']);
});
