import { POLICY, DAY_MS, HOUR_MS, endOfDay } from '../../domain/policy';
import type { BookCopy, CopyStatus, LibraryState, LoanPolicy, Member } from '../../domain/types';
import { EDITION_SEEDS } from './editions';

type CopySpec = [rack: string, shelf: number, opts?: { policy?: LoanPolicy; status?: CopyStatus }];

/**
 * Physical copies per edition. Statuses for loans, sessions and holds are NOT
 * set here — they are derived below from the circulation records so the two
 * can never disagree.
 */
const COPIES: Record<string, CopySpec[]> = {
  mapleford: [['M3', 3], ['M3', 3]],
  holmes: [['M1', 3], ['M1', 3]],
  hound: [['M1', 3]],
  moonstone: [['M1', 2, { status: 'awaiting_reshelving' }]],
  'woman-in-white': [['M1', 2, { status: 'missing' }], ['M1', 2, { status: 'in_repair' }]],
  'rue-morgue': [['M2', 4]],
  dracula: [['M3', 1], ['M3', 1]],
  frankenstein: [['S2', 3], ['S2', 3], ['S2', 3]],
  dorian: [['F4', 3]],
  'time-machine': [['S2', 4], ['S2', 4]],
  'war-of-the-worlds': [['S2', 4]],
  'salt-and-signal': [['S2', 2], ['S2', 2]],
  cartographer: [['S1', 2]],
  'harry-potter': [['S1', 4], ['S1', 4], ['C2', 3]],
  alice: [['C1', 2], ['C1', 2]],
  oz: [['C1', 1]],
  'peter-pan': [['C1', 1]],
  'secret-garden': [['C1', 2], ['C1', 2, { status: 'awaiting_reshelving' }]],
  pride: [['F1', 2], ['F1', 2], ['F1', 2, { policy: 'reference' }]],
  'jane-eyre': [['F1', 3]],
  'monsoon-letters': [['F3', 1], ['F3', 1]],
  'little-women': [['F1', 1]],
  'two-cities': [['F2', 1]],
  'moby-dick': [['F3', 1], ['F3', 1]],
  'treasure-island': [['F3', 4], ['C2', 3]],
  'monte-cristo': [['L1', 2]],
  'vingt-mille-lieues': [['L1', 3]],
  quijote: [['L1', 4]],
  verwandlung: [['L2', 1]],
  'anna-karenina': [['L2', 3]],
  commedia: [['L2', 2, { policy: 'reference' }]],
  godan: [['L2', 4]],
  meditations: [['N1', 1], ['N1', 1, { status: 'awaiting_reshelving' }]],
  'big-questions': [['R1', 2, { policy: 'reference' }]],
  'origin-of-species': [['R1', 1, { policy: 'reference' }]],
  'leaves-of-grass': [['P1', 4]],
  gitanjali: [['P1', 3]],
};

const MEMBERS: Member[] = [
  { id: 'm-asha', name: 'Asha Verma', cardNumber: '20010001', demoPin: '1234', standing: 'good', savedEditionIds: ['moby-dick', 'gitanjali', 'dorian'] },
  { id: 'm-tom', name: 'Tom Becker', cardNumber: '20010002', demoPin: '2345', standing: 'good', savedEditionIds: ['salt-and-signal'] },
  { id: 'm-lin', name: 'Lin Zhou', cardNumber: '20010003', demoPin: '3456', standing: 'good', savedEditionIds: ['cartographer', 'meditations'] },
  { id: 'm-rafa', name: 'Rafael Ortiz', cardNumber: '20010004', demoPin: '4567', standing: 'good', savedEditionIds: [] },
  { id: 'm-noor', name: 'Noor Haddad', cardNumber: '20010005', demoPin: '5678', standing: 'good', savedEditionIds: [] },
  { id: 'm-ellie', name: 'Ellie Park', cardNumber: '20010006', demoPin: '6789', standing: 'suspended', savedEditionIds: [] },
];

/** [copyId, memberId, issuedDaysAgo, renewals] — due date derives from policy. */
const LOANS: [string, string, number, number][] = [
  ['mapleford-2', 'm-asha', 8, 0],
  ['holmes-1', 'm-asha', 17, 0],
  ['little-women-1', 'm-asha', 2, 0],
  ['anna-karenina-1', 'm-asha', 33, 2],
  ['hound-1', 'm-tom', 12, 0],
  ['dracula-1', 'm-tom', 10, 0],
  ['harry-potter-3', 'm-tom', 4, 0],
  ['dracula-2', 'm-lin', 6, 0],
  ['harry-potter-2', 'm-lin', 13, 0],
  ['salt-and-signal-2', 'm-lin', 3, 0],
  ['jane-eyre-1', 'm-rafa', 34, 0],
  ['moby-dick-1', 'm-rafa', 16, 0],
];

export function createSeedState(now: Date): LibraryState {
  const t = now.getTime();
  const daysAgo = (d: number) => new Date(t - d * DAY_MS).toISOString();
  const hoursAgo = (h: number) => new Date(t - h * HOUR_MS).toISOString();

  let barcode = 100;
  const copies: BookCopy[] = [];
  for (const edition of EDITION_SEEDS) {
    const specs = COPIES[edition.id] ?? [];
    specs.forEach(([rackId, shelf, opts], i) => {
      barcode += 1;
      copies.push({
        id: `${edition.id}-${i + 1}`,
        barcode: `BB${String(barcode).padStart(6, '0')}`,
        editionId: edition.id,
        policy: opts?.policy ?? 'lendable',
        status: opts?.status ?? 'available',
        location: { rackId, shelf },
        version: 1,
        updatedAt: daysAgo(30),
      });
    });
  }
  const copy = (id: string) => {
    const found = copies.find((c) => c.id === id);
    if (!found) throw new Error(`Seed references unknown copy ${id}`);
    return found;
  };

  const loans = LOANS.map(([copyId, memberId, issuedDaysAgo, renewals], i) => {
    copy(copyId).status = 'on_loan';
    const issuedAt = daysAgo(issuedDaysAgo);
    return {
      id: `loan-seed-${i + 1}`,
      copyId,
      memberId,
      issuedAt,
      dueAt: endOfDay(new Date(t - issuedDaysAgo * DAY_MS + POLICY.loanDays * (renewals + 1) * DAY_MS).toISOString()),
      renewals,
    };
  });

  const sessions = [
    { id: 'session-seed-1', copyId: 'frankenstein-3', memberId: 'm-lin', startedAt: hoursAgo(0.7) },
    { id: 'session-seed-2', copyId: 'leaves-of-grass-1', memberId: 'm-asha', startedAt: hoursAgo(4.2) },
  ];
  for (const s of sessions) copy(s.copyId).status = 'in_library_use';

  const reservations: LibraryState['reservations'] = [
    { id: 'res-seed-1', editionId: 'oz', memberId: 'm-lin', sequence: 1, createdAt: daysAgo(9), status: 'ready', copyId: 'oz-1', readyAt: daysAgo(4), pickupBy: endOfDay(daysAgo(1)) },
    { id: 'res-seed-2', editionId: 'oz', memberId: 'm-tom', sequence: 2, createdAt: daysAgo(7), status: 'waiting' },
    { id: 'res-seed-3', editionId: 'alice', memberId: 'm-asha', sequence: 3, createdAt: daysAgo(6), status: 'ready', copyId: 'alice-2', readyAt: daysAgo(1), pickupBy: endOfDay(new Date(t + 2 * DAY_MS).toISOString()) },
    { id: 'res-seed-4', editionId: 'hound', memberId: 'm-lin', sequence: 4, createdAt: daysAgo(5), status: 'waiting' },
    { id: 'res-seed-5', editionId: 'dracula', memberId: 'm-asha', sequence: 5, createdAt: daysAgo(3), status: 'waiting' },
    { id: 'res-seed-6', editionId: 'two-cities', memberId: 'm-tom', sequence: 0, createdAt: daysAgo(40), status: 'collected', closedAt: daysAgo(30) },
  ];
  for (const r of reservations) {
    if (r.status === 'ready' && r.copyId) {
      const held = copy(r.copyId);
      held.status = 'on_hold_shelf';
      held.heldForReservationId = r.id;
    }
  }

  const reports: LibraryState['reports'] = [
    { id: 'report-seed-1', copyId: 'salt-and-signal-1', kind: 'not_on_shelf', source: 'kiosk', note: 'Checked rack S2 twice — not there.', createdAt: hoursAgo(2) },
    { id: 'report-seed-2', copyId: 'time-machine-1', kind: 'misplaced', source: 'staff', note: 'Spotted in the Children’s Corner (C2) during the morning round.', createdAt: daysAgo(1) },
    { id: 'report-seed-3', copyId: 'woman-in-white-1', kind: 'not_on_shelf', source: 'kiosk', note: '', createdAt: daysAgo(20), resolvedAt: daysAgo(18), resolution: 'marked_missing' },
  ];

  return {
    editions: EDITION_SEEDS.map(({ addedDaysAgo, ...e }) => ({ ...e, addedAt: daysAgo(addedDaysAgo) })),
    copies,
    members: MEMBERS.map((m) => ({ ...m, savedEditionIds: [...m.savedEditionIds] })),
    loans,
    reservations,
    sessions,
    reports,
    events: [],
    nextSequence: 6,
    idCounter: 1000,
  };
}
