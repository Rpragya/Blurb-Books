import type { LibraryState } from './types';

/**
 * Cross-record consistency checks. Used by tests and by the mock adapter in
 * development to catch any mutation that leaves copies and circulation
 * records disagreeing.
 */
export function findInvariantViolations(state: LibraryState): string[] {
  const problems: string[] = [];
  const editionIds = new Set(state.editions.map((e) => e.id));
  const barcodes = new Set<string>();

  for (const copy of state.copies) {
    if (!editionIds.has(copy.editionId)) problems.push(`${copy.id}: unknown edition ${copy.editionId}`);
    if (barcodes.has(copy.barcode)) problems.push(`${copy.id}: duplicate barcode ${copy.barcode}`);
    barcodes.add(copy.barcode);

    const activeLoans = state.loans.filter((l) => l.copyId === copy.id && !l.returnedAt);
    if (activeLoans.length > 1) problems.push(`${copy.id}: ${activeLoans.length} active loans`);
    if ((copy.status === 'on_loan') !== (activeLoans.length === 1)) {
      problems.push(`${copy.id}: status ${copy.status} but ${activeLoans.length} active loan(s)`);
    }
    if (copy.policy === 'reference' && activeLoans.length > 0) problems.push(`${copy.id}: reference copy on loan`);

    const activeSessions = state.sessions.filter((s) => s.copyId === copy.id && !s.endedAt);
    if ((copy.status === 'in_library_use') !== (activeSessions.length === 1) || activeSessions.length > 1) {
      problems.push(`${copy.id}: status ${copy.status} but ${activeSessions.length} active session(s)`);
    }

    const holds = state.reservations.filter((r) => r.status === 'ready' && r.copyId === copy.id);
    if ((copy.status === 'on_hold_shelf') !== (holds.length === 1) || holds.length > 1) {
      problems.push(`${copy.id}: status ${copy.status} but ${holds.length} ready reservation(s)`);
    }
    if (holds[0] && copy.heldForReservationId !== holds[0].id) problems.push(`${copy.id}: heldFor mismatch`);
    if (holds[0] && holds[0].editionId !== copy.editionId) problems.push(`${copy.id}: held for another edition`);
  }

  const sequences = new Set<number>();
  for (const r of state.reservations) {
    if (r.status === 'waiting' || r.status === 'ready') {
      if (sequences.has(r.sequence)) problems.push(`${r.id}: duplicate queue sequence ${r.sequence}`);
      sequences.add(r.sequence);
    }
  }
  return problems;
}
