import type { GenreId, InterestTagId, LanguageCode } from './types';
import { GENRES, INTEREST_TAGS, LANGUAGES } from './taxonomy';

export type AvailabilityFilter = 'any' | 'borrow-now' | 'on-shelf';
export type SortKey = 'relevance' | 'title' | 'author' | 'newest' | 'published';

export interface SearchParams {
  q: string;
  genres: GenreId[];
  languages: LanguageCode[];
  tags: InterestTagId[];
  availability: AvailabilityFilter;
  sort: SortKey;
  page: number;
}

export const PAGE_SIZE = 12;

export const DEFAULT_SEARCH: SearchParams = {
  q: '',
  genres: [],
  languages: [],
  tags: [],
  availability: 'any',
  sort: 'relevance',
  page: 1,
};

const SORTS: SortKey[] = ['relevance', 'title', 'author', 'newest', 'published'];
const AVAILABILITY: AvailabilityFilter[] = ['any', 'borrow-now', 'on-shelf'];

function pickList<T extends string>(values: string[], allowed: readonly T[]): T[] {
  const set = new Set<T>();
  for (const raw of values.flatMap((v) => v.split(','))) {
    if ((allowed as readonly string[]).includes(raw)) set.add(raw as T);
  }
  return [...set];
}

/** Parse untrusted URL params into valid search state, dropping anything unknown. */
export function parseSearchParams(params: URLSearchParams): SearchParams {
  const sort = params.get('sort') as SortKey | null;
  const availability = params.get('avail') as AvailabilityFilter | null;
  const page = Number.parseInt(params.get('page') ?? '1', 10);
  return {
    q: (params.get('q') ?? '').slice(0, 100),
    genres: pickList(params.getAll('genre'), Object.keys(GENRES) as GenreId[]),
    languages: pickList(params.getAll('lang'), Object.keys(LANGUAGES) as LanguageCode[]),
    tags: pickList(params.getAll('tag'), Object.keys(INTEREST_TAGS) as InterestTagId[]),
    availability: availability && AVAILABILITY.includes(availability) ? availability : 'any',
    sort: sort && SORTS.includes(sort) ? sort : 'relevance',
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 999) : 1,
  };
}

/** Serialise search state, omitting defaults so URLs stay short and shareable. */
export function toSearchParams(state: Partial<SearchParams>): URLSearchParams {
  const s = { ...DEFAULT_SEARCH, ...state };
  const params = new URLSearchParams();
  if (s.q.trim()) params.set('q', s.q.trim());
  for (const g of s.genres) params.append('genre', g);
  for (const l of s.languages) params.append('lang', l);
  for (const t of s.tags) params.append('tag', t);
  if (s.availability !== 'any') params.set('avail', s.availability);
  if (s.sort !== 'relevance') params.set('sort', s.sort);
  if (s.page > 1) params.set('page', String(s.page));
  return params;
}

export function activeFilterCount(s: SearchParams): number {
  return s.genres.length + s.languages.length + s.tags.length + (s.availability !== 'any' ? 1 : 0);
}

export function hasAnyCriteria(s: SearchParams): boolean {
  return s.q.trim() !== '' || activeFilterCount(s) > 0;
}

/** Fold accents and case so "Les Miserables" finds "Les Misérables". */
export function normalise(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Relevance score for a free-text query. Every query term must match title,
 * author or tags/themes; title and author matches rank highest.
 */
export function scoreMatch(
  query: string,
  record: { title: string; authors: string[]; keywords: string[] },
): number {
  const terms = normalise(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 1;
  const title = normalise(record.title);
  const authors = normalise(record.authors.join(' '));
  const keywords = normalise(record.keywords.join(' '));
  let score = 0;
  for (const term of terms) {
    if (title.startsWith(term)) score += 6;
    else if (new RegExp(`\\b${escapeRegExp(term)}`).test(title)) score += 4;
    else if (new RegExp(`\\b${escapeRegExp(term)}`).test(authors)) score += 3;
    else if (keywords.includes(term)) score += 1;
    else return 0;
  }
  return score;
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
