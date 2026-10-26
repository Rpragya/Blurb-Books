/**
 * In-browser mock of the library backend.
 *
 * - State lives in memory and is persisted to localStorage so a kiosk tab and
 *   a staff tab stay in sync (via the `storage` event).
 * - Every call waits a random latency, honours AbortSignal, and can be made
 *   to fail or go "offline" from the demo panel.
 * - Mutations run as transactions: clone → apply domain rule → verify
 *   invariants → commit. A thrown rule leaves state untouched.
 * - Mutations accept an idempotency key; a retried key returns the first
 *   result instead of applying twice.
 *
 * Production requirements this only simulates: transactional checkout with
 * row-level locks on the copy, server-side idempotency keys, authenticated
 * sessions and server-enforced role checks.
 */
import { summariseAvailability } from '../../domain/availability';
import * as rules from '../../domain/circulation';
import { DomainError } from '../../domain/circulation';
import { findInvariantViolations } from '../../domain/invariants';
import { describeLocation } from '../../domain/location';
import { DAY_MS, HOUR_MS } from '../../domain/policy';
import { PAGE_SIZE, normalise, scoreMatch } from '../../domain/search';
import { GENRES, INTEREST_TAGS } from '../../domain/taxonomy';
import {
  ApiError,
} from '../types';
import { FLOOR_PLAN } from './floorPlan';
import { createSeedState } from './seed';

const STORAGE_KEY = 'blurb-books:demo-db:v1';
const SETTINGS_KEY = 'blurb-books:demo-settings:v1';
const SCHEMA_VERSION = 1;

const DEFAULT_SETTINGS = { latencyMs: [200, 650], failureRate: 0, offline: false };

function safeStorage() {
  try {
    const s = window.localStorage;
    s.getItem('probe');
    return s;
  } catch {
    return null;
  }
}

function abortError() {
  return new DOMException('The request was cancelled.', 'AbortError');
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/** Move every timestamp forward so time spent away from the demo doesn't count. */
function shiftDates(state, deltaMs) {
  const shift = (iso) => (iso ? new Date(new Date(iso).getTime() + deltaMs).toISOString() : iso);
  for (const e of state.editions) e.addedAt = shift(e.addedAt);
  for (const c of state.copies) c.updatedAt = shift(c.updatedAt);
  for (const l of state.loans) Object.assign(l, { issuedAt: shift(l.issuedAt), dueAt: shift(l.dueAt), returnedAt: shift(l.returnedAt) });
  for (const r of state.reservations) {
    Object.assign(r, { createdAt: shift(r.createdAt), readyAt: shift(r.readyAt), pickupBy: shift(r.pickupBy), closedAt: shift(r.closedAt) });
  }
  for (const s of state.sessions) Object.assign(s, { startedAt: shift(s.startedAt), endedAt: shift(s.endedAt) });
  for (const r of state.reports) Object.assign(r, { createdAt: shift(r.createdAt), resolvedAt: shift(r.resolvedAt) });
  for (const e of state.events) e.at = shift(e.at);
}

function sortTitle(title) {
  return normalise(title).replace(/^(the|a|an|le|la|les|el|die|il)\s+/, '');
}

function surname(edition) {
  const first = edition.authors[0] ?? '';
  return normalise(first.split(' ').slice(-1)[0] ?? first);
}

export function createMockApi(options = {}) {
  const storage = options.storage === undefined ? safeStorage() : options.storage;
  const realNow = options.realNow ?? (() => Date.now());
  const random = options.random ?? Math.random;
  const checkInvariants = options.checkInvariants ?? import.meta.env.DEV;
  let settings = { ...DEFAULT_SETTINGS, ...readSettings(), ...options.settings };
  const listeners = new Set();
  const idempotency = new Map();

  let db = load();

  function readSettings() {
    if (options.settings) return {};
    try {
      return JSON.parse(storage?.getItem(SETTINGS_KEY) ?? '{}');
    } catch {
      return {};
    }
  }

  function load() {
    const real = realNow();
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.schema === SCHEMA_VERSION) {
          const away = real - parsed.lastRealAt;
          if (away > HOUR_MS) shiftDates(parsed.state, away);
          parsed.lastRealAt = real;
          return parsed;
        }
      }
    } catch {
      // Corrupt or unreadable storage — fall through to a fresh seed.
    }
    return { schema: SCHEMA_VERSION, state: createSeedState(new Date(real)), clockOffsetMs: 0, lastRealAt: real };
  }

  function persist() {
    db.lastRealAt = realNow();
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // Storage full or blocked: the demo keeps working in memory.
    }
  }

  function notify() {
    for (const l of listeners) l();
  }

  if (options.crossTab ?? typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          db = JSON.parse(event.newValue);
          notify();
        } catch {
          /* ignore malformed writes */
        }
      }
    });
  }

  const now = () => new Date(realNow() + db.clockOffsetMs);

  async function simulateNetwork(signal) {
    const [min, max] = settings.latencyMs;
    await wait(min + random() * Math.max(0, max - min), signal);
    if (settings.offline) throw new ApiError('offline', 'You appear to be offline. Showing the last information we had.');
    if (settings.failureRate > 0 && random() < settings.failureRate) {
      throw new ApiError('server', 'The library system did not respond. Please try again.');
    }
  }

  async function query(signal, read) {
    await simulateNetwork(signal);
    try {
      return structuredClone(read(db.state, now()));
    } catch (error) {
      throw toApiError(error);
    }
  }

  async function mutate(
    idempotencyKey,
    apply,
  ) {
    await simulateNetwork();
    if (idempotencyKey && idempotency.has(idempotencyKey)) return structuredClone(idempotency.get(idempotencyKey));
    const draft = structuredClone(db.state);
    let result;
    try {
      result = apply(draft, now());
    } catch (error) {
      throw toApiError(error);
    }
    if (checkInvariants) {
      const problems = findInvariantViolations(draft);
      if (problems.length) throw new ApiError('server', `Invariant violated: ${problems.join('; ')}`);
    }
    db.state = draft;
    persist();
    notify();
    const output = structuredClone(result);
    if (idempotencyKey) idempotency.set(idempotencyKey, output);
    return output;
  }

  // --- view builders -------------------------------------------------------

  const summary = (state, edition) => {
    const copies = state.copies.filter((c) => c.editionId === edition.id);
    const ids = new Set(copies.map((c) => c.id));
    return { edition, availability: summariseAvailability(copies, state.loans.filter((l) => !l.returnedAt && ids.has(l.copyId))) };
  };

  const locationText = (loc) => describeLocation(FLOOR_PLAN, loc)?.breadcrumb ?? `Rack ${loc.rackId}, shelf ${loc.shelf}`;

  const memberName = (state, id) => state.members.find((m) => m.id === id)?.name ?? 'Unknown member';

  const titleOfCopy = (state, copyId) => {
    const copy = state.copies.find((c) => c.id === copyId);
    return state.editions.find((e) => e.id === copy?.editionId)?.title ?? 'Unknown title';
  };

  const staffMember = (state, memberId, at) => {
    const { demoPin: _pin, ...member } = rules.getMember(state, memberId);
    const loans = rules.activeLoansForMember(state, memberId);
    return {
      member,
      activeLoans: loans.length,
      overdueLoans: loans.filter((l) => rules.loanState(l, at) === 'overdue').length,
      borrowing: rules.memberBorrowingEligibility(state, memberId, at),
    };
  };

  const loanRow = (state, loan, at) => {
    const member = state.members.find((m) => m.id === loan.memberId);
    return {
      loan,
      title: titleOfCopy(state, loan.copyId),
      barcode: state.copies.find((c) => c.id === loan.copyId)?.barcode ?? '',
      memberName: member?.name ?? 'Unknown',
      cardNumber: member?.cardNumber ?? '',
      state: rules.loanState(loan, at),
      daysOverdue: rules.daysOverdue(loan, at),
    };
  };

  const reservationRow = (state, r, at) => {
    const member = state.members.find((m) => m.id === r.memberId);
    return {
      reservation: r,
      title: rules.getEdition(state, r.editionId).title,
      memberName: member?.name ?? 'Unknown',
      cardNumber: member?.cardNumber ?? '',
      position: rules.queuePosition(state, r),
      barcode: r.copyId ? state.copies.find((c) => c.id === r.copyId)?.barcode : undefined,
      pickupExpired: r.status === 'ready' && !!r.pickupBy && new Date(r.pickupBy).getTime() < at.getTime(),
    };
  };

  const copyRow = (state, copy) => ({
    copy,
    title: rules.getEdition(state, copy.editionId).title,
    locationText: locationText(copy.location),
  });

  const sessionRow = (state, s, at) => ({
    session: s,
    title: titleOfCopy(state, s.copyId),
    barcode: state.copies.find((c) => c.id === s.copyId)?.barcode ?? '',
    memberName: memberName(state, s.memberId),
    isLong: rules.isLongSession(s, at),
  });

  const reportRow = (state, r) => {
    const copy = rules.getCopy(state, r.copyId);
    return { report: r, title: rules.getEdition(state, copy.editionId).title, barcode: copy.barcode, copyStatus: copy.status, locationText: locationText(copy.location) };
  };

  const copyByBarcode = (state, barcode) => {
    const copy = rules.findCopyByBarcode(state, barcode);
    if (!copy) throw new ApiError('not_found', `No copy with barcode “${barcode.trim()}”. Check the label and try again.`);
    return copy;
  };

  const sameDay = (a, b) => a.toDateString() === b.toDateString();

  // --- API -----------------------------------------------------------------

  const api = {
    getHome: ({ signal } = {}) =>
      query(signal, (state, at) => {
        const all = state.editions.map((e) => summary(state, e));
        const genreCounts = Object.fromEntries(Object.keys(GENRES).map((g) => [g, 0]));
        for (const e of state.editions) for (const g of e.genres) genreCounts[g] += 1;
        return {
          staffPicks: all.filter((s) => s.edition.recommendation).slice(0, 8),
          newArrivals: [...all].sort((a, b) => b.edition.addedAt.localeCompare(a.edition.addedAt)).slice(0, 8),
          availableNow: all.filter((s) => s.availability.lendableOnShelf > 0).length,
          totalTitles: all.length,
          genreCounts,
          asOf: at.toISOString(),
        };
      }),

    searchBooks: (params, { signal } = {}) =>
      query(signal, (state, at) => {
        const scored = state.editions
          .map((edition) => ({
            edition,
            score: scoreMatch(params.q, {
              title: edition.title,
              authors: edition.authors,
              keywords: [
                ...edition.themes,
                ...edition.tags.map((t) => INTEREST_TAGS[t].label),
                ...edition.genres.map((g) => GENRES[g].label),
                edition.description,
              ],
            }),
          }))
          .filter(({ edition, score }) => {
            if (score === 0) return false;
            if (params.genres.length && !edition.genres.some((g) => params.genres.includes(g))) return false;
            if (params.languages.length && !params.languages.includes(edition.language)) return false;
            if (params.tags.length && !edition.tags.some((t) => params.tags.includes(t))) return false;
            return true;
          })
          .map(({ edition, score }) => ({ ...summary(state, edition), score }))
          .filter(({ availability }) => {
            if (params.availability === 'borrow-now') return availability.lendableOnShelf > 0;
            if (params.availability === 'on-shelf') return availability.onShelf > 0;
            return true;
          });

        const byTitle = (a, b) => sortTitle(a.edition.title).localeCompare(sortTitle(b.edition.title));
        const comparators = {
          relevance: (a, b) => b.score - a.score || b.availability.lendableOnShelf - a.availability.lendableOnShelf || byTitle(a, b),
          title: byTitle,
          author: (a, b) => surname(a.edition).localeCompare(surname(b.edition)) || byTitle(a, b),
          newest: (a, b) => b.edition.addedAt.localeCompare(a.edition.addedAt),
          published: (a, b) => a.edition.firstPublished - b.edition.firstPublished || byTitle(a, b),
        };
        scored.sort(comparators[params.sort]);

        const pageCount = Math.max(1, Math.ceil(scored.length / PAGE_SIZE));
        const page = Math.min(params.page, pageCount);
        return {
          items: scored.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(({ edition, availability }) => ({ edition, availability })),
          total: scored.length,
          page,
          pageCount,
          asOf: at.toISOString(),
        };
      }),

    getBook: (editionId, { signal } = {}) =>
      query(signal, (state, at) => {
        const edition = state.editions.find((e) => e.id === editionId);
        if (!edition) throw new ApiError('not_found', 'We couldn’t find that book. It may have been withdrawn.');
        const copies = state.copies
          .filter((c) => c.editionId === editionId)
          .map((c) => ({
            id: c.id,
            barcode: c.barcode,
            policy: c.policy,
            status: c.status,
            location: c.location,
            dueAt: c.status === 'on_loan' ? rules.activeLoanForCopy(state, c.id)?.dueAt : undefined,
          }));
        const similar = state.editions
          .filter((e) => e.id !== editionId)
          .map((e) => ({
            e,
            score:
              e.genres.filter((g) => edition.genres.includes(g)).length * 2 +
              e.tags.filter((t) => edition.tags.includes(t)).length +
              (e.authors.some((a) => edition.authors.includes(a)) ? 3 : 0),
          }))
          .filter((x) => x.score > 1)
          .sort((a, b) => b.score - a.score || a.e.title.localeCompare(b.e.title))
          .slice(0, 4)
          .map((x) => summary(state, x.e));
        return { ...summary(state, edition), copies, similar, queueLength: rules.waitingQueue(state, editionId).length, asOf: at.toISOString() };
      }),

    getFloorPlan: ({ signal } = {}) => query(signal, () => FLOOR_PLAN),

    reportCopyIssue: (input, { idempotencyKey } = {}) => mutate(idempotencyKey, (draft, at) => rules.reportCopy(draft, input, at)),

    memberSignIn: async (cardNumber, pin) => {
      await simulateNetwork();
      const member = db.state.members.find((m) => m.cardNumber === cardNumber.replace(/\s+/g, ''));
      if (!member || member.demoPin !== pin.trim()) {
        throw new ApiError('validation', 'That card number and PIN don’t match our records. Check both and try again.');
      }
      return { memberId: member.id, name: member.name, token: `demo-${member.id}-${realNow()}` };
    },

    getMemberOverview: (memberId, { signal } = {}) =>
      query(signal, (state, at) => {
        const member = rules.getMember(state, memberId);
        const loans = rules
          .activeLoansForMember(state, memberId)
          .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
          .map((loan) => ({
            loan,
            edition: rules.getEdition(state, rules.getCopy(state, loan.copyId).editionId),
            state: rules.loanState(loan, at),
            daysOverdue: rules.daysOverdue(loan, at),
            renewal: rules.renewalEligibility(state, loan.id, at),
          }));
        const reservations = state.reservations
          .filter((r) => r.memberId === memberId && (r.status === 'waiting' || r.status === 'ready' || (r.closedAt && at.getTime() - new Date(r.closedAt).getTime() < 7 * DAY_MS)))
          .sort((a, b) => (a.status === 'ready' ? -1 : 0) - (b.status === 'ready' ? -1 : 0) || a.sequence - b.sequence)
          .map((reservation) => ({
            reservation,
            edition: rules.getEdition(state, reservation.editionId),
            position: rules.queuePosition(state, reservation),
            pickupLocation: reservation.status === 'ready' ? 'Hold shelf beside the help desk, ground floor' : undefined,
          }));
        return {
          member: { id: member.id, name: member.name, standing: member.standing, savedEditionIds: member.savedEditionIds },
          loans,
          reservations,
          saved: member.savedEditionIds.map((id) => summary(state, rules.getEdition(state, id))),
          borrowing: rules.memberBorrowingEligibility(state, memberId, at),
          asOf: at.toISOString(),
        };
      }),

    toggleSaved: (memberId, editionId) => mutate(undefined, (draft) => ({ saved: rules.toggleSaved(draft, memberId, editionId) })),

    getReservationEligibility: (memberId, editionId, { signal } = {}) =>
      query(signal, (state) => ({ ...rules.reservationEligibility(state, memberId, editionId), queueLength: rules.waitingQueue(state, editionId).length })),

    reserve: (memberId, editionId, { idempotencyKey } = {}) =>
      mutate(idempotencyKey, (draft, at) => {
        const reservation = rules.reserve(draft, memberId, editionId, at);
        return { reservation, position: rules.queuePosition(draft, reservation) ?? 1 };
      }),

    cancelReservation: (id, { idempotencyKey } = {}) => mutate(idempotencyKey, (draft, at) => rules.cancelReservation(draft, id, at)),

    renewLoan: (loanId, { idempotencyKey } = {}) => mutate(idempotencyKey, (draft, at) => rules.renew(draft, loanId, at)),

    getStaffOverview: ({ signal } = {}) =>
      query(signal, (state, at) => {
        const active = state.loans.filter((l) => !l.returnedAt);
        const ready = state.reservations.filter((r) => r.status === 'ready').map((r) => reservationRow(state, r, at));
        return {
          overdue: active
            .filter((l) => rules.loanState(l, at) === 'overdue')
            .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
            .map((l) => loanRow(state, l, at)),
          dueToday: active.filter((l) => sameDay(new Date(l.dueAt), at)).length,
          readyForPickup: ready.filter((r) => !r.pickupExpired),
          expiredPickups: ready.filter((r) => r.pickupExpired),
          reshelving: state.copies.filter((c) => c.status === 'awaiting_reshelving').map((c) => copyRow(state, c)),
          openReports: state.reports.filter((r) => !r.resolvedAt).map((r) => reportRow(state, r)),
          activeSessions: state.sessions.filter((s) => !s.endedAt).map((s) => sessionRow(state, s, at)),
          loansIssuedToday: state.loans.filter((l) => sameDay(new Date(l.issuedAt), at)).length,
          returnsToday: state.loans.filter((l) => l.returnedAt && sameDay(new Date(l.returnedAt), at)).length,
          asOf: at.toISOString(),
        };
      }),

    findMembers: (q, { signal } = {}) =>
      query(signal, (state, at) => {
        const needle = normalise(q.trim());
        if (!needle) return [];
        return state.members
          .filter((m) => m.cardNumber.includes(needle.replace(/\s+/g, '')) || normalise(m.name).includes(needle))
          .slice(0, 6)
          .map((m) => staffMember(state, m.id, at));
      }),

    getStaffMember: (memberId, { signal } = {}) => query(signal, (state, at) => staffMember(state, memberId, at)),

    lookupCopy: (barcode, { signal } = {}) =>
      query(signal, (state, at) => {
        const copy = copyByBarcode(state, barcode);
        const loan = rules.activeLoanForCopy(state, copy.id);
        const session = rules.activeSessionForCopy(state, copy.id);
        const hold = state.reservations.find((r) => r.id === copy.heldForReservationId && r.status === 'ready');
        return {
          copy,
          edition: rules.getEdition(state, copy.editionId),
          locationText: locationText(copy.location),
          activeLoan: loan ? { loan, memberName: memberName(state, loan.memberId), state: rules.loanState(loan, at) } : undefined,
          activeSession: session ? { session, memberName: memberName(state, session.memberId) } : undefined,
          hold: hold ? { reservation: hold, memberName: memberName(state, hold.memberId) } : undefined,
          waitingCount: rules.waitingQueue(state, copy.editionId).length,
        };
      }),

    previewCheckout: (memberId, barcode, { signal } = {}) =>
      query(signal, (state, at) => {
        const copy = copyByBarcode(state, barcode);
        const preview = rules.previewCheckout(state, memberId, copy.id, at);
        return { ...preview, collectsReservation: !!preview.collectsReservation, member: staffMember(state, memberId, at) };
      }),

    checkout: (input, { idempotencyKey } = {}) => mutate(idempotencyKey, (draft, at) => rules.checkout(draft, input, at)),

    returnCopy: ({ copyId }, { idempotencyKey } = {}) =>
      mutate(idempotencyKey, (draft, at) => {
        const outcome = rules.returnCopy(draft, copyId, at);
        const base = {
          title: rules.getEdition(draft, outcome.copy.editionId).title,
          barcode: outcome.copy.barcode,
          memberName: memberName(draft, outcome.loan.memberId),
          wasOverdueDays: Math.max(0, Math.ceil((at.getTime() - new Date(outcome.loan.dueAt).getTime()) / DAY_MS)),
        };
        return outcome.kind === 'hold'
          ? { ...base, kind: 'hold', holdFor: memberName(draft, outcome.reservation.memberId), pickupBy: outcome.reservation.pickupBy }
          : { ...base, kind: 'reshelve' };
      }),

    startSession: (input, { idempotencyKey } = {}) => mutate(idempotencyKey, (draft, at) => rules.startReadingSession(draft, input, at)),

    endSession: (id, { idempotencyKey } = {}) => mutate(idempotencyKey, (draft, at) => rules.endReadingSession(draft, id, at)),

    reshelve: (copyId, { idempotencyKey } = {}) =>
      mutate(idempotencyKey, (draft, at) => {
        const held = rules.reshelve(draft, copyId, at);
        return { heldFor: held ? memberName(draft, held.memberId) : undefined };
      }),

    listLoans: ({ signal } = {}) =>
      query(signal, (state, at) =>
        state.loans
          .filter((l) => !l.returnedAt)
          .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
          .map((l) => loanRow(state, l, at)),
      ),

    listReservations: ({ signal } = {}) =>
      query(signal, (state, at) =>
        state.reservations
          .filter((r) => r.status === 'waiting' || r.status === 'ready' || (r.closedAt && at.getTime() - new Date(r.closedAt).getTime() < 7 * DAY_MS))
          .sort((a, b) => a.sequence - b.sequence)
          .map((r) => reservationRow(state, r, at)),
      ),

    expireReservation: (id, { idempotencyKey } = {}) => mutate(idempotencyKey, (draft, at) => rules.expireReservation(draft, id, at)),

    listSessions: ({ signal } = {}) =>
      query(signal, (state, at) =>
        state.sessions
          .filter((s) => !s.endedAt || at.getTime() - new Date(s.endedAt).getTime() < DAY_MS)
          .sort((a, b) => Number(!!a.endedAt) - Number(!!b.endedAt) || a.startedAt.localeCompare(b.startedAt))
          .map((s) => sessionRow(state, s, at)),
      ),

    listCatalogue: (q, { signal } = {}) =>
      query(signal, (state) =>
        state.editions
          .filter((e) => {
            const needle = q.trim();
            if (!needle) return true;
            if (scoreMatch(needle, { title: e.title, authors: e.authors, keywords: [] }) > 0) return true;
            return state.copies.some((c) => c.editionId === e.id && c.barcode.includes(needle.toUpperCase()));
          })
          .sort((a, b) => sortTitle(a.title).localeCompare(sortTitle(b.title)))
          .map((e) => ({
            ...summary(state, e),
            copies: state.copies.filter((c) => c.editionId === e.id).map((c) => copyRow(state, c)),
          })),
      ),

    updateCopy: (input, { idempotencyKey } = {}) => mutate(idempotencyKey, (draft, at) => rules.updateCopy(draft, input, at)),

    addCopy: (input, { idempotencyKey } = {}) => mutate(idempotencyKey, (draft, at) => rules.addCopy(draft, input, at)),

    listReports: ({ signal } = {}) =>
      query(signal, (state) =>
        [...state.reports]
          .sort((a, b) => Number(!!a.resolvedAt) - Number(!!b.resolvedAt) || b.createdAt.localeCompare(a.createdAt))
          .map((r) => reportRow(state, r)),
      ),

    resolveReport: (id, resolution, { idempotencyKey } = {}) =>
      mutate(idempotencyKey, (draft, at) => rules.resolveReport(draft, id, resolution, at)),

    getClock: async () => ({ now: now().toISOString(), offsetMs: db.clockOffsetMs }),

    advanceClock: async (ms) => {
      db.clockOffsetMs += ms;
      // Scheduled jobs run as time passes, as they would on a server.
      const draft = structuredClone(db.state);
      rules.runScheduledJobs(draft, now());
      db.state = draft;
      persist();
      notify();
      return { now: now().toISOString(), offsetMs: db.clockOffsetMs };
    },

    runScheduledJobs: () => mutate(undefined, (draft, at) => rules.runScheduledJobs(draft, at)),

    listEvents: ({ signal } = {}) => query(signal, (state) => state.events.slice(0, 100)),

    resetDemo: async () => {
      db = { schema: SCHEMA_VERSION, state: createSeedState(new Date(realNow())), clockOffsetMs: 0, lastRealAt: realNow() };
      idempotency.clear();
      persist();
      notify();
    },

    getSettings: () => settings,

    updateSettings: (patch) => {
      settings = { ...settings, ...patch };
      try {
        storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch {
        /* ignore */
      }
      notify();
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return api;
}

function toApiError(error) {
  if (!(error instanceof DomainError)) return error;
  switch (error.code) {
    case 'not_found':
      return new ApiError('not_found', error.message, error.code);
    case 'version_conflict':
    case 'copy_unavailable':
      return new ApiError('conflict', error.message, error.code);
    default:
      return new ApiError('validation', error.message, error.code);
  }
}
