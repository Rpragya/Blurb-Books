import { describe, expect, it } from 'vitest';
import { createSeedState } from '../api/mock/seed';
import { summariseAvailability } from './availability';

const state = createSeedState(new Date('2026-03-10T10:00:00Z'));
const summary = (editionId) => {
  const copies = state.copies.filter((c) => c.editionId === editionId);
  return summariseAvailability(copies, state.loans.filter((l) => !l.returnedAt));
};

describe('summariseAvailability', () => {
  it.each([
    ['pride', 'available', 'Two copies available'],
    ['holmes', 'available', 'One copy available'],
    ['dracula', 'all_on_loan', 'All copies on loan'],
    ['origin-of-species', 'reference_only', 'In-library use only'],
    ['moonstone', 'reshelving', 'Awaiting reshelving'],
    ['woman-in-white', 'unavailable', 'Temporarily unavailable'],
    ['oz', 'unavailable', 'Temporarily unavailable'],
  ])('%s → %s', (id, kind, label) => {
    expect(summary(id)).toMatchObject({ kind, label });
  });

  it('gives the next due date when everything is on loan', () => {
    expect(summary('dracula').detail).toMatch(/Next due back/);
  });
});
