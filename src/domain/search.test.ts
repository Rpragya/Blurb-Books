import { describe, expect, it } from 'vitest';
import { DEFAULT_SEARCH, parseSearchParams, scoreMatch, toSearchParams } from './search';

describe('search URL state', () => {
  it('round-trips through URL params', () => {
    const state = { ...DEFAULT_SEARCH, q: 'holmes', genres: ['mystery' as const], languages: ['en' as const], tags: ['page-turners' as const], availability: 'borrow-now' as const, sort: 'title' as const, page: 2 };
    const url = toSearchParams(state).toString();
    expect(url).toBe('q=holmes&genre=mystery&lang=en&tag=page-turners&avail=borrow-now&sort=title&page=2');
    expect(parseSearchParams(new URLSearchParams(url))).toEqual(state);
  });

  it('drops unknown or malformed values', () => {
    const parsed = parseSearchParams(new URLSearchParams('genre=nope&genre=fantasy&sort=bogus&page=-3&avail=x'));
    expect(parsed).toEqual({ ...DEFAULT_SEARCH, genres: ['fantasy'] });
  });

  it('omits defaults', () => {
    expect(toSearchParams(DEFAULT_SEARCH).toString()).toBe('');
  });
});

describe('scoreMatch', () => {
  const record = { title: 'Les Misérables', authors: ['Victor Hugo'], keywords: ['revolution'] };
  it('ignores accents and case', () => expect(scoreMatch('miserables', record)).toBeGreaterThan(0));
  it('requires every term to match', () => expect(scoreMatch('hugo dragons', record)).toBe(0));
  it('ranks title above author', () => expect(scoreMatch('les', record)).toBeGreaterThan(scoreMatch('hugo', record)));
});
