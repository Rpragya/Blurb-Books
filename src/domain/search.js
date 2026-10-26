import { GENRES, INTEREST_TAGS, LANGUAGES } from './taxonomy';

export const PAGE_SIZE = 12;

export const DEFAULT_SEARCH = {
  q: '',
  genres: [],
  languages: [],
  tags: [],
  availability: 'any',
  sort: 'relevance',
  page: 1,
};

const SORTS = ['relevance', 'title', 'author', 'newest', 'published'];
const AVAILABILITY = ['any', 'borrow-now', 'on-shelf'];

function pickList(values, allowed) {
  const set = new Set();
  for (const raw of values.flatMap((v) => v.split(','))) {
    if ((allowed).includes(raw)) set.add(raw);
  }
  return [...set];
}

/** Parse untrusted URL params into valid search state, dropping anything unknown. */
export function parseSearchParams(params) {
  const sort = params.get('sort');
  const availability = params.get('avail');
  const page = Number.parseInt(params.get('page') ?? '1', 10);
  return {
    q: (params.get('q') ?? '').slice(0, 100),
    genres: pickList(params.getAll('genre'), Object.keys(GENRES)),
    languages: pickList(params.getAll('lang'), Object.keys(LANGUAGES)),
    tags: pickList(params.getAll('tag'), Object.keys(INTEREST_TAGS)),
    availability: availability && AVAILABILITY.includes(availability) ? availability : 'any',
    sort: sort && SORTS.includes(sort) ? sort : 'relevance',
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 999) : 1,
  };
}

/** Serialise search state, omitting defaults so URLs stay short and shareable. */
export function toSearchParams(state) {
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

export function activeFilterCount(s) {
  return s.genres.length + s.languages.length + s.tags.length + (s.availability !== 'any' ? 1 : 0);
}

export function hasAnyCriteria(s) {
  return s.q.trim() !== '' || activeFilterCount(s) > 0;
}

/** Fold accents and case so "Les Miserables" finds "Les Misérables". */
export function normalise(text) {
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
  query,
  record,
) {
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

export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
