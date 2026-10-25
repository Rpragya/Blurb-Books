import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useBook, useFloorPlan } from '../../api/queries';
import type { BookDetail, PublicCopy } from '../../api/types';
import { PageHeading, usePageTitle } from '../../app/focus';
import { describeLocation } from '../../domain/location';
import { GENRES, INTEREST_TAGS, LANGUAGES } from '../../domain/taxonomy';
import type { FloorPlan } from '../../domain/types';
import { Button, ButtonLink } from '../../ui/Button';
import { Cover } from '../../ui/Cover';
import { EmptyState, ErrorState, Freshness, Spinner } from '../../ui/Feedback';
import { Icon } from '../../ui/Icon';
import { AvailabilityBadge, CopyStatusBadge } from '../../ui/Status';
import { BlurbNotes } from './BlurbNotes';
import { BookCard } from './BookCard';
import { ReserveAction, SaveButton } from './BookActions';
import { PreviewText } from './PreviewText';

const dateFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export function BookPage() {
  const { editionId } = useParams();
  const book = useBook(editionId);
  const plan = useFloorPlan();
  const location = useLocation();
  const navigate = useNavigate();
  const cameFromResults = (location.state as { fromResults?: boolean } | null)?.fromResults;
  usePageTitle(book.data?.edition.title ?? 'Book');

  const back = cameFromResults ? (
    <Button variant="quiet" icon="back" onClick={() => navigate(-1)}>
      Back to results
    </Button>
  ) : (
    <ButtonLink to="/search" variant="quiet" icon="back">
      Search the library
    </ButtonLink>
  );

  if (book.isPending) {
    return (
      <div className="container book-page">
        {back}
        <PageHeading className="visually-hidden">Loading book</PageHeading>
        <Spinner label="Loading book details" />
      </div>
    );
  }
  if (book.isError) {
    return (
      <div className="container book-page">
        {back}
        <PageHeading className="visually-hidden">Book not available</PageHeading>
        <ErrorState error={book.error} onRetry={() => book.refetch()} title="We couldn’t load this book" />
      </div>
    );
  }

  const { edition, availability } = book.data;
  const onShelf = book.data.copies.filter((c) => c.status === 'available');

  return (
    <div className="container book-page">
      <nav aria-label="Breadcrumb" className="book-page__back">
        {back}
      </nav>

      <article className="book-hero" aria-labelledby="book-title">
        <div className="book-hero__cover">
          <Cover edition={edition} size="lg" />
        </div>
        <div className="book-hero__info">
          <p className="eyebrow">
            {edition.genres.map((g) => GENRES[g].label).join(' · ')} · {LANGUAGES[edition.language]}
          </p>
          <PageHeading id="book-title">{edition.title}</PageHeading>
          <p className="book-hero__author">by {edition.authors.join(', ')}</p>
          <p className="book-hero__description">{edition.description}</p>

          <div className="book-hero__availability">
            <AvailabilityBadge availability={availability} showDetail />
            <Freshness at={book.data.asOf} label="Checked" fetching={book.isFetching} />
          </div>

          <div className="book-hero__actions">
            {onShelf.length > 0 && (
              <ButtonLink to={`/books/${edition.id}/locate`} variant="primary" size="lg" icon="pin">
                Locate a copy
              </ButtonLink>
            )}
            <SaveButton editionId={edition.id} />
            <ButtonLink to={`/handoff?to=${encodeURIComponent(`/books/${edition.id}`)}`} variant="ghost" icon="qr">
              Continue on your phone
            </ButtonLink>
          </div>
          <ReserveAction book={book.data} />
        </div>
      </article>

      <div className="book-body">
        <div className="book-body__main">
          <section aria-labelledby="next-steps" className="book-section next-steps">
            <h2 id="next-steps">Read it here or borrow it</h2>
            <NextSteps book={book.data} plan={plan.data} />
          </section>

          <section aria-labelledby="synopsis" className="book-section">
            <h2 id="synopsis">Synopsis</h2>
            <p className="label-pill">Editorial summary by library staff</p>
            <p className="book-synopsis">{edition.synopsis}</p>
          </section>

          {edition.recommendation && (
            <section aria-labelledby="recommendation" className="book-section">
              <h2 id="recommendation">Librarian recommendation</h2>
              <blockquote className="staff-quote">
                <p>“{edition.recommendation.text}”</p>
                <footer>— {edition.recommendation.staffName}</footer>
              </blockquote>
            </section>
          )}

          <section aria-labelledby="preview" className="book-section">
            <h2 id="preview">Preview</h2>
            <PreviewText preview={edition.preview} />
          </section>

          {edition.blurbNotesFile && (
            <section aria-labelledby="blurb-notes" className="book-section">
              <h2 id="blurb-notes">Blurb notes</h2>
              <p className="label-pill">Reader’s note from the original Blurb collection — not part of the book</p>
              <BlurbNotes file={edition.blurbNotesFile} />
            </section>
          )}
        </div>

        <aside className="book-body__side">
          <section aria-labelledby="copies" className="book-section">
            <h2 id="copies">Copies in this library</h2>
            <CopyList copies={book.data.copies} plan={plan.data} editionId={edition.id} />
            {book.data.queueLength > 0 && (
              <p className="muted">
                {book.data.queueLength} {book.data.queueLength === 1 ? 'reader is' : 'readers are'} waiting for this title.
              </p>
            )}
          </section>

          <section aria-labelledby="edition" className="book-section">
            <h2 id="edition">Edition</h2>
            <dl className="details-list">
              <div>
                <dt>Publisher</dt>
                <dd>{edition.publisher}</dd>
              </div>
              <div>
                <dt>Edition</dt>
                <dd>
                  {edition.edition}, {edition.publishedYear}
                </dd>
              </div>
              <div>
                <dt>First published</dt>
                <dd>{edition.firstPublished}</dd>
              </div>
              <div>
                <dt>Language</dt>
                <dd>{LANGUAGES[edition.language]}</dd>
              </div>
              <div>
                <dt>Pages</dt>
                <dd>{edition.pages}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="themes" className="book-section">
            <h2 id="themes">Themes & tags</h2>
            <ul className="tag-list" role="list">
              {edition.themes.map((t) => (
                <li key={t} className="tag">
                  {t}
                </li>
              ))}
              {edition.tags.map((t) => (
                <li key={t}>
                  <Link className="tag tag--link" to={`/search?tag=${t}`}>
                    <span aria-hidden="true">{INTEREST_TAGS[t].emoji} </span>
                    {INTEREST_TAGS[t].label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {book.data.similar.length > 0 && (
        <section aria-labelledby="similar" className="book-section similar">
          <h2 id="similar">If you like this</h2>
          <ul className="similar-grid" role="list">
            {book.data.similar.map((s) => (
              <li key={s.edition.id}>
                <BookCard book={s} layout="compact" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function NextSteps({ book, plan }: { book: BookDetail; plan?: FloorPlan }) {
  const { availability, edition } = book;
  const first = book.copies.find((c) => c.status === 'available' && c.policy === 'lendable') ?? book.copies.find((c) => c.status === 'available');
  const where = first && plan ? describeLocation(plan, first.location)?.breadcrumb : undefined;

  if (availability.kind === 'available' || availability.kind === 'reference_only') {
    return (
      <ol className="steps">
        <li>
          <strong>Find it.</strong> {where ?? 'See the copies list for its shelf.'}{' '}
          <Link to={`/books/${edition.id}/locate`}>Show me on the map</Link>
        </li>
        <li>
          <strong>Read it here.</strong> Take it to any table. Staff can record a reading session so it isn’t reshelved while
          you’re away.
        </li>
        <li>
          {availability.kind === 'available' ? (
            <>
              <strong>Or borrow it.</strong> Bring the book and your library card to the help desk.
            </>
          ) : (
            <>
              <strong>In-library use only.</strong> The copy on the shelf can’t be borrowed
              {availability.detail?.includes('on loan') ? ' — borrowable copies are on loan; you can reserve one.' : '.'}
            </>
          )}
        </li>
      </ol>
    );
  }
  if (availability.kind === 'reshelving') {
    return (
      <EmptyState icon="refresh" title="Just returned">
        A copy is on the returns trolley waiting to go back on the shelf. Ask at the help desk and staff can fetch it for you.
      </EmptyState>
    );
  }
  return (
    <EmptyState icon="clock" title={availability.label}>
      {availability.detail ?? 'No copy is on the shelf right now.'} Reserve it below and we’ll hold the next returned copy for you.
    </EmptyState>
  );
}

function CopyList({ copies, plan, editionId }: { copies: PublicCopy[]; plan?: FloorPlan; editionId: string }) {
  if (copies.length === 0) return <p>No physical copies in this library.</p>;
  return (
    <ul className="copy-list" role="list">
      {copies.map((copy, i) => {
        const loc = plan ? describeLocation(plan, copy.location) : undefined;
        return (
          <li key={copy.id} className="copy-list__item">
            <div className="copy-list__head">
              <span className="copy-list__name">
                Copy {i + 1} <span className="muted">· {copy.barcode}</span>
              </span>
              <CopyStatusBadge status={copy.status} policy={copy.policy} />
            </div>
            <p className="copy-list__where">
              <Icon name="pin" size={16} /> {loc?.breadcrumb ?? `Rack ${copy.location.rackId}, shelf ${copy.location.shelf}`}
            </p>
            {copy.dueAt && <p className="muted">Due back {dateFormat.format(new Date(copy.dueAt))}</p>}
            {copy.status === 'available' && (
              <Link to={`/books/${editionId}/locate?copy=${copy.id}`} className="copy-list__locate">
                Locate this copy
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
