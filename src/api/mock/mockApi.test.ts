import { describe, expect, it } from 'vitest';
import { DEFAULT_SEARCH } from '../../domain/search';
import { ApiError } from '../types';
import { createMockApi } from './mockApi';

const make = () => createMockApi({ storage: null, settings: { latencyMs: [0, 0], failureRate: 0, offline: false }, checkInvariants: true, crossTab: false });

describe('mock API', () => {
  it('searches with filters and pagination', async () => {
    const api = make();
    const all = await api.searchBooks(DEFAULT_SEARCH);
    expect(all.total).toBe(37);
    expect(all.items).toHaveLength(12);
    const mystery = await api.searchBooks({ ...DEFAULT_SEARCH, genres: ['mystery'], availability: 'borrow-now' });
    expect(mystery.items.every((i) => i.availability.lendableOnShelf > 0)).toBe(true);
    const fr = await api.searchBooks({ ...DEFAULT_SEARCH, languages: ['fr'] });
    expect(fr.total).toBe(2);
  });

  it('rejects with AbortError when cancelled', async () => {
    const api = createMockApi({ storage: null, settings: { latencyMs: [50, 50], failureRate: 0, offline: false }, crossTab: false });
    const controller = new AbortController();
    const pending = api.searchBooks(DEFAULT_SEARCH, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('applies a mutation once per idempotency key', async () => {
    const api = make();
    const preview = await api.previewCheckout('m-noor', 'BB000101');
    const input = { memberId: 'm-noor', copyId: preview.copy.id, expectedVersion: preview.copy.version };
    const first = await api.checkout(input, { idempotencyKey: 'k1' });
    const retry = await api.checkout(input, { idempotencyKey: 'k1' });
    expect(retry.id).toBe(first.id);
    await expect(api.checkout(input, { idempotencyKey: 'k2' })).rejects.toMatchObject({ kind: 'conflict' });
  });

  it('returns a conflict when two desks race for one copy', async () => {
    const api = make();
    const a = await api.previewCheckout('m-noor', 'BB000101');
    const b = await api.previewCheckout('m-tom', 'BB000101');
    const results = await Promise.allSettled([
      api.checkout({ memberId: 'm-noor', copyId: a.copy.id, expectedVersion: a.copy.version }),
      api.checkout({ memberId: 'm-tom', copyId: b.copy.id, expectedVersion: b.copy.version }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ApiError);
    expect(rejected.reason.kind).toBe('conflict');
  });

  it('fails while offline without changing data', async () => {
    const api = make();
    api.updateSettings({ offline: true });
    await expect(api.reserve('m-noor', 'dracula')).rejects.toMatchObject({ kind: 'offline' });
    api.updateSettings({ offline: false });
    const overview = await api.getMemberOverview('m-noor');
    expect(overview.reservations).toHaveLength(0);
  });

  it('never exposes borrower identity on public book detail', async () => {
    const api = make();
    const detail = await api.getBook('dracula');
    expect(JSON.stringify(detail)).not.toMatch(/m-tom|Tom Becker|m-lin/);
    expect(detail.queueLength).toBe(1);
  });
});
