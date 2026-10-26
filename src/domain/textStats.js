/**
 * Word statistics and in-text search, ported from the original Blurb
 * SearchString.js (getDocStats / filterStopWords / performMark). The port
 * returns data instead of writing innerHTML, which fixes the original's
 * HTML-injection and unescaped-RegExp issues.
 */
import { escapeRegExp } from './search';

const STOP_WORDS = new Set(
  (
    'a an and are as at be but by for from had has have he her his i if in into is it its me my no not of on or our she so ' +
    'such that the their them then there these they this to was were which who will with would you your him who what when'
  ).split(' '),
);

export function getTextStats(text, top = 6) {
  const words = text.toLowerCase().match(/[\p{L}\p{N}’']+/gu) ?? [];
  const counts = new Map();
  for (const raw of words) {
    const word = raw.replace(/[’']s$/, '').replace(/^[’']|[’']$/g, '');
    if (word.length < 2 || STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const sorted = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    characters: text.length,
    words: words.length,
    mostUsed: sorted.slice(0, top),
    leastUsed: sorted.slice(-top).reverse(),
  };
}

/** Split text into matching and non-matching segments for safe highlighting. */
export function splitMatches(text, query) {
  const q = query.trim();
  if (!q) return [{ text, match: false }];
  const re = new RegExp(`(${escapeRegExp(q)})`, 'gi');
  return text
    .split(re)
    .filter((part) => part !== '')
    .map((part) => ({ text: part, match: part.toLowerCase() === q.toLowerCase() }));
}
