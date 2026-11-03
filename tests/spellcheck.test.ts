import test from 'node:test';
import assert from 'node:assert/strict';
import nspell from 'nspell';
import english from 'dictionary-en';
import russian from 'dictionary-ru';
import { spellTokens } from '../src/spellcheckText.ts';

const enSpell = nspell({ aff: english.aff.toString('utf8'), dic: english.dic.toString('utf8') });
const ruSpell = nspell({ aff: russian.aff.toString('utf8'), dic: russian.dic.toString('utf8') });

test('RU and EN dictionaries accept common correctly spelled words', () => {
  assert.equal(enSpell.correct('beautiful'), true);
  assert.equal(enSpell.correct('running'), true);
  assert.equal(ruSpell.correct('привет'), true);
  assert.equal(ruSpell.correct('красивый'), true);
});

test('RU and EN dictionaries flag errors and suggest replacements', () => {
  assert.equal(enSpell.correct('helllo'), false);
  assert.ok(enSpell.suggest('helllo').includes('hello'));
  assert.equal(ruSpell.correct('превет'), false);
  assert.ok(ruSpell.suggest('превет').includes('привет'));
});

test('mixed Russian and English text is tokenized to the proper dictionaries', () => {
  const tokens = spellTokens('Ths projct — это хорошый пример.');
  assert.deepEqual(tokens.map(({ word, language }) => [word, language]), [
    ['Ths', 'en'],
    ['projct', 'en'],
    ['это', 'ru'],
    ['хорошый', 'ru'],
    ['пример', 'ru'],
  ]);
});
