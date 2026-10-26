import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useSearch } from '../../api/queries';
import { PageHeading, usePageTitle } from '../../app/focus';
import { plural } from '../../domain/availability';
import { DEFAULT_SEARCH, activeFilterCount, parseSearchParams, toSearchParams, type SearchParams, type SortKey } from '../../domain/search';
import { Button, ButtonLink } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { EmptyState, ErrorState, Freshness, useAnnounceOnChange } from '../../ui/Feedback';
import { Icon } from '../../ui/Icon';
import { EASE_OUT_EXPO } from '../../ui/motion';
import { Notice } from '../../ui/Status';
import { BookCard, BookCardSkeleton } from './BookCard';
import { ActiveFilters, FilterPanel, GenreList } from './FilterPanel';
import { PreviewDialog } from './PreviewDialog';

const SORT_LABELS: Record<SortKey, string> = {
  relevance: 'Best match',
  title: 'Title A–Z',
  author: 'Author A–Z',
  newest: 'Newest arrivals',
  published: 'Oldest first published',
};

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = useMemo(() => parseSearchParams(searchParams), [searchParams]);
  const previewId = searchParams.get('preview');
  const navigate = useNavigate();
  const location = useLocation();
  const results = useSearch(params);
  const { data } = results;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const filterCount = activeFilterCount(params);

  usePageTitle(params.q ? `“${params.q}” — Search` : 'Search');

  /**
   * All search state lives in the URL. Changing anything but the page resets
   * to page 1. Typing replaces the history entry; deliberate filter changes
   * push one, so Back undoes them one at a time.
   */
  const update = useCallback(
    (patch: Partial<SearchParams>, { replace = false } = {}) => {
      const next = toSearchParams({ ...params, ...patch, page: patch.page ?? 1 });
      setSearchParams(next, { replace, preventScrollReset: true });
    },
    [params, setSearchParams],
  );

  // --- debounced text input --------------------------------------------------
  const [text, setText] = useState(params.q);
  const lastPushed = useRef(params.q);
  useEffect(() => {
    // URL changed from outside (Back, a chip, Clear): reflect it in the box.
    if (params.q !== lastPushed.current) {
      lastPushed.current = params.q;
      setText(params.q);
    }
  }, [params.q]);
  useEffect(() => {
    if (text.trim() === params.q.trim()) return;
    const t = setTimeout(() => {
      lastPushed.current = text.trim();
      update({ q: text }, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [text, params.q, update]);

  const clearAll = () => {
    setText('');
    lastPushed.current = '';
    setSearchParams(new URLSearchParams(), { preventScrollReset: true });
  };

  const settled = data && !results.isPlaceholderData;
  useAnnounceOnChange(
    settled
      ? `${data.total} ${plural(data.total, 'book')} found${data.pageCount > 1 ? `, page ${data.page} of ${data.pageCount}` : ''}`
      : undefined,
  );

  const previewHref = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('preview', id);
    return `?${next}`;
  };

  const closePreview = () => {
    // Opened from a card in this tab → go Back (so Back/Escape agree);
    // arrived via a direct link → just drop the param.
    if ((location.state as { preview?: boolean } | null)?.preview) navigate(-1);
    else {
      const next = new URLSearchParams(searchParams);
      next.delete('preview');
      setSearchParams(next, { replace: true, preventScrollReset: true });
    }
  };

  const pageLink = (page: number) => `?${toSearchParams({ ...params, page })}`;

  return (
    <div className="container search-page">
      <header className="search-header">
        <p className="kicker">The collection</p>
        <PageHeading>{params.q ? <>Results for “{params.q}”</> : <>Discover your next <em>chapter.</em></>}</PageHeading>
        <p className="catalogue-intro">A familiar favourite or something unexpected. Your next great read starts here.</p>
        <form
          role="search"
          className="search-bar"
          onSubmit={(e) => {
            e.preventDefault();
            lastPushed.current = text.trim();
            update({ q: text });
          }}
        >
          <label htmlFor="search-q" className="visually-hidden">
            Search by title or author
          </label>
          <Icon name="search" size={20} className="search-bar__icon" />
          <input
            id="search-q"
            type="search"
            className="search-bar__input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search books, authors, or themes"
            autoComplete="off"
            enterKeyHint="search"
          />
          <Button type="submit" variant="primary">
            Search
          </Button>
        </form>
        <div className="catalogue-toolbar">
          <label className="switch">
            <input
              type="checkbox"
              role="switch"
              checked={params.availability === 'borrow-now'}
              onChange={(e) => update({ availability: e.target.checked ? 'borrow-now' : 'any' })}
            />
            <span className="switch__track" aria-hidden="true">
              <span className="switch__thumb" />
            </span>
            Show only available now
          </label>
          <Button className="filters-toggle" size="sm" icon="filter" onClick={() => setFiltersOpen(true)}>
            Filters{filterCount > 0 && ` (${filterCount})`}
          </Button>
          <label className="sort-select">
            <span>Sort by</span>
            <select className="input" value={params.sort} onChange={(e) => update({ sort: e.target.value as SortKey })}>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <div className="search-layout">
        <aside className="search-layout__filters" aria-label="Filters">
          <h2 className="visually-hidden">Filters</h2>
          <GenreList params={params} onChange={update} />
          <FilterPanel params={params} onChange={update} idPrefix="side" />
          {filterCount > 0 && (
            <button type="button" className="link-button filters-reset" onClick={() => update({ ...DEFAULT_SEARCH, q: params.q, sort: params.sort })}>
              Reset all filters
            </button>
          )}
        </aside>

        <section className="search-layout__results" aria-labelledby="results-heading">
          <div className="results-toolbar">
            <h2 id="results-heading" ref={resultsHeadingRef} tabIndex={-1} className="results-count">
              {data ? `${data.total} ${plural(data.total, 'book')}` : 'Searching…'}
            </h2>
            {data && <Freshness at={data.asOf} label="Availability as of" fetching={results.isFetching} />}
          </div>

          <ActiveFilters params={params} onChange={update} onClear={clearAll} />

          {results.isError && data && (
            <Notice
              tone="warn"
              title="Couldn’t refresh these results"
              action={
                <Button size="sm" icon="refresh" onClick={() => results.refetch()}>
                  Retry
                </Button>
              }
            >
              Showing the last results we loaded. {results.error instanceof Error ? results.error.message : ''}
            </Notice>
          )}

          {!data && results.isError ? (
            <ErrorState error={results.error} onRetry={() => results.refetch()} />
          ) : !data ? (
            <ul className="results-grid" role="list" aria-busy="true" aria-label="Loading results">
              {Array.from({ length: 6 }, (_, i) => (
                <li key={i}>
                  <BookCardSkeleton />
                </li>
              ))}
            </ul>
          ) : data.total === 0 ? (
            <EmptyState
              icon="search"
              title={params.q ? `No books match “${params.q}”${filterCount ? ' with these filters' : ''}` : 'No books match these filters'}
              actions={
                <>
                  {filterCount > 0 && params.q && (
                    <Button variant="primary" onClick={() => update({ ...DEFAULT_SEARCH, q: params.q })}>
                      Search everything for “{params.q}”
                    </Button>
                  )}
                  {(filterCount > 0 || params.q) && <Button onClick={clearAll}>Clear search and filters</Button>}
                  <ButtonLink to="/explore" variant="ghost">
                    Help me choose
                  </ButtonLink>
                </>
              }
            >
              <ul className="empty-tips">
                {params.q && <li>Check the spelling, or try just the author’s surname.</li>}
                {params.availability !== 'any' && <li>Include books that are currently on loan — you can reserve them.</li>}
                {filterCount > 1 && <li>Remove a filter or two; each one narrows the list.</li>}
                <li>Ask at the help desk — we can request books from other branches.</li>
              </ul>
            </EmptyState>
          ) : (
            <>
              {/* Cards glide to their new places when filters change. */}
              <LayoutGroup>
                <ul className={`results-grid${results.isPlaceholderData ? ' is-stale' : ''}`} role="list" aria-busy={results.isPlaceholderData}>
                  <AnimatePresence initial={false} mode="popLayout">
                    {data.items.map((book, i) => (
                      <motion.li
                        key={book.edition.id}
                        layout
                        initial={{ opacity: 0, y: 18, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: EASE_OUT_EXPO, delay: Math.min(i, 8) * 0.03 } }}
                        exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.2 } }}
                        transition={{ layout: { duration: 0.45, ease: EASE_OUT_EXPO } }}
                      >
                        <BookCard book={book} previewTo={previewHref(book.edition.id)} tint={(i % 4) + 1} />
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              </LayoutGroup>
              {data.pageCount > 1 && (
                <nav className="pagination" aria-label="Pages">
                  {data.page > 1 && (
                    <Link to={pageLink(data.page - 1)} className="pagination__link" onClick={() => resultsHeadingRef.current?.focus()}>
                      ← Previous
                    </Link>
                  )}
                  <ol>
                    {Array.from({ length: data.pageCount }, (_, i) => i + 1).map((p) => (
                      <li key={p}>
                        <Link
                          to={pageLink(p)}
                          className="pagination__link"
                          aria-current={p === data.page ? 'page' : undefined}
                          aria-label={`Page ${p}`}
                          onClick={() => resultsHeadingRef.current?.focus()}
                        >
                          {p}
                        </Link>
                      </li>
                    ))}
                  </ol>
                  {data.page < data.pageCount && (
                    <Link to={pageLink(data.page + 1)} className="pagination__link" onClick={() => resultsHeadingRef.current?.focus()}>
                      Next →
                    </Link>
                  )}
                </nav>
              )}
            </>
          )}
        </section>
      </div>

      {filtersOpen && (
        <Dialog
          title="Filters"
          variant="drawer"
          onClose={() => setFiltersOpen(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => update({ ...DEFAULT_SEARCH, q: params.q, sort: params.sort })}>
                Reset
              </Button>
              <Button variant="primary" onClick={() => setFiltersOpen(false)}>
                {data ? `Show ${data.total} ${plural(data.total, 'book')}` : 'Show results'}
              </Button>
            </>
          }
        >
          <GenreList params={params} onChange={(patch) => update(patch, { replace: true })} />
          <FilterPanel params={params} onChange={(patch) => update(patch, { replace: true })} idPrefix="drawer" />
        </Dialog>
      )}

      {previewId && <PreviewDialog editionId={previewId} onClose={closePreview} />}
    </div>
  );
}
