import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useHome } from '../../api/queries';
import type { BookSummary } from '../../api/types';
import { PageHeading, usePageTitle } from '../../app/focus';
import { toSearchParams } from '../../domain/search';
import { GENRES, INTEREST_TAGS } from '../../domain/taxonomy';
import type { GenreId, InterestTagId } from '../../domain/types';
import { Button, ButtonLink } from '../../ui/Button';
import { Cover } from '../../ui/Cover';
import { ErrorState, Freshness } from '../../ui/Feedback';
import { Icon } from '../../ui/Icon';
import { AvailabilityBadge } from '../../ui/Status';

const FEATURED_TAGS: InterestTagId[] = ['page-turners', 'cosy-nights', 'strange-worlds', 'short-reads', 'love-and-letters', 'read-aloud'];

export function WelcomePage() {
  usePageTitle('Welcome');
  const home = useHome();
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  return (
    <div className="welcome">
      <section className="hero">
        <div className="container hero__inner">
          <p className="eyebrow">Riverside Library · Blurb Books</p>
          <PageHeading className="hero__title">What would you like to read today?</PageHeading>
          <p className="hero__lede">
            Browse by mood or genre, read a preview, then find the exact shelf. No sign-in needed.
          </p>
          <form
            role="search"
            className="hero-search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/search?${toSearchParams({ q })}`);
            }}
          >
            <label htmlFor="hero-q" className="visually-hidden">
              Search by title or author
            </label>
            <Icon name="search" size={24} className="hero-search__icon" />
            <input
              id="hero-q"
              className="hero-search__input"
              type="search"
              placeholder="Search by title or author"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
              enterKeyHint="search"
            />
            <Button type="submit" variant="primary" size="lg">
              Search
            </Button>
          </form>
          <div className="hero__paths">
            <ButtonLink to="/explore" variant="secondary" size="lg" icon="sparkle">
              Help me choose
            </ButtonLink>
            <ButtonLink to="/map" variant="ghost" size="lg" icon="pin">
              Library map
            </ButtonLink>
          </div>
        </div>
      </section>

      <div className="container welcome__sections">
        <section aria-labelledby="moods-heading" className="welcome-section">
          <h2 id="moods-heading">Browse by mood</h2>
          <ul className="tag-tiles" role="list">
            {FEATURED_TAGS.map((tag) => (
              <li key={tag}>
                <Link to={`/search?${toSearchParams({ tags: [tag] })}`} className="tag-tile">
                  <span className="tag-tile__emoji" aria-hidden="true">
                    {INTEREST_TAGS[tag].emoji}
                  </span>
                  {INTEREST_TAGS[tag].label}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {home.isError && !home.data && <ErrorState error={home.error} onRetry={() => home.refetch()} />}

        <ShelfRow
          id="picks"
          title="Staff picks"
          subtitle="Recommended by the people who shelve them"
          books={home.data?.staffPicks}
          showQuote
        />

        <section aria-labelledby="genres-heading" className="welcome-section">
          <div className="section-head">
            <h2 id="genres-heading">Genres</h2>
            {home.data && (
              <p className="muted">
                {home.data.availableNow} titles can be borrowed right now · <Freshness at={home.data.asOf} label="as of" />
              </p>
            )}
          </div>
          <ul className="genre-grid" role="list">
            {(Object.keys(GENRES) as GenreId[]).map((g) => (
              <li key={g}>
                <Link to={`/search?${toSearchParams({ genres: [g] })}`} className={`genre-tile genre-tile--${g}`}>
                  <span className="genre-tile__name">{GENRES[g].label}</span>
                  <span className="genre-tile__blurb">{GENRES[g].blurb}</span>
                  {home.data && (
                    <span className="genre-tile__count">
                      {home.data.genreCounts[g]} {home.data.genreCounts[g] === 1 ? 'title' : 'titles'}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <ShelfRow id="new" title="New on the shelves" subtitle="Recently added to Riverside" books={home.data?.newArrivals} />
      </div>
    </div>
  );
}

function ShelfRow({
  id,
  title,
  subtitle,
  books,
  showQuote,
}: {
  id: string;
  title: string;
  subtitle: string;
  books?: BookSummary[];
  showQuote?: boolean;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="welcome-section">
      <div className="section-head">
        <h2 id={`${id}-heading`}>{title}</h2>
        <p className="muted">{subtitle}</p>
      </div>
      <ul className="shelf-row" role="list" aria-busy={!books}>
        {books
          ? books.map(({ edition, availability }) => (
              <li key={edition.id} className="shelf-row__item">
                <Link to={`/books/${edition.id}`} className="shelf-book">
                  <Cover edition={edition} size="md" />
                  <span className="shelf-book__title">{edition.title}</span>
                  <span className="shelf-book__author">{edition.authors.join(', ')}</span>
                </Link>
                <AvailabilityBadge availability={availability} />
                {showQuote && edition.recommendation && (
                  <blockquote className="shelf-book__quote">
                    “{edition.recommendation.text}”<footer>— {edition.recommendation.staffName}</footer>
                  </blockquote>
                )}
              </li>
            ))
          : Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="shelf-row__item" aria-hidden="true">
                <div className="cover cover--md skeleton" />
              </li>
            ))}
      </ul>
    </section>
  );
}
