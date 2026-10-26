import type { AvailabilityFilter, SearchParams } from '../../domain/search';
import { GENRES, INTEREST_TAGS, LANGUAGES } from '../../domain/taxonomy';
import type { GenreId, InterestTagId, LanguageCode } from '../../domain/types';

interface FilterPanelProps {
  params: SearchParams;
  onChange: (patch: Partial<SearchParams>) => void;
  idPrefix: string;
}

const AVAILABILITY: [AvailabilityFilter, string, string][] = [
  ['any', 'Everything', 'Including books on loan'],
  ['borrow-now', 'Can borrow today', 'A lendable copy is on the shelf'],
  ['on-shelf', 'On the shelf', 'Includes in-library-use copies'],
];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/**
 * Genre navigation styled as a list (per the editorial catalogue) but built
 * from real checkboxes, so several genres can be combined and assistive
 * tech announces checked state.
 */
export function GenreList({ params, onChange }: Omit<FilterPanelProps, 'idPrefix'>) {
  const none = params.genres.length === 0;
  return (
    <fieldset className="genre-list">
      <legend>Genres</legend>
      <button type="button" className="genre-list__item genre-list__all" aria-pressed={none} onClick={() => onChange({ genres: [] })}>
        All genres
      </button>
      {(Object.keys(GENRES) as GenreId[]).map((g) => (
        <label key={g} className="genre-list__item">
          <input type="checkbox" checked={params.genres.includes(g)} onChange={() => onChange({ genres: toggle(params.genres, g) })} />
          <span>{GENRES[g].label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function FilterPanel({ params, onChange, idPrefix }: FilterPanelProps) {
  return (
    <div className="filters">
      <details className="filters__group" open>
        <summary>Availability</summary>
        <fieldset>
          <legend className="visually-hidden">Availability</legend>
          {AVAILABILITY.map(([value, label, hint]) => (
            <label key={value} className="radio-row">
              <input
                type="radio"
                name={`${idPrefix}-availability`}
                value={value}
                checked={params.availability === value}
                onChange={() => onChange({ availability: value })}
              />
              <span>
                {label}
                <span className="radio-row__hint">{hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </details>

      <details className="filters__group" open={params.languages.length > 0 || undefined}>
        <summary>Language</summary>
        <fieldset>
          <legend className="visually-hidden">Language</legend>
          <div className="chip-row">
            {(Object.keys(LANGUAGES) as LanguageCode[]).map((l) => (
              <label key={l} className="chip">
                <input
                  type="checkbox"
                  checked={params.languages.includes(l)}
                  onChange={() => onChange({ languages: toggle(params.languages, l) })}
                />
                <span>{LANGUAGES[l]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </details>

      <details className="filters__group" open={params.tags.length > 0 || undefined}>
        <summary>Moods & interests</summary>
        <fieldset>
          <legend className="visually-hidden">Moods and interests</legend>
          <div className="chip-row">
            {(Object.keys(INTEREST_TAGS) as InterestTagId[]).map((t) => (
              <label key={t} className="chip">
                <input type="checkbox" checked={params.tags.includes(t)} onChange={() => onChange({ tags: toggle(params.tags, t) })} />
                <span>
                  <span aria-hidden="true">{INTEREST_TAGS[t].emoji} </span>
                  {INTEREST_TAGS[t].label}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </details>
    </div>
  );
}

/** Removable chips summarising the active filters. */
export function ActiveFilters({ params, onChange, onClear }: { params: SearchParams; onChange: (patch: Partial<SearchParams>) => void; onClear: () => void }) {
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...params.genres.map((g) => ({ key: `g-${g}`, label: GENRES[g].label, remove: () => onChange({ genres: params.genres.filter((x) => x !== g) }) })),
    ...params.languages.map((l) => ({ key: `l-${l}`, label: LANGUAGES[l], remove: () => onChange({ languages: params.languages.filter((x) => x !== l) }) })),
    ...params.tags.map((t) => ({ key: `t-${t}`, label: INTEREST_TAGS[t].label, remove: () => onChange({ tags: params.tags.filter((x) => x !== t) }) })),
    ...(params.availability !== 'any'
      ? [{ key: 'avail', label: AVAILABILITY.find(([v]) => v === params.availability)![1], remove: () => onChange({ availability: 'any' }) }]
      : []),
  ];
  if (chips.length === 0) return null;
  return (
    <div className="active-filters" role="group" aria-label="Active filters">
      {chips.map((chip) => (
        <button key={chip.key} type="button" className="active-filter" onClick={chip.remove} aria-label={`Remove filter: ${chip.label}`}>
          {chip.label} <span aria-hidden="true">×</span>
        </button>
      ))}
      <button type="button" className="link-button" onClick={onClear}>
        Clear all filters
      </button>
    </div>
  );
}
