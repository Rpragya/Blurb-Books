import { Link } from 'react-router-dom';
import { useOnline } from '../../api/ApiContext';
import { useLibraryMutation } from '../../api/queries';
import { Button } from '../../ui/Button';
import { ErrorState, Freshness, Spinner, errorMessage, useAnnounce } from '../../ui/Feedback';
import { Badge } from '../../ui/Status';
import { useStaffOverview } from './StaffLayout';
import { StaffPageHeader, fmtDate, fmtDateTime } from './shared';

/** A worklist, not a dashboard: every block is something someone can act on now. */
export function OverviewPage() {
  const overview = useStaffOverview();
  const online = useOnline();
  const announce = useAnnounce();
  const reshelve = useLibraryMutation((api, copyId: string, opts) => api.reshelve(copyId, opts), {
    onSuccess: (r) => announce(r.heldFor ? `Held for ${r.heldFor} — place on the hold shelf.` : 'Shelved.'),
  });
  const expire = useLibraryMutation((api, id: string, opts) => api.expireReservation(id, opts));

  if (overview.isPending) return <Spinner label="Loading overview" />;
  if (overview.isError) return <ErrorState error={overview.error} onRetry={() => overview.refetch()} />;
  const d = overview.data;
  const longSessions = d.activeSessions.filter((s) => s.isLong);
  const nothingToDo =
    d.overdue.length + d.expiredPickups.length + d.reshelving.length + d.openReports.length + longSessions.length + d.readyForPickup.length === 0;

  return (
    <div className="staff-page">
      <StaffPageHeader
        title="Today at the desk"
        actions={
          <Button size="sm" icon="refresh" loading={overview.isFetching} onClick={() => overview.refetch()}>
            Refresh
          </Button>
        }
      >
        <Freshness at={d.asOf} label="As of" /> · {d.loansIssuedToday} issued today · {d.returnsToday} returned today · {d.dueToday} due
        back today
      </StaffPageHeader>

      {(reshelve.isError || expire.isError) && (
        <p className="inline-error" role="alert">
          {errorMessage(reshelve.error ?? expire.error)}
        </p>
      )}

      {nothingToDo && <p className="all-clear">Nothing needs attention right now.</p>}

      <div className="worklist">
        {d.expiredPickups.length > 0 && (
          <WorkBlock title="Pickup window ended" tone="danger" count={d.expiredPickups.length} link="/staff/reservations" linkText="All reservations">
            {d.expiredPickups.map((r) => (
              <li key={r.reservation.id}>
                <span>
                  <strong>{r.title}</strong> for {r.memberName} — was due {fmtDate(r.reservation.pickupBy)}
                </span>
                <Button size="sm" loading={expire.isPending && expire.variables === r.reservation.id} disabled={!online} onClick={() => expire.mutate(r.reservation.id)}>
                  Expire & pass on
                </Button>
              </li>
            ))}
          </WorkBlock>
        )}

        {d.overdue.length > 0 && (
          <WorkBlock title="Overdue loans" tone="danger" count={d.overdue.length} link="/staff/loans?filter=overdue" linkText="All overdue">
            {d.overdue.slice(0, 5).map((l) => (
              <li key={l.loan.id}>
                <span>
                  <strong>{l.title}</strong> — {l.memberName}
                </span>
                <Badge tone="danger" icon="alert">
                  {l.daysOverdue} {l.daysOverdue === 1 ? 'day' : 'days'}
                </Badge>
              </li>
            ))}
          </WorkBlock>
        )}

        {d.reshelving.length > 0 && (
          <WorkBlock title="Awaiting reshelving" tone="warn" count={d.reshelving.length} link="/staff/reshelving" linkText="Reshelving list">
            {d.reshelving.slice(0, 5).map((c) => (
              <li key={c.copy.id}>
                <span>
                  <strong>{c.title}</strong> <span className="barcode">{c.copy.barcode}</span> → {c.copy.location.rackId}/{c.copy.location.shelf}
                </span>
                <Button size="sm" loading={reshelve.isPending && reshelve.variables === c.copy.id} disabled={!online} onClick={() => reshelve.mutate(c.copy.id)}>
                  Shelved
                </Button>
              </li>
            ))}
          </WorkBlock>
        )}

        {d.openReports.length > 0 && (
          <WorkBlock title="Missing or misplaced" tone="warn" count={d.openReports.length} link="/staff/reports" linkText="All reports">
            {d.openReports.map((r) => (
              <li key={r.report.id}>
                <span>
                  <strong>{r.title}</strong> <span className="barcode">{r.barcode}</span> — {r.report.kind.replace(/_/g, ' ')} ({r.report.source})
                </span>
                <span className="muted small">{fmtDateTime(r.report.createdAt)}</span>
              </li>
            ))}
          </WorkBlock>
        )}

        {d.readyForPickup.length > 0 && (
          <WorkBlock title="On the hold shelf" tone="accent" count={d.readyForPickup.length} link="/staff/reservations" linkText="Pickup queue">
            {d.readyForPickup.map((r) => (
              <li key={r.reservation.id}>
                <span>
                  <strong>{r.title}</strong> for {r.memberName} · until {fmtDate(r.reservation.pickupBy)}
                </span>
                <Link to={`/staff/desk?mode=checkout&member=${r.reservation.memberId}&barcode=${r.barcode}`} className="small">
                  Check out
                </Link>
              </li>
            ))}
          </WorkBlock>
        )}

        {d.activeSessions.length > 0 && (
          <WorkBlock title="Reading sessions" tone={longSessions.length ? 'warn' : 'info'} count={d.activeSessions.length} link="/staff/sessions" linkText="Manage sessions">
            {d.activeSessions.map((s) => (
              <li key={s.session.id}>
                <span>
                  <strong>{s.title}</strong> — {s.memberName}, since {fmtDateTime(s.session.startedAt)}
                </span>
                {s.isLong && (
                  <Badge tone="warn" icon="clock">
                    Over 3 hours
                  </Badge>
                )}
              </li>
            ))}
          </WorkBlock>
        )}
      </div>
    </div>
  );
}

function WorkBlock({
  title,
  tone,
  count,
  link,
  linkText,
  children,
}: {
  title: string;
  tone: 'danger' | 'warn' | 'accent' | 'info';
  count: number;
  link: string;
  linkText: string;
  children: React.ReactNode;
}) {
  const id = `wb-${title.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <section className={`work-block work-block--${tone}`} aria-labelledby={id}>
      <header className="work-block__head">
        <h2 id={id}>
          {title} <span className="count">{count}</span>
        </h2>
        <Link to={link} className="small">
          {linkText}
        </Link>
      </header>
      <ul role="list" className="work-block__list">
        {children}
      </ul>
    </section>
  );
}
