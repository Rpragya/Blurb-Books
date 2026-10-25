import type { GenreId, InterestTagId, LanguageCode } from './types';

export const GENRES: Record<GenreId, { label: string; blurb: string }> = {
  mystery: { label: 'Mystery & Crime', blurb: 'Detectives, puzzles and long shadows' },
  fantasy: { label: 'Fantasy', blurb: 'Magic, quests and other worlds' },
  'science-fiction': { label: 'Science Fiction', blurb: 'Futures, machines and big what-ifs' },
  romance: { label: 'Romance', blurb: 'Courtship, longing and second chances' },
  horror: { label: 'Gothic & Horror', blurb: 'Creaking doors and creeping dread' },
  adventure: { label: 'Adventure', blurb: 'Sea voyages, treasure and escapes' },
  literary: { label: 'Literary Fiction', blurb: 'Character-driven classics' },
  children: { label: 'Children’s', blurb: 'Read together or read alone' },
  poetry: { label: 'Poetry', blurb: 'Verse to read slowly' },
  philosophy: { label: 'Philosophy', blurb: 'How to live and think' },
  'non-fiction': { label: 'Non-fiction', blurb: 'Science, history and ideas' },
};

export const LANGUAGES: Record<LanguageCode, string> = {
  en: 'English',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  it: 'Italian',
  ru: 'Russian',
  hi: 'Hindi',
};

export const INTEREST_TAGS: Record<InterestTagId, { label: string; emoji: string }> = {
  'page-turners': { label: 'Page-turners', emoji: '⚡' },
  'cosy-nights': { label: 'Cosy nights in', emoji: '☕' },
  'strange-worlds': { label: 'Strange worlds', emoji: '🪐' },
  'love-and-letters': { label: 'Love & letters', emoji: '✉️' },
  'big-ideas': { label: 'Big ideas', emoji: '💡' },
  'short-reads': { label: 'Short reads', emoji: '⏱️' },
  'first-classics': { label: 'First classics', emoji: '🎓' },
  'read-aloud': { label: 'Read aloud', emoji: '🗣️' },
  'around-the-world': { label: 'Around the world', emoji: '🧭' },
  'unreliable-narrators': { label: 'Unreliable narrators', emoji: '🎭' },
};
