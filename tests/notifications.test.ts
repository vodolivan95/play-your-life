import test from 'node:test';
import assert from 'node:assert/strict';
import { psychologyReminderDue, readOpenRoute, weekKey } from '../src/systemNotify.ts';
import { isFreshInbox } from '../src/ourInbox.ts';
import { emptyKnowledgeBase, importSharedArticle, KB_SHARED_SPACE_ID } from '../src/knowledgeBase.ts';

test('напоминание о психологии: только в пятницу с 10:00 и один раз за неделю', () => {
  const fri = new Date(2026, 10, 20, 10, 5);
  assert.equal(psychologyReminderDue(fri, null), true);
  assert.equal(psychologyReminderDue(fri, weekKey(fri)), false);
  assert.equal(psychologyReminderDue(new Date(2026, 10, 20, 9, 30), null), false);
  assert.equal(psychologyReminderDue(new Date(2026, 10, 19, 12, 0), null), false);
  assert.equal(psychologyReminderDue(new Date(2026, 10, 27, 11, 0), weekKey(fri)), true);
});

test('ссылка из уведомления #open=<раздел>', () => {
  assert.equal(readOpenRoute('#open=psychology'), 'psychology');
  assert.equal(readOpenRoute('#our/chat'), null);
});

test('входящие: только новые записи для меня', () => {
  const base = { id: '1', authorId: 'b', to: 'a', at: 1, kind: 'task', title: 'Купить', status: 'new' } as const;
  assert.equal(isFreshInbox(base, 'a'), true);
  assert.equal(isFreshInbox({ ...base, status: 'taken' }, 'a'), false);
  assert.equal(isFreshInbox(base, 'b'), false);
  assert.equal(isFreshInbox({ ...base, title: '  ' }, 'a'), false);
});

test('статья от партнёра попадает в «Поделились со мной»', () => {
  const kb = importSharedArticle(emptyKnowledgeBase(), { title: 'Идея', html: '<p>Текст</p>', from: 'Иван' });
  const again = importSharedArticle(kb, { title: 'Вторая', html: '<p>2</p>', from: 'Иван' });
  assert.equal(again.spaces.filter((s) => s.id === KB_SHARED_SPACE_ID).length, 1);
  const got = again.articles.filter((a) => a.spaceId === KB_SHARED_SPACE_ID);
  assert.equal(got.length, 2);
  assert.equal(got[0].html, '<p>Текст</p>');
  assert.equal(got[0].status, 'published');
  assert.equal(got[0].author, 'Иван');
});
