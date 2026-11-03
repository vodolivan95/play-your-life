declare module 'nspell' {
  export interface Spellchecker {
    correct(word: string): boolean;
    suggest(word: string): string[];
  }

  export interface Dictionary {
    aff: string | Uint8Array;
    dic: string | Uint8Array;
  }

  export default function nspell(dictionary: Dictionary): Spellchecker;
}
