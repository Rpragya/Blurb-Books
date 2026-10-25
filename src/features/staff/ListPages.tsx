import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApi, useOnline } from '../../api/ApiContext';
import { keys, useLibraryMutation } from '../../api/queries';
import type { CopyReport } from '../../domain/types';
import { normalise } from '../../domain/search';
import { Button } from '../../ui/Button';
import { EmptyState, ErrorState, Freshness, Spinner, errorMessage, useAnnounce } from '../../ui/Feedback';
import { Badge, CopyStatusBadge, LoanStateBadge, Notice } from '../../ui/Status';
import { StaffPageHeader, fmtDate, fmtDateTime } from './shared';

// --- Reading sessions --------------------------------------------------------

export function SessionsPage() {
  const api = useApi();
  const online = useOnline();
  const announce = useAnnounce();
  const sessions = useQuery({ queryKey: keys.sessions, queryFn: ({ signal }) => api.listSessions({ signal }), refetchInterval: 60_000 });
  const end = useLibraryMutation((a, id: string, opts) => a.endSession(id, opts), {
    onSuccess: () => announce('Session ended. Copy moved to reshelving.'),
  });
  const active = sessions.data?.filter((s) => !s.session.endedAt) ?? [];
  const ended = sessions.data?.filter((s) => s.session.endedAt) ?? [];

  return (
    <div className="staff-page">
      <StaffPageHeader title="Reading sessions" actions={<Link to="/staff/desk?mode=session" className="btn btn--primary btn--sm">Start a session</Link>}>
        A session records that a copy is being read in the library. End it when the copy comes back to the desk.
        {sessions.data && <> · <Freshness at={sessions.dataUpdatedAt} /></>}
      </StaffPageHeader>
      {end.isError && <Notice tone="danger" role="alert">{errorMessage(end.error)}</Notice>}
      {sessions.isPending ? (
        <Spinner />
      ) : sessions.isError ? (
        <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />
      ) : active.length === 0 ? (
        <EmptyState title="No active reading sessions" />
      ) : (
        <table className="data-table">
          <caption className="visually-hidden">Active reading sessions</caption>
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Copy</th>
              <th scope="col">Reader</th>
              <th scope="col">Started</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {active.map((s) => (
              <tr key={s.session.id}>
                <td>
                  {s.title}{' '}
                  {s.isLong && (
                    <Badge tone="warn" icon="clock">
                      Over 3 hours — check it was returned
                    </Badge>
                  )}
                </td>
                <td className="barcode">{s.barcode}</td>
                <td>{s.memberName}</td>
                <td>{fmtDateTime(s.session.startedAt)}</td>
                <td className="data-table__actions">
                  <Button size="sm" loading={end.isPending && end.variables === s.session.id} disabled={!online} onClick={() => end.mutate(s.session.id)}>
                    End — copy returned
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {ended.length > 0 && (
        <>
          <h2 className="staff-subheading">Ended in the last 24 hours</h2>
          <ul className="plain-list">
            {ended.map((s) => (
              <li key={s.session.id}>
                {s.title} — {s.memberName}, {fmtDateTime(s.session.startedAt)} to {fmtDateTime(s.session.endedAt)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// --- Loans -------------------------------------------------------------------

const LOAN_FILTERS = [
  ['all', 'All active'],
  ['due-soon', 'Due soon'],
  ['overdue', 'Overdue'],
] as const;

export function LoansPage() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const filter = (LOAN_FILTERS.find(([f]) => f === params.get('filter'))?.[0] ?? 'all') as (typeof LOAN_FILTERS)[number][0];
  const [q, setQ] = useState('');
  const loans = useQuery({ queryKey: keys.loans, queryFn: ({ signal }) => api.listLoans({ signal }) });

  const rows = useMemo(() => {
    const needle = normalise(q.trim());
    return (loans.data ?? []).filter((l) => {
      if (filter === 'overdue' && l.state !== 'overdue') return false;
      if (filter === 'due-soon' && l.state !== 'due_soon') return false;
      if (!needle) return true;
      return [l.title, l.memberName, l.barcode, l.cardNumber].some((v) => normalise(v).includes(needle));
    });
  }, [loans.data, filter, q]);

  const counts = useMemo(
    () => ({
      all: loans.data?.length ?? 0,
      'due-soon': loans.data?.filter((l) => l.state === 'due_soon').length ?? 0,
      overdue: loans.data?.filter((l) => l.state === 'overdue').length ?? 0,
    }),
    [loans.data],
  );

  return (
    <div className="staff-page">
      <StaffPageHeader title="Loans">
        Overdue status is computed from each active loan’s due date.
        {loans.data && <> · <Freshness at={loans.dataUpdatedAt} fetching={loans.isFetching} /></>}
      </StaffPageHeader>
      <div className="table-toolbar">
        <div className="segmented" role="group" aria-label="Filter loans">
          {LOAN_FILTERS.map(([f, label]) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setParams(f === 'all' ? {} : { filter: f }, { replace: true })}>
              {label} <span className="count">{counts[f]}</span>
            </button>
          ))}
        </div>
        <label className="table-search">
          <span className="visually-hidden">Search loans</span>
          <input className="input" type="search" placeholder="Title, member, card or barcode" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <p className="visually-hidden" aria-live="polite">
        {loans.data ? `${rows.length} loans shown` : ''}
      </p>
      {loans.isPending ? (
        <Spinner />
      ) : loans.isError ? (
        <ErrorState error={loans.error} onRetry={() => loans.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={filter === 'overdue' ? 'No overdue loans' : 'No loans match'} />
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <caption className="visually-hidden">Active loans</caption>
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Copy</th>
                <th scope="col">Member</th>
                <th scope="col">Issued</th>
                <th scope="col">Due</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.loan.id} className={l.state === 'overdue' ? 'is-overdue' : undefined}>
                  <td>{l.title}</td>
                  <td className="barcode">{l.barcode}</td>
                  <td>
                    {l.memberName} <span className="muted small barcode">{l.cardNumber}</span>
                  </td>
                  <td>{fmtDate(l.loan.issuedAt)}</td>
                  <td>
                    {fmtDate(l.loan.dueAt)}
                    {l.loan.renewals > 0 && <span className="muted small"> · renewed {l.loan.renewals}×</span>}
                  </td>
                  <td>
                    <LoanStateBadge state={l.state} daysOverdue={l.daysOverdue} />
                  </td>
                  <td className="data-table__actions">
                    <Link to={`/staff/desk?mode=return&barcode=${l.barcode}`}>Check in</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- Reservations ------------------------------------------------------------

export function ReservationsPage() {
  const api = useApi();
  const online = useOnline();
  const announce = useAnnounce();
  const list = useQuery({ queryKey: keys.reservations, queryFn: ({ signal }) => api.listReservations({ signal }) });
  const expire = useLibraryMutation((a, id: string, opts) => a.expireReservation(id, opts), {
    onSuccess: () => announce('Reservation expired. The copy passed to the next reader or to reshelving.'),
  });
  const cancel = useLibraryMutation((a, id: string, opts) => a.cancelReservation(id, opts), {
    onSuccess: () => announce('Reservation cancelled.'),
  });
  const rows = list.data ?? [];
  const ready = rows.filter((r) => r.reservation.status === 'ready');
  const waiting = rows.filter((r) => r.reservation.status === 'waiting');
  const closed = rows.filter((r) => !['ready', 'waiting'].includes(r.reservation.status));
  const byTitle = useMemo(() => {
    const groups = new Map<string, typeof waiting>();
    for (const r of waiting) groups.set(r.title, [...(groups.get(r.title) ?? []), r]);
    return [...groups];
  }, [waiting]);
  const error = expire.error ?? cancel.error;

  return (
    <div className="staff-page">
      <StaffPageHeader title="Reservations & pickups">
        Queues are per edition, in the order reservations were placed. Returned copies are assigned to the head of the queue automatically.
        {list.data && <> · <Freshness at={list.dataUpdatedAt} fetching={list.isFetching} /></>}
      </StaffPageHeader>
      {error && <Notice tone="danger" role="alert">{errorMessage(error)}</Notice>}
      {list.isPending ? (
        <Spinner />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (
        <>
          <section aria-labelledby="pickup-heading">
            <h2 id="pickup-heading" className="staff-subheading">
              On the hold shelf <span className="count">{ready.length}</span>
            </h2>
            {ready.length === 0 ? (
              <p className="muted">Nothing waiting to be collected.</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Title</th>
                      <th scope="col">Copy</th>
                      <th scope="col">For</th>
                      <th scope="col">Collect by</th>
                      <th scope="col">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ready.map((r) => (
                      <tr key={r.reservation.id} className={r.pickupExpired ? 'is-overdue' : undefined}>
                        <td>{r.title}</td>
                        <td className="barcode">{r.barcode}</td>
                        <td>
                          {r.memberName} <span className="muted small barcode">{r.cardNumber}</span>
                        </td>
                        <td>
                          {fmtDate(r.reservation.pickupBy)}{' '}
                          {r.pickupExpired && (
                            <Badge tone="danger" icon="alert">
                              Window ended
                            </Badge>
                          )}
                        </td>
                        <td className="data-table__actions">
                          {r.pickupExpired ? (
                            <Button size="sm" loading={expire.isPending && expire.variables === r.reservation.id} disabled={!online} onClick={() => expire.mutate(r.reservation.id)}>
                              Expire & pass on
                            </Button>
                          ) : (
                            <Link className="btn btn--secondary btn--sm" to={`/staff/desk?mode=checkout&member=${r.reservation.memberId}&barcode=${r.barcode}`}>
                              Check out to member
                            </Link>
                          )}
                          <Button size="sm" variant="ghost" loading={cancel.isPending && cancel.variables === r.reservation.id} disabled={!online} onClick={() => cancel.mutate(r.reservation.id)}>
                            Cancel
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="queue-heading">
            <h2 id="queue-heading" className="staff-subheading">
              Waiting <span className="count">{waiting.length}</span>
            </h2>
            {byTitle.length === 0 ? (
              <p className="muted">No one is waiting.</p>
            ) : (
              <div className="queue-groups">
                {byTitle.map(([title, queue]) => (
                  <div key={title} className="queue-group">
                    <h3>{title}</h3>
                    <ol>
                      {queue.map((r) => (
                        <li key={r.reservation.id}>
                          <span>
                            <strong>#{r.position}</strong> {r.memberName} <span className="muted small">since {fmtDate(r.reservation.createdAt)}</span>
                          </span>
                          <Button size="sm" variant="ghost" loading={cancel.isPending && cancel.variables === r.reservation.id} disabled={!online} onClick={() => cancel.mutate(r.reservation.id)}>
                            Cancel
                          </Button>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </section>

          {closed.length > 0 && (
            <section aria-labelledby="closed-heading">
              <h2 id="closed-heading" className="staff-subheading">
                Closed this week
              </h2>
              <ul className="plain-list">
                {closed.map((r) => (
                  <li key={r.reservation.id}>
                    {r.title} — {r.memberName}: {r.reservation.status} {fmtDateTime(r.reservation.closedAt)}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

// --- Reshelving --------------------------------------------------------------

export function ReshelvingPage() {
  const api = useApi();
  const online = useOnline();
  const announce = useAnnounce();
  const [outcomes, setOutcomes] = useState<Record<string, string>>({});
  const catalogue = useQuery({ queryKey: keys.catalogue(''), queryFn: ({ signal }) => api.listCatalogue('', { signal }) });
  const reshelve = useLibraryMutation((a, vars: { copyId: string; label: string }, opts) => a.reshelve(vars.copyId, opts), {
    onSuccess: (r, vars) => {
      const msg = r.heldFor ? `Held for ${r.heldFor} — put it on the hold shelf instead.` : 'Shelved — now shows as available.';
      setOutcomes((o) => ({ ...o, [vars.label]: msg }));
      announce(msg);
    },
  });
  const rows = (catalogue.data ?? []).flatMap((e) => e.copies).filter((c) => c.copy.status === 'awaiting_reshelving');
  rows.sort((a, b) => a.copy.location.rackId.localeCompare(b.copy.location.rackId) || a.copy.location.shelf - b.copy.location.shelf);

  return (
    <div className="staff-page">
      <StaffPageHeader title="Reshelving">
        Returned copies only show as available once they’re back on the shelf. Sorted by rack for one walk round the building.
      </StaffPageHeader>
      {reshelve.isError && <Notice tone="danger" role="alert">{errorMessage(reshelve.error)}</Notice>}
      {Object.values(outcomes).length > 0 && (
        <ul className="plain-list outcome-list" aria-label="Recently shelved">
          {Object.entries(outcomes).map(([id, msg]) => (
            <li key={id}>
              <Badge tone="ok" icon="check">
                Done
              </Badge>{' '}
              {id}: {msg}
            </li>
          ))}
        </ul>
      )}
      {catalogue.isPending ? (
        <Spinner />
      ) : catalogue.isError ? (
        <ErrorState error={catalogue.error} onRetry={() => catalogue.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon="check" title="The trolley is empty" />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Rack / shelf</th>
              <th scope="col">Title</th>
              <th scope="col">Copy</th>
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.copy.id}>
                <td>
                  <strong>{c.copy.location.rackId}</strong> / {c.copy.location.shelf}
                </td>
                <td>
                  {c.title}
                  <div className="muted small">{c.locationText}</div>
                </td>
                <td className="barcode">{c.copy.barcode}</td>
                <td className="data-table__actions">
                  <Button size="sm" loading={reshelve.isPending && reshelve.variables?.copyId === c.copy.id} disabled={!online} onClick={() => reshelve.mutate({ copyId: c.copy.id, label: `${c.title} (${c.copy.barcode})` })}>
                    Mark shelved
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// --- Reports -----------------------------------------------------------------

export function ReportsPage() {
  const api = useApi();
  const online = useOnline();
  const announce = useAnnounce();
  const reports = useQuery({ queryKey: keys.reports, queryFn: ({ signal }) => api.listReports({ signal }) });
  const resolve = useLibraryMutation(
    (a, vars: { id: string; resolution: NonNullable<CopyReport['resolution']> }, opts) => a.resolveReport(vars.id, vars.resolution, opts),
    { onSuccess: () => announce('Report resolved.') },
  );
  const open = reports.data?.filter((r) => !r.report.resolvedAt) ?? [];
  const resolved = reports.data?.filter((r) => r.report.resolvedAt) ?? [];
  const busy = (id: string) => resolve.isPending && resolve.variables?.id === id;

  return (
    <div className="staff-page">
      <StaffPageHeader title="Missing & misplaced copies">
        Reports from the kiosk’s “Couldn’t find this book?” button and from staff rounds.
      </StaffPageHeader>
      {resolve.isError && <Notice tone="danger" role="alert">{errorMessage(resolve.error)}</Notice>}
      {reports.isPending ? (
        <Spinner />
      ) : reports.isError ? (
        <ErrorState error={reports.error} onRetry={() => reports.refetch()} />
      ) : open.length === 0 ? (
        <EmptyState icon="check" title="No open reports" />
      ) : (
        <ul className="report-list" role="list">
          {open.map((r) => (
            <li key={r.report.id} className="report-card">
              <div>
                <p className="report-card__title">
                  {r.title} <span className="barcode">{r.barcode}</span>
                </p>
                <p className="small">
                  <Badge tone="warn" icon="flag">
                    {{ not_on_shelf: 'Not on shelf', misplaced: 'Misplaced', damaged: 'Damaged' }[r.report.kind]}
                  </Badge>{' '}
                  from {r.report.source} · {fmtDateTime(r.report.createdAt)}
                </p>
                {r.report.note && <p className="report-card__note">“{r.report.note}”</p>}
                <p className="muted small">
                  Belongs at {r.locationText} · now <CopyStatusBadge status={r.copyStatus} />
                </p>
              </div>
              <div className="report-card__actions">
                <Button size="sm" loading={busy(r.report.id)} disabled={!online} onClick={() => resolve.mutate({ id: r.report.id, resolution: 'found' })}>
                  Found — it’s fine
                </Button>
                <Button size="sm" variant="danger" loading={busy(r.report.id)} disabled={!online || !['available', 'missing'].includes(r.copyStatus)} onClick={() => resolve.mutate({ id: r.report.id, resolution: 'marked_missing' })}>
                  Mark copy missing
                </Button>
                <Button size="sm" variant="ghost" loading={busy(r.report.id)} disabled={!online} onClick={() => resolve.mutate({ id: r.report.id, resolution: 'no_issue' })}>
                  No issue
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {resolved.length > 0 && (
        <>
          <h2 className="staff-subheading">Resolved</h2>
          <ul className="plain-list">
            {resolved.map((r) => (
              <li key={r.report.id}>
                {r.title} ({r.barcode}) — {r.report.resolution?.replace(/_/g, ' ')} {fmtDate(r.report.resolvedAt)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
