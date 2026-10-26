import { useDeferredValue, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../../api/queries';
import { PageHeading, usePageTitle } from '../../app/focus';
import { plural } from '../../domain/availability';
import { DEFAULT_SEARCH, toSearchParams } from '../../domain/search';
import { GENRES, INTEREST_TAGS, LANGUAGES } from '../../domain/taxonomy';
import { Button } from '../../ui/Button';

function toggle(list, value) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Guided genre + interest picker that hands off to search with the choices in the URL. */
export function ExplorePage() {
  usePageTitle('Help me choose');
  const navigate = useNavigate();
  const [genres, setGenres] = useState([]);
  const [tags, setTags] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [availability, setAvailability] = useState('any');

  const criteria = { ...DEFAULT_SEARCH, genres, tags, languages, availability };
  // Live count; deferred so rapid toggling stays responsive.
  const count = useSearch(useDeferredValue(criteria));
  const total = count.data?.total;

  return (
    <div className="container explore">
      <header className="page-intro">
        <p className="eyebrow">Discover</p>
        <PageHeading>Help me choose</PageHeading>
        <p className="page-intro__lede">Pick anything that sounds good. You can change your mind on the next screen.</p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          navigate(`/search?${toSearchParams(criteria)}`);
        }}
      >
        <fieldset className="explore-step">
          <legend>
            <span className="explore-step__n">1</span> What are you in the mood for?
          </legend>
          <div className="choice-grid choice-grid--tags">
            {(Object.keys(INTEREST_TAGS)).map((t) => (
              <label key={t} className="choice-tile">
                <input type="checkbox" checked={tags.includes(t)} onChange={() => setTags(toggle(tags, t))} />
                <span className="choice-tile__emoji" aria-hidden="true">
                  {INTEREST_TAGS[t].emoji}
                </span>
                <span>{INTEREST_TAGS[t].label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="explore-step">
          <legend>
            <span className="explore-step__n">2</span> Any favourite genres?
          </legend>
          <div className="choice-grid">
            {(Object.keys(GENRES)).map((g) => (
              <label key={g} className="choice-tile choice-tile--genre">
                <input type="checkbox" checked={genres.includes(g)} onChange={() => setGenres(toggle(genres, g))} />
                <span className="choice-tile__name">{GENRES[g].label}</span>
                <span className="choice-tile__hint">{GENRES[g].blurb}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="explore-step">
          <legend>
            <span className="explore-step__n">3</span> Language and availability
          </legend>
          <div className="chip-row" role="group" aria-label="Languages">
            {(Object.keys(LANGUAGES)).map((l) => (
              <label key={l} className="chip">
                <input type="checkbox" checked={languages.includes(l)} onChange={() => setLanguages(toggle(languages, l))} />
                <span>{LANGUAGES[l]}</span>
              </label>
            ))}
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={availability === 'borrow-now'}
              onChange={(e) => setAvailability(e.target.checked ? 'borrow-now' : 'any')}
            />
            Only show books I can borrow today
          </label>
        </fieldset>

        <div className="explore-submit">
          <p aria-live="polite" className="explore-submit__count">
            {total === undefined ? 'Counting…' : `${total} ${plural(total, 'book')} match`}
          </p>
          <Button type="submit" variant="primary" size="lg" iconEnd="chevron" disabled={total === 0}>
            {total === 0 ? 'No matches — try fewer choices' : 'Show my books'}
          </Button>
        </div>
      </form>
    </div>
  );
}
