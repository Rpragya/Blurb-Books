import { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { rememberFocus } from '../../app/focus';
import { GENRES, LANGUAGES } from '../../domain/taxonomy';
import { ButtonLink } from '../../ui/Button';
import { Cover } from '../../ui/Cover';
import { Tilt } from '../../ui/motion';
import { AvailabilityBadge } from '../../ui/Status';

/**
 * Gallery card: the cover is the hero. One tab stop for the title link, plus
 * the Preview / Locate actions; the cover plate is a mouse-only shortcut.
 */
export const BookCard = memo(function BookCard({ book, previewTo, layout = 'grid', tint = 1 }) {
  const { edition, availability } = book;
  const location = useLocation();
  const titleId = `book-${edition.id}-title`;
  const focusKey = `book-${edition.id}`;
  // Coming back from the book page puts focus on this card's title link.
  const remember = () => rememberFocus(`[data-focus-key="${focusKey}"]`, location);

  return (
    <article className={`book-card book-card--${layout}`} aria-labelledby={titleId}>
      <Link
        to={`/books/${edition.id}`}
        className={`book-card__cover book-card__plate--${tint}`}
        tabIndex={-1}
        aria-hidden="true"
        onClick={remember}
        state={{ fromResults: true }}
      >
        {layout === 'grid' ? (
          <Tilt className="book-card__tilt">
            <Cover edition={edition} size="md" />
          </Tilt>
        ) : (
          <Cover edition={edition} size="sm" />
        )}
      </Link>
      <div className="book-card__body">
        <h3 className="book-card__title" id={titleId}>
          <Link to={`/books/${edition.id}`} data-focus-key={focusKey} onClick={remember} state={{ fromResults: true }}>
            {edition.title}
          </Link>
        </h3>
        <p className="book-card__author">{edition.authors.join(', ')}</p>
        {layout === 'grid' && <p className="book-card__description">{edition.description}</p>}
        <p className="book-card__meta">
          <span>{GENRES[edition.genres[0]].label}</span>
          <span aria-hidden="true">·</span>
          <span>{LANGUAGES[edition.language]}</span>
        </p>
        <AvailabilityBadge availability={availability} showDetail={layout === 'grid'} />
        {layout === 'grid' && (
          <div className="book-card__actions">
            {previewTo && (
              <ButtonLink to={previewTo} size="sm" variant="secondary" state={{ preview: true }} aria-describedby={titleId} preventScrollReset>
                Preview
              </ButtonLink>
            )}
            {availability.onShelf > 0 && (
              <ButtonLink to={`/books/${edition.id}/locate`} size="sm" variant="primary" icon="pin" aria-describedby={titleId} onClick={remember}>
                Locate
              </ButtonLink>
            )}
          </div>
        )}
      </div>
    </article>
  );
});

export function BookCardSkeleton() {
  return (
    <div className="book-card book-card--grid book-card--skeleton" aria-hidden="true">
      <div className="book-card__cover">
        <div className="cover cover--md skeleton" />
      </div>
      <div className="book-card__body">
        <div className="skeleton skeleton--line" style={{ width: '80%' }} />
        <div className="skeleton skeleton--line" style={{ width: '50%' }} />
        <div className="skeleton skeleton--line" style={{ width: '40%' }} />
      </div>
    </div>
  );
}
