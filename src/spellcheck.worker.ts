import nspell from 'nspell';
import { spellTokens } from './spellcheckText';

type Language = 'en' | 'ru';
type Issue = { start: number; end: number; word: string; language: Language };
type Incoming =
  | { type: 'init'; baseUrl: string }
  | { type: 'check'; requestId: number; text: string }
  | { type: 'suggest'; requestId: number; word: string; language: Language };
type Checker = ReturnType<typeof nspell>;

const checkers = new Map<Language, Checker>();
let initialization: Promise<void> | undefined;
let baseUrl = '';

async function loadDictionary(language: Language): Promise<Checker> {
  const response = await fetch(`${baseUrl}spellcheck/${language}.dict`);
  if (!response.ok || !response.body) {
    throw new Error(`Не удалось загрузить словарь ${language.toUpperCase()}`);
  }
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Этот браузер не поддерживает распаковку локальных словарей');
  }
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  const data = (await new Response(stream).json()) as { aff: string; dic: string };
  return nspell({ aff: data.aff, dic: data.dic });
}

async function ensureDictionaries(): Promise<void> {
  if (!initialization) {
    initialization = Promise.all([
      loadDictionary('en').then(checker => checkers.set('en', checker)),
      loadDictionary('ru').then(checker => checkers.set('ru', checker)),
    ]).then(() => undefined);
  }
  await initialization;
}

function checkText(text: string): Issue[] {
  const issues: Issue[] = [];
  for (const token of spellTokens(text)) {
    const { word, language } = token;
    const checker = checkers.get(language);
    if (checker && !checker.correct(word)) {
      issues.push(token);
    }
  }
  return issues;
}

function preserveCase(original: string, candidate: string): string {
  if (original === original.toLocaleUpperCase()) return candidate.toLocaleUpperCase();
  if (original[0] === original[0]?.toLocaleUpperCase()) {
    return candidate[0]?.toLocaleUpperCase() + candidate.slice(1);
  }
  return candidate;
}

self.onmessage = async (event: MessageEvent<Incoming>) => {
  const message = event.data;
  if (message.type === 'init') {
    baseUrl = message.baseUrl.endsWith('/') ? message.baseUrl : `${message.baseUrl}/`;
    try {
      await ensureDictionaries();
      self.postMessage({ type: 'ready' });
    } catch (error) {
      initialization = undefined;
      self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Не удалось загрузить словари' });
    }
    return;
  }

  try {
    await ensureDictionaries();
    if (message.type === 'check') {
      self.postMessage({ type: 'checked', requestId: message.requestId, issues: checkText(message.text) });
    } else {
      const checker = checkers.get(message.language);
      const suggestions = checker && !checker.correct(message.word)
        ? checker.suggest(message.word).slice(0, 6).map(word => preserveCase(message.word, word))
        : [];
      self.postMessage({ type: 'suggestions', requestId: message.requestId, suggestions });
    }
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Ошибка проверки орфографии' });
  }
};
