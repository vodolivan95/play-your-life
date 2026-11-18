import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spheres } from '../src/game.ts';
import {
  addComment, archiveArticle, breadcrumbs, childrenOf, createArticle, deleteForever, duplicateArticle, emptyKnowledgeBase, emptyTrash,
  htmlToMarkdown, moveArticle, parseKnowledgeBase, purgeTrash, removeSpace, addSpace, restoreArticle, restoreVersion, saveTerm,
  searchArticles, spaceAnalytics, spaceOfSphere, tableOfContents, trashArticle, unarchiveArticle, updateArticle, wordCount,
} from '../src/knowledgeBase.ts';
import { addFolder, createNote, dropIfEmpty, dueReminders, filterNotes, notesCounts, parseNotes, purgeNotes, removeFolder, trashNote, updateNote, emptyNotes } from '../src/sphereNotes.ts';

const now = new Date('2026-11-18T09:00:00Z');

test('база знаний: пустая, с пространством на каждую сферу', () => {
  const kb = emptyKnowledgeBase(spheres, now);
  assert.equal(kb.articles.length, 0);
  assert.equal(kb.spaces.length, spheres.length);
  for (const s of spheres) assert.equal(spaceOfSphere(kb, s.id)?.name, s.name);
  const again = parseKnowledgeBase(JSON.stringify(kb), spheres, now);
  assert.deepEqual(again.spaces.map((s) => s.id), kb.spaces.map((s) => s.id));
  assert.equal(parseKnowledgeBase('{битые', spheres, now).spaces.length, spheres.length);
  assert.equal(removeSpace(kb, kb.spaces[0].id), kb, 'пространство сферы не удаляется');
  const [withOwn, own] = addSpace(kb, { name: 'Рецепты' }, now);
  assert.equal(removeSpace(withOwn, own.id).spaces.length, spheres.length);
});

test('статьи: вложенность, перенос без циклов, крошки, дубли', () => {
  let kb = emptyKnowledgeBase(spheres, now);
  const space = spaceOfSphere(kb, 'health')!.id;
  const [kb1, root] = createArticle(kb, { spaceId: space, title: 'Регламенты', author: 'Я' }, now);
  const [kb2, child] = createArticle(kb1, { spaceId: space, parentId: root.id, templateId: 'regulation', author: 'Я' }, now);
  const [kb3, grand] = createArticle(kb2, { spaceId: space, parentId: child.id, title: 'Внук', author: 'Я' }, now);
  kb = kb3;
  assert.equal(child.title, 'Регламент');
  assert.match(child.html, /Порядок действий/);
  assert.deepEqual(breadcrumbs(kb, grand.id).map((a) => a.id), [root.id, child.id, grand.id]);
  assert.equal(moveArticle(kb, root.id, { parentId: grand.id }), kb, 'нельзя вложить в собственного потомка');
  const other = spaceOfSphere(kb, 'sport')!.id;
  const moved = moveArticle(kb, child.id, { spaceId: other, parentId: null });
  assert.equal(moved.articles.find((a) => a.id === grand.id)!.spaceId, other, 'вложенные переезжают вместе');
  const [dup, copy] = duplicateArticle(kb, child.id, 'Я', true, now);
  assert.equal(copy!.title, 'Регламент (копия)');
  assert.equal(childrenOf(dup, space, copy!.id).length, 1);
});

test('архив, корзина, восстановление и очистка', () => {
  let kb = emptyKnowledgeBase(spheres, now);
  const space = spaceOfSphere(kb, 'growth')!.id;
  const [kb1, a] = createArticle(kb, { spaceId: space, title: 'A', author: 'Я' }, now);
  const [kb2, b] = createArticle(kb1, { spaceId: space, parentId: a.id, title: 'B', author: 'Я' }, now);
  kb = kb2;
  const trashed = trashArticle(kb, a.id, now);
  assert.equal(childrenOf(trashed, space, null).length, 0);
  assert.ok(trashed.articles.find((x) => x.id === b.id)!.deletedAt);
  const restoredChild = restoreArticle(trashed, b.id);
  assert.equal(restoredChild.articles.find((x) => x.id === b.id)!.parentId, null, 'без живого родителя — на верхний уровень');
  assert.equal(purgeTrash(trashed, new Date('2027-01-01')).articles.length, 0);
  assert.equal(emptyTrash(trashed).articles.length, 0);
  assert.equal(deleteForever(kb, a.id).articles.length, 0);
  const archived = archiveArticle(kb, a.id, now);
  assert.equal(childrenOf(archived, space, null).length, 0);
  assert.equal(childrenOf(unarchiveArticle(archived, a.id), space, null).length, 1);
});

test('история версий, комментарии, поиск, оглавление, аналитика, экспорт', () => {
  let kb = emptyKnowledgeBase(spheres, now);
  const space = spaceOfSphere(kb, 'finance')!.id;
  const [kb1, a] = createArticle(kb, { spaceId: space, title: 'Бюджет', author: 'Я' }, now);
  kb = kb1;
  kb = updateArticle(kb, a.id, { html: '<h2>Доходы</h2><p>Зарплата и бонусы</p>' }, { now });
  kb = updateArticle(kb, a.id, { html: '<h2>Доходы</h2><p>Только зарплата</p>' }, { now: new Date(now.getTime() + 60_000) });
  assert.equal(kb.articles[0].versions.length, 1, 'частые правки — один снимок');
  kb = updateArticle(kb, a.id, { html: '<h2>Расходы</h2>' }, { now: new Date(now.getTime() + 10 * 60_000) });
  const art = kb.articles[0];
  assert.equal(art.versions.length, 2);
  kb = restoreVersion(kb, a.id, art.versions[1].id, 'Я', new Date(now.getTime() + 11 * 60_000));
  assert.match(kb.articles[0].html, /Только зарплата/);
  kb = addComment(kb, a.id, '  Проверить  ', 'Я', undefined, now);
  assert.equal(kb.articles[0].comments[0].text, 'Проверить');
  assert.equal(searchArticles(kb, 'зарплата')[0].article.id, a.id);
  assert.equal(searchArticles(kb, 'нет такого').length, 0);
  assert.deepEqual(tableOfContents('<h1>A</h1><p>x</p><h3>B&amp;C</h3>').map((h) => h.text), ['A', 'B&C']);
  assert.deepEqual(wordCount('<p>Два слова</p>'), { words: 2, chars: 9 });
  assert.equal(spaceAnalytics(kb, space, now).total, 1);
  assert.match(htmlToMarkdown('T', '<h2>Шаги</h2><ul><li data-checked="true">Готово</li></ul>'), /## Шаги[\s\S]*- \[x\] Готово/);
  kb = saveTerm(kb, { spaceId: space, term: ' ROI ', definition: 'Окупаемость' }, now);
  assert.equal(kb.glossary[0].term, 'ROI');
});

test('заметки: создание, фильтры, папки, корзина, напоминания', () => {
  let data = emptyNotes();
  const [d1, n] = createNote(data, { sphereId: 'health', author: 'Я' }, now);
  data = d1;
  assert.equal(dropIfEmpty(data, n.id).notes.length, 0, 'пустая заметка не сохраняется');
  data = updateNote(data, n.id, { title: 'Анализы', html: '<p>Сдать кровь</p>', pinned: true, reminderAt: '2026-11-18T08:00:00Z' }, now);
  const [d2, f] = addFolder(data, 'health', 'Врачи', now);
  data = d2;
  data = updateNote(data, n.id, { folderId: f!.id }, now);
  assert.equal(filterNotes(data, 'health', 'pinned', null, '').length, 1);
  assert.equal(filterNotes(data, 'health', 'all', f!.id, 'кровь').length, 1);
  assert.equal(filterNotes(data, 'sport', 'all', null, '').length, 0, 'заметки сферы не видны в другой сфере');
  assert.equal(dueReminders(data, now).length, 1);
  assert.equal(removeFolder(data, f!.id).notes[0].folderId, null, 'удаление папки не удаляет заметки');
  data = trashNote(data, n.id, now);
  assert.deepEqual(notesCounts(data, 'health'), { all: 0, pinned: 0, starred: 0, reminders: 0, archive: 0, trash: 1 });
  assert.equal(purgeNotes(data, new Date('2026-12-01')).notes.length, 0);
  assert.equal(parseNotes(JSON.stringify(data), now).notes.length, 1);
  assert.equal(parseNotes('мусор').notes.length, 0);
});

test('импорт базы знаний добавляет новое и не дублирует пространства сфер', async () => {
  const { mergeKnowledgeBase } = await import('../src/knowledgeBase.ts');
  const base = emptyKnowledgeBase(spheres, now);
  const [other, page] = createArticle(emptyKnowledgeBase(spheres, now), { spaceId: spaceOfSphere(base, 'sport')!.id, title: 'Бег', author: 'Я' }, now);
  const once = mergeKnowledgeBase(base, other);
  assert.equal(once.added, 1);
  assert.equal(once.kb.spaces.length, spheres.length);
  assert.equal(mergeKnowledgeBase(once.kb, other).added, 0);
  assert.equal(once.kb.articles[0].id, page.id);
});

test('«Что нового» и проверка версии', async () => {
  const { shouldShowWhatsNew, versionFromHtml, whatsNew } = await import('../src/whatsNew.ts');
  const { readFileSync } = await import('node:fs');
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
  assert.ok(whatsNew[version]?.length, 'для текущей версии есть список изменений');
  assert.equal(versionFromHtml(readFileSync('index.html', 'utf8')), version);
  assert.equal(shouldShowWhatsNew(version, null), true);
  assert.equal(shouldShowWhatsNew(version, version), false);
});
