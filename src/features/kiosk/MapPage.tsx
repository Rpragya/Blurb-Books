import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useBook, useFloorPlan } from '../../api/queries';
import type { PublicCopy } from '../../api/types';
import { PageHeading, usePageTitle } from '../../app/focus';
import { describeLocation } from '../../domain/location';
import type { Floor } from '../../domain/types';
import { Button, ButtonLink } from '../../ui/Button';
import { ErrorState, Spinner } from '../../ui/Feedback';
import { Icon } from '../../ui/Icon';
import { CopyStatusBadge, Notice } from '../../ui/Status';
import { ReportCopyDialog } from './ReportCopyDialog';
import { ShelfElevation, ShelfMap } from './ShelfMap';

/** Prefer a borrowable copy on the shelf, then any copy on the shelf, then anything. */
function pickCopy(copies: PublicCopy[], requested: string | null): PublicCopy | undefined {
  return (
    copies.find((c) => c.id === requested) ??
    copies.find((c) => c.status === 'available' && c.policy === 'lendable') ??
    copies.find((c) => c.status === 'available') ??
    copies[0]
  );
}

export function MapPage() {
  const { editionId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const plan = useFloorPlan();
  const book = useBook(editionId);
  const copy = book.data ? pickCopy(book.data.copies, searchParams.get('copy')) : undefined;
  const location = plan.data && copy ? describeLocation(plan.data, copy.location) : undefined;
  const [floorId, setFloorId] = useState<Floor['id']>('ground');
  const [selectedRack, setSelectedRack] = useState<string>();
  const [reporting, setReporting] = useState(false);
  usePageTitle(book.data ? `Find ${book.data.edition.title}` : 'Library map');

  // Show the floor the book is on as soon as we know it.
  useEffect(() => {
    if (location) setFloorId(location.floor.id);
  }, [location?.floor.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(() => {
    if (!plan.data || !selectedRack) return undefined;
    const rack = plan.data.racks.find((r) => r.id === selectedRack);
    const section = plan.data.sections.find((s) => s.id === rack?.sectionId);
    return rack && section ? { rack, section } : undefined;
  }, [plan.data, selectedRack]);

  if (plan.isPending || (editionId && book.isPending)) {
    return (
      <div className="container map-page">
        <PageHeading className="visually-hidden">Loading map</PageHeading>
        <Spinner label="Loading the library map" />
      </div>
    );
  }
  if (plan.isError || book.isError) {
    return (
      <div className="container map-page">
        <PageHeading className="visually-hidden">Map unavailable</PageHeading>
        <ErrorState error={plan.error ?? book.error} onRetry={() => (plan.isError ? plan.refetch() : book.refetch())} />
      </div>
    );
  }

  const floors = plan.data.floors;
  const edition = book.data?.edition;
  const onShelf = book.data?.copies.filter((c) => c.status === 'available') ?? [];

  return (
    <div className="container map-page">
      {edition && (
        <nav aria-label="Breadcrumb" className="book-page__back">
          <ButtonLink to={`/books/${edition.id}`} variant="quiet" icon="back">
            {edition.title}
          </ButtonLink>
        </nav>
      )}
      <header className="page-intro">
        <p className="eyebrow">{edition ? 'Find this book' : 'Library map'}</p>
        <PageHeading>{edition ? edition.title : 'Find your way around'}</PageHeading>
        {!edition && <p className="page-intro__lede">Select a rack to see what’s shelved there, or search for a book to get directions.</p>}
      </header>

      <div className="map-layout">
        {edition && copy && location && (
          <section className="directions" aria-labelledby="directions-heading">
            <h2 id="directions-heading">Directions</h2>
            <p className="directions__breadcrumb">{location.breadcrumb}</p>
            {copy.status !== 'available' && (
              <Notice tone="warn" title="This copy isn’t on the shelf right now">
                It’s <CopyStatusBadge status={copy.status} />. These directions show where it normally lives.
              </Notice>
            )}
            <ol className="directions__steps">
              {location.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="directions__shelf">
              <ShelfElevation shelves={location.rack.shelves} target={location.shelf} rackLabel={location.rack.label} />
              <p>
                Look for the spine label <strong className="barcode">{copy.barcode}</strong>.
              </p>
            </div>
            {onShelf.length > 1 && (
              <div className="directions__copies">
                <p className="muted">{onShelf.length} copies are on the shelf:</p>
                <ul className="chip-row" role="list">
                  {onShelf.map((c, i) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="chip chip--button"
                        aria-pressed={c.id === copy.id}
                        onClick={() => setSearchParams({ copy: c.id }, { replace: true, preventScrollReset: true })}
                      >
                        Copy {i + 1} · Rack {c.location.rackId}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="directions__disclaimer">
              <Icon name="info" size={16} /> This shows where the book belongs on the shelves. It doesn’t track the book live.
            </p>
            <div className="directions__actions">
              <Button icon="flag" onClick={() => setReporting(true)}>
                Couldn’t find this book?
              </Button>
              <ButtonLink
                variant="ghost"
                icon="qr"
                to={`/handoff?to=${encodeURIComponent(`/books/${edition.id}/locate?copy=${copy.id}`)}`}
              >
                Directions on my phone
              </ButtonLink>
            </div>
          </section>
        )}

        <section className="map-panel" aria-labelledby="map-heading">
          <div className="map-panel__head">
            <h2 id="map-heading" className={edition ? 'visually-hidden' : undefined}>
              Floor plan
            </h2>
            <div className="segmented" role="group" aria-label="Floor">
              {floors.map((f) => (
                <button key={f.id} type="button" aria-pressed={floorId === f.id} onClick={() => setFloorId(f.id)}>
                  {f.name}
                  {location?.floor.id === f.id && <span className="visually-hidden"> (your book is on this floor)</span>}
                </button>
              ))}
            </div>
          </div>
          {location && location.floor.id !== floorId && (
            <p className="map-panel__hint">
              Your book is on the {location.floor.name.toLowerCase()}.{' '}
              <button type="button" className="link-button" onClick={() => setFloorId(location.floor.id)}>
                Show {location.floor.name.toLowerCase()}
              </button>
            </p>
          )}
          <ShelfMap
            plan={plan.data}
            floorId={floorId}
            targetRackId={location?.rack.id}
            selectedRackId={selectedRack}
            onSelectRack={setSelectedRack}
            label={`${floors.find((f) => f.id === floorId)!.name} plan${location ? `. Your book is in rack ${location.rack.label}.` : ''} Text directions are provided separately.`}
          />
          <div className="map-legend" aria-hidden="true">
            <span className="map-legend__item map-legend__item--you">You are here</span>
            {location && <span className="map-legend__item map-legend__item--target">Your book</span>}
            <span className="map-legend__item map-legend__item--rack">Rack</span>
          </div>
          <div aria-live="polite">
            {selected && (
              <p className="rack-info">
                <strong>Rack {selected.rack.label}</strong> · {selected.section.name} · {selected.rack.shelves} shelves.{' '}
                {selected.section.directionsFromKiosk}{' '}
                <Link to={`/search?${sectionSearch(selected.section.id)}`}>Browse this section</Link>
              </p>
            )}
          </div>
        </section>

        {!edition && (
          <section className="directions" aria-labelledby="sections-heading">
            <h2 id="sections-heading">Sections</h2>
            {floors.map((f) => (
              <div key={f.id} className="section-list">
                <h3>{f.name}</h3>
                <ul>
                  {plan.data.sections
                    .filter((s) => s.floorId === f.id)
                    .map((s) => (
                      <li key={s.id}>
                        <strong>{s.name}</strong> — racks{' '}
                        {plan.data.racks
                          .filter((r) => r.sectionId === s.id)
                          .map((r) => r.label)
                          .join(', ')}
                        . <span className="muted">{s.directionsFromKiosk}</span>
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </section>
        )}
      </div>

      {reporting && copy && edition && (
        <ReportCopyDialog copyId={copy.id} title={edition.title} where={location?.breadcrumb} onClose={() => setReporting(false)} />
      )}
    </div>
  );
}

function sectionSearch(sectionId: string): string {
  const map: Record<string, string> = {
    fiction: 'genre=literary&genre=romance&genre=adventure&lang=en',
    crime: 'genre=mystery&genre=horror',
    speculative: 'genre=fantasy&genre=science-fiction',
    children: 'genre=children',
    'non-fiction': 'genre=non-fiction&genre=philosophy',
    languages: 'lang=fr&lang=es&lang=de&lang=it&lang=ru&lang=hi',
    poetry: 'genre=poetry',
  };
  return map[sectionId] ?? '';
}
