import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApi } from '../../api/ApiContext';
import { keys } from '../../api/queries';
import { DAY_MS, HOUR_MS } from '../../domain/policy';
import { getConfiguredTiming, setShortTimeouts, SHORT_TIMING } from '../../session/MemberSession';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { EmptyState, useAnnounce } from '../../ui/Feedback';
import { Badge, Notice } from '../../ui/Status';
import { useDemoClock } from './StaffLayout';
import { StaffPageHeader, fmtDateTime } from './shared';

const EVENT_LABEL = {
  due_soon_reminder: 'Due-date reminder',
  overdue_notice: 'Overdue notice',
  reservation_ready: 'Ready for pickup',
  pickup_expired: 'Pickup expired',
  long_reading_session: 'Staff flag',
};

const LATENCY = [
  ['Instant', [0, 0]],
  ['Realistic', [200, 650]],
  ['Slow network', [900, 2500]],
];

/**
 * Demo controls. Everything here exists only because there is no real
 * scheduler, email service or network to observe. Nothing is sent anywhere.
 */
export function SimulationPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const announce = useAnnounce();
  const clock = useDemoClock();
  const events = useQuery({ queryKey: keys.events, queryFn: ({ signal }) => api.listEvents({ signal }) });
  const [settings, setSettings] = useState(api.getSettings());
  const [shortTimeouts, setShort] = useState(getConfiguredTiming() === SHORT_TIMING);
  const [busy, setBusy] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const run = async (label, action) => {
    setBusy(true);
    try {
      await action();
      await queryClient.invalidateQueries();
      announce(label);
    } finally {
      setBusy(false);
    }
  };

  const updateSettings = (patch) => {
    api.updateSettings(patch);
    setSettings(api.getSettings());
  };

  return (
    <div className="staff-page">
      <StaffPageHeader title="Demo controls">
        Simulates what a real deployment would get from a scheduler, a notification service and an unreliable network.
      </StaffPageHeader>

      <div className="sim-grid">
        <section className="desk-card" aria-labelledby="clock-heading">
          <h2 id="clock-heading" className="desk-card__title">
            Demo clock
          </h2>
          <p className="sim-clock">{clock.data ? fmtDateTime(clock.data.now) : '…'}</p>
          {clock.data && clock.data.offsetMs !== 0 && (
            <p className="muted small">Advanced {Math.round(clock.data.offsetMs / HOUR_MS)} hours past real time.</p>
          )}
          <p className="small">Advancing time runs the scheduled jobs: pickup expiry, reminders, overdue notices and long-session flags.</p>
          <div className="button-row">
            <Button size="sm" disabled={busy} onClick={() => run('Advanced 1 hour', () => api.advanceClock(HOUR_MS))}>
              +1 hour
            </Button>
            <Button size="sm" disabled={busy} onClick={() => run('Advanced 1 day', () => api.advanceClock(DAY_MS))}>
              +1 day
            </Button>
            <Button size="sm" disabled={busy} onClick={() => run('Advanced 3 days', () => api.advanceClock(3 * DAY_MS))}>
              +3 days
            </Button>
            <Button size="sm" disabled={busy} onClick={() => run('Advanced 1 week', () => api.advanceClock(7 * DAY_MS))}>
              +1 week
            </Button>
          </div>
          <Button variant="primary" size="sm" disabled={busy} onClick={() => run('Scheduled jobs ran', () => api.runScheduledJobs())}>
            Run scheduled jobs now
          </Button>
        </section>

        <section className="desk-card" aria-labelledby="net-heading">
          <h2 id="net-heading" className="desk-card__title">
            Network & failures
          </h2>
          <fieldset className="radio-group">
            <legend>Response time</legend>
            {LATENCY.map(([label, value]) => (
              <label key={label} className="radio-row">
                <input
                  type="radio"
                  name="latency"
                  checked={settings.latencyMs[0] === value[0] && settings.latencyMs[1] === value[1]}
                  onChange={() => updateSettings({ latencyMs: value })}
                />
                <span>
                  {label}
                  <span className="radio-row__hint">{value[1] === 0 ? 'No delay' : `${value[0]}–${value[1]} ms`}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <fieldset className="radio-group">
            <legend>Random server errors</legend>
            {[0, 0.15, 0.4].map((rate) => (
              <label key={rate} className="radio-row">
                <input type="radio" name="failure" checked={settings.failureRate === rate} onChange={() => updateSettings({ failureRate: rate })} />
                <span>{rate === 0 ? 'None' : `${rate * 100}% of requests fail`}</span>
              </label>
            ))}
          </fieldset>
          <label className="check-row">
            <input type="checkbox" checked={settings.offline} onChange={(e) => updateSettings({ offline: e.target.checked })} />
            Simulate offline
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={shortTimeouts}
              onChange={(e) => {
                setShortTimeouts(e.target.checked);
                setShort(e.target.checked);
              }}
            />
            Short kiosk timeout ({SHORT_TIMING.idleMs / 1000}s idle + {SHORT_TIMING.warningMs / 1000}s warning) for new sessions
          </label>
        </section>

        <section className="desk-card" aria-labelledby="reset-heading">
          <h2 id="reset-heading" className="desk-card__title">
            Reset
          </h2>
          <p className="small">Restore the original books, copies, members, loans and reservations. The clock returns to real time.</p>
          <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
            Reset demo data
          </Button>
        </section>
      </div>

      <section aria-labelledby="events-heading" className="sim-events">
        <h2 id="events-heading" className="staff-subheading">
          Notification log
        </h2>
        <Notice tone="info">Simulated. These are notices a real system would queue — nothing was emailed or texted.</Notice>
        {events.data?.length === 0 ? (
          <EmptyState icon="clock" title="No events yet">
            Advance the clock or run the scheduled jobs.
          </EmptyState>
        ) : (
          <ul className="event-log" role="list">
            {events.data?.map((e) => (
              <li key={e.id}>
                <Badge tone={e.kind === 'overdue_notice' || e.kind === 'pickup_expired' ? 'danger' : e.kind === 'reservation_ready' ? 'ok' : 'warn'}>
                  {EVENT_LABEL[e.kind]}
                </Badge>
                <span>{e.message}</span>
                <time className="muted small" dateTime={e.at}>
                  {fmtDateTime(e.at)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      {confirmReset && (
        <Dialog
          title="Reset all demo data?"
          description="Every change made in this browser — loans, returns, reservations, reports — will be replaced with the original sample data."
          onClose={() => setConfirmReset(false)}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmReset(false)}>
                Keep my changes
              </Button>
              <Button
                variant="danger"
                loading={busy}
                onClick={() =>
                  run('Demo data reset', async () => {
                    await api.resetDemo();
                    setConfirmReset(false);
                  })
                }
              >
                Reset
              </Button>
            </>
          }
        >
          <p className="small">Other open tabs update automatically.</p>
        </Dialog>
      )}
    </div>
  );
}
