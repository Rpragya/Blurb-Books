import { useQuery } from '@tanstack/react-query';
import { useDeferredValue, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi, useOnline } from '../../api/ApiContext';
import { keys, useFloorPlan, useLibraryMutation } from '../../api/queries';
import { ApiError, type CatalogueRow, type CopyRow } from '../../api/types';
import type { CopyStatus, LoanPolicy } from '../../domain/types';
import { Button } from '../../ui/Button';
import { EmptyState, ErrorState, Freshness, Spinner, errorMessage, useAnnounce } from '../../ui/Feedback';
import { AvailabilityBadge, CopyStatusBadge, Notice, copyStatusText } from '../../ui/Status';
import { StaffPageHeader } from './shared';

const STAFF_SETTABLE: CopyStatus[] = ['available', 'awaiting_reshelving', 'in_repair', 'missing'];

export function CataloguePage() {
  const api = useApi();
  const [q, setQ] = useState('');
  const deferred = useDeferredValue(q.trim());
  const [open, setOpen] = useState<string | null>(null);
  const list = useQuery({ queryKey: keys.catalogue(deferred), queryFn: ({ signal }) => api.listCatalogue(deferred, { signal }) });
  const rows = list.data ?? [];
  const totalCopies = rows.reduce((n, r) => n + r.copies.length, 0);

  return (
    <div className="staff-page">
      <StaffPageHeader title="Catalogue & copies">
        Each edition (the bibliographic record) has physical copies with their own barcode, home shelf and status.
        {list.data && <> · <Freshness at={list.dataUpdatedAt} fetching={list.isFetching} /></>}
      </StaffPageHeader>
      <div className="table-toolbar">
        <label className="table-search table-search--wide">
          <span className="visually-hidden">Search catalogue</span>
          <input className="input" type="search" placeholder="Title, author or barcode" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {list.data && (
          <p className="muted small" aria-live="polite">
            {rows.length} editions · {totalCopies} copies
          </p>
        )}
      </div>
      {list.isPending ? (
        <Spinner />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={`Nothing matches “${deferred}”`} />
      ) : (
        <ul className="catalogue-list" role="list">
          {rows.map((row) => {
            const expanded = open === row.edition.id;
            const panelId = `copies-${row.edition.id}`;
            return (
              <li key={row.edition.id} className={`catalogue-row${expanded ? ' is-open' : ''}`}>
                <button type="button" className="catalogue-row__toggle" aria-expanded={expanded} aria-controls={panelId} onClick={() => setOpen(expanded ? null : row.edition.id)}>
                  <span className="catalogue-row__title">
                    {row.edition.title}
                    <span className="muted small"> — {row.edition.authors.join(', ')}</span>
                  </span>
                  <span className="catalogue-row__meta">
                    <span className="small">
                      {row.copies.length} {row.copies.length === 1 ? 'copy' : 'copies'}
                    </span>
                    <AvailabilityBadge availability={row.availability} />
                  </span>
                </button>
                {expanded && (
                  <div id={panelId} className="catalogue-row__panel">
                    <CopyManager row={row} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CopyManager({ row }: { row: CatalogueRow }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div>
      <p className="small">
        <Link to={`/books/${row.edition.id}`}>Public page</Link> · {row.edition.publisher}, {row.edition.edition} ({row.edition.publishedYear})
      </p>
      <table className="data-table data-table--compact">
        <caption className="visually-hidden">Copies of {row.edition.title}</caption>
        <thead>
          <tr>
            <th scope="col">Barcode</th>
            <th scope="col">Home location</th>
            <th scope="col">Lending</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {row.copies.map((c) =>
            editing === c.copy.id ? (
              <tr key={c.copy.id}>
                <td colSpan={5}>
                  <CopyEditor copy={c} onDone={() => setEditing(null)} />
                </td>
              </tr>
            ) : (
              <tr key={c.copy.id}>
                <td className="barcode">{c.copy.barcode}</td>
                <td>{c.locationText}</td>
                <td>{c.copy.policy === 'reference' ? 'In-library only' : 'Lendable'}</td>
                <td>
                  <CopyStatusBadge status={c.copy.status} policy={c.copy.policy} />
                </td>
                <td className="data-table__actions">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(c.copy.id)} aria-label={`Edit copy ${c.copy.barcode}`}>
                    Edit
                  </Button>
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>
      <AddCopyForm editionId={row.edition.id} defaultRack={row.copies[0]?.copy.location.rackId} />
    </div>
  );
}

function RackFields({ rack, shelf, onRack, onShelf }: { rack: string; shelf: number; onRack: (r: string) => void; onShelf: (s: number) => void }) {
  const plan = useFloorPlan();
  const racks = plan.data?.racks ?? [];
  const max = racks.find((r) => r.id === rack)?.shelves ?? 5;
  return (
    <>
      <label className="inline-field">
        <span>Rack</span>
        <select className="input" value={rack} onChange={(e) => onRack(e.target.value)}>
          {racks.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label} — {plan.data?.sections.find((s) => s.id === r.sectionId)?.name}
            </option>
          ))}
        </select>
      </label>
      <label className="inline-field">
        <span>Shelf (from top)</span>
        <input className="input input--narrow" type="number" min={1} max={max} value={shelf} onChange={(e) => onShelf(Math.min(max, Math.max(1, Number(e.target.value) || 1)))} />
      </label>
    </>
  );
}

function CopyEditor({ copy, onDone }: { copy: CopyRow; onDone: () => void }) {
  const online = useOnline();
  const announce = useAnnounce();
  const [status, setStatus] = useState<CopyStatus>(copy.copy.status);
  const [rack, setRack] = useState(copy.copy.location.rackId);
  const [shelf, setShelf] = useState(copy.copy.location.shelf);
  const [policy, setPolicy] = useState<LoanPolicy>(copy.copy.policy);
  const statusLocked = !STAFF_SETTABLE.includes(copy.copy.status);
  const save = useLibraryMutation(
    (api, _: void, opts) =>
      api.updateCopy(
        {
          copyId: copy.copy.id,
          expectedVersion: copy.copy.version,
          status: statusLocked ? undefined : status,
          location: { rackId: rack, shelf },
          policy,
        },
        opts,
      ),
    {
      onSuccess: () => {
        announce(`Copy ${copy.copy.barcode} updated.`);
        onDone();
      },
    },
  );
  const conflict = save.error instanceof ApiError && save.error.kind === 'conflict';

  return (
    <form
      className="copy-editor"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      aria-label={`Edit copy ${copy.copy.barcode}`}
    >
      <p className="copy-editor__title">
        Editing <span className="barcode">{copy.copy.barcode}</span>
      </p>
      <div className="copy-editor__fields">
        <label className="inline-field">
          <span>Status</span>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as CopyStatus)} disabled={statusLocked} aria-describedby={statusLocked ? `lock-${copy.copy.id}` : undefined}>
            {(statusLocked ? [copy.copy.status] : STAFF_SETTABLE).map((s) => (
              <option key={s} value={s}>
                {copyStatusText(s)}
              </option>
            ))}
          </select>
        </label>
        <RackFields rack={rack} shelf={shelf} onRack={setRack} onShelf={setShelf} />
        <label className="inline-field">
          <span>Lending</span>
          <select className="input" value={policy} onChange={(e) => setPolicy(e.target.value as LoanPolicy)}>
            <option value="lendable">Lendable</option>
            <option value="reference">In-library use only</option>
          </select>
        </label>
      </div>
      {statusLocked && (
        <p id={`lock-${copy.copy.id}`} className="muted small">
          Status is “{copyStatusText(copy.copy.status)}” — it changes through the desk (return, end session, pickup), not by editing.
        </p>
      )}
      {save.isError && (
        <Notice tone="danger" role="alert" title={conflict ? 'Someone else changed this copy' : 'Not saved'}>
          {errorMessage(save.error)} {conflict ? 'Close the editor to load the latest version, then try again.' : 'Your changes are still here.'}
        </Notice>
      )}
      <div className="copy-editor__actions">
        <Button type="submit" variant="primary" size="sm" loading={save.isPending} disabled={!online}>
          Save copy
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function AddCopyForm({ editionId, defaultRack }: { editionId: string; defaultRack?: string }) {
  const online = useOnline();
  const announce = useAnnounce();
  const [rack, setRack] = useState(defaultRack ?? 'F1');
  const [shelf, setShelf] = useState(1);
  const [policy, setPolicy] = useState<LoanPolicy>('lendable');
  const add = useLibraryMutation((api, _: void, opts) => api.addCopy({ editionId, location: { rackId: rack, shelf }, policy }, opts), {
    onSuccess: (copy) => announce(`Added copy ${copy.barcode}. It’s on the reshelving list.`),
  });

  return (
    <form
      className="add-copy"
      onSubmit={(e) => {
        e.preventDefault();
        add.mutate();
      }}
    >
      <fieldset>
        <legend>Add a physical copy</legend>
        <div className="copy-editor__fields">
          <RackFields rack={rack} shelf={shelf} onRack={setRack} onShelf={setShelf} />
          <label className="inline-field">
            <span>Lending</span>
            <select className="input" value={policy} onChange={(e) => setPolicy(e.target.value as LoanPolicy)}>
              <option value="lendable">Lendable</option>
              <option value="reference">In-library use only</option>
            </select>
          </label>
          <Button type="submit" size="sm" icon="plus" loading={add.isPending} disabled={!online}>
            Add copy
          </Button>
        </div>
        {add.isSuccess && (
          <p className="small" role="status">
            Added <span className="barcode">{add.data.barcode}</span> — label it and put it on the reshelving trolley.
          </p>
        )}
        {add.isError && <Notice tone="danger" role="alert">{errorMessage(add.error)}</Notice>}
      </fieldset>
    </form>
  );
}
