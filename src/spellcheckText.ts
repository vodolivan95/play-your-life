export type SpellLanguage = 'en' | 'ru';
export type SpellToken = { start: number; end: number; word: string; language: SpellLanguage };

const TOKEN_PATTERN = /[\p{Script=Cyrillic}]+(?:[’'][\p{Script=Cyrillic}]+)*|[\p{Script=Latin}]+(?:[’'][\p{Script=Latin}]+)*/gu;

export function spellTokens(text: string): SpellToken[] {
  const tokens: SpellToken[] = [];
  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const word = match[0];
    if (word.length < 2) continue;
    const language: SpellLanguage = /\p{Script=Cyrillic}/u.test(word) ? 'ru' : 'en';
    tokens.push({ start: match.index, end: match.index + word.length, word, language });
  }
  return tokens;
}
