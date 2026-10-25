import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import type { SearchParams } from '../domain/search';
import { useApi } from './ApiContext';
import type { LibraryApi, MutationOptions } from './types';

/**
 * Query keys are grouped by audience so a session end can drop every
 * ['member', …] entry in one call, and mutations can refresh everything that
 * might show a copy's status.
 */
export const keys = {
  home: ['catalogue', 'home'] as const,
  search: (p: SearchParams) => ['catalogue', 'search', p] as const,
  book: (id: string) => ['catalogue', 'book', id] as const,
  floorPlan: ['catalogue', 'floor-plan'] as const,
  member: (id: string) => ['member', id, 'overview'] as const,
  reservationEligibility: (memberId: string, editionId: string) => ['member', memberId, 'can-reserve', editionId] as const,
  staff: ['staff'] as const,
  staffOverview: ['staff', 'overview'] as const,
  loans: ['staff', 'loans'] as const,
  reservations: ['staff', 'reservations'] as const,
  sessions: ['staff', 'sessions'] as const,
  catalogue: (q: string) => ['staff', 'catalogue', q] as const,
  reports: ['staff', 'reports'] as const,
  memberSearch: (q: string) => ['staff', 'member-search', q] as const,
  staffMember: (id: string) => ['staff', 'member', id] as const,
  copy: (barcode: string) => ['staff', 'copy', barcode] as const,
  checkoutPreview: (memberId: string, barcode: string) => ['staff', 'checkout-preview', memberId, barcode] as const,
  events: ['demo', 'events'] as const,
  clock: ['demo', 'clock'] as const,
};

export function useHome() {
  const api = useApi();
  return useQuery({ queryKey: keys.home, queryFn: ({ signal }) => api.getHome({ signal }) });
}

/**
 * Each parameter set is its own cache entry, so a slow response for an old
 * query can never overwrite a newer one. TanStack Query aborts the signal of
 * a superseded request; previous results stay visible (dimmed) meanwhile.
 */
export function useSearch(params: SearchParams) {
  const api = useApi();
  return useQuery({
    queryKey: keys.search(params),
    queryFn: ({ signal }) => api.searchBooks(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useBook(id: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: keys.book(id ?? ''),
    queryFn: ({ signal }) => api.getBook(id!, { signal }),
    enabled: !!id,
  });
}

/** The floor plan rarely changes: cache it for the whole session (offline-friendly). */
export function useFloorPlan() {
  const api = useApi();
  return useQuery({
    queryKey: keys.floorPlan,
    queryFn: ({ signal }) => api.getFloorPlan({ signal }),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useMemberOverview(memberId: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: keys.member(memberId ?? ''),
    queryFn: ({ signal }) => api.getMemberOverview(memberId!, { signal }),
    enabled: !!memberId,
    // Personal data is never kept around after it leaves the screen.
    gcTime: 0,
  });
}

export function useReservationEligibility(memberId: string | undefined, editionId: string) {
  const api = useApi();
  return useQuery({
    queryKey: keys.reservationEligibility(memberId ?? '', editionId),
    queryFn: ({ signal }) => api.getReservationEligibility(memberId!, editionId, { signal }),
    enabled: !!memberId,
    gcTime: 0,
  });
}

function newKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Mutation wrapper used for every write:
 * - one idempotency key per distinct payload, reused if the same payload is
 *   retried after a failure, replaced after success;
 * - no automatic retries (the user decides, with their input preserved);
 * - refreshes every query afterwards so all views agree.
 */
export function useLibraryMutation<V, R>(
  run: (api: LibraryApi, vars: V, opts: MutationOptions) => Promise<R>,
  options: { onSuccess?: (result: R, vars: V) => void } = {},
) {
  const api = useApi();
  const queryClient = useQueryClient();
  const last = useRef<{ payload: string; key: string }>();
  return useMutation({
    mutationFn: (vars: V) => {
      const payload = JSON.stringify(vars ?? null);
      if (!last.current || last.current.payload !== payload) last.current = { payload, key: newKey() };
      return run(api, vars, { idempotencyKey: last.current.key });
    },
    onSuccess: (result, vars) => {
      last.current = undefined;
      options.onSuccess?.(result, vars);
    },
    onSettled: () => queryClient.invalidateQueries(),
    retry: false,
  });
}
