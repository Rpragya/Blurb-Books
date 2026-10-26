import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { useApi } from './ApiContext';

/**
 * Query keys are grouped by audience so a session end can drop every
 * ['member', …] entry in one call, and mutations can refresh everything that
 * might show a copy's status.
 */
export const keys = {
  home: ['catalogue', 'home'],
  search: (p) => ['catalogue', 'search', p],
  book: (id) => ['catalogue', 'book', id],
  floorPlan: ['catalogue', 'floor-plan'],
  member: (id) => ['member', id, 'overview'],
  reservationEligibility: (memberId, editionId) => ['member', memberId, 'can-reserve', editionId],
  staff: ['staff'],
  staffOverview: ['staff', 'overview'],
  loans: ['staff', 'loans'],
  reservations: ['staff', 'reservations'],
  sessions: ['staff', 'sessions'],
  catalogue: (q) => ['staff', 'catalogue', q],
  reports: ['staff', 'reports'],
  memberSearch: (q) => ['staff', 'member-search', q],
  staffMember: (id) => ['staff', 'member', id],
  copy: (barcode) => ['staff', 'copy', barcode],
  checkoutPreview: (memberId, barcode) => ['staff', 'checkout-preview', memberId, barcode],
  events: ['demo', 'events'],
  clock: ['demo', 'clock'],
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
export function useSearch(params) {
  const api = useApi();
  return useQuery({
    queryKey: keys.search(params),
    queryFn: ({ signal }) => api.searchBooks(params, { signal }),
    placeholderData: keepPreviousData,
  });
}

export function useBook(id) {
  const api = useApi();
  return useQuery({
    queryKey: keys.book(id ?? ''),
    queryFn: ({ signal }) => api.getBook(id, { signal }),
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

export function useMemberOverview(memberId) {
  const api = useApi();
  return useQuery({
    queryKey: keys.member(memberId ?? ''),
    queryFn: ({ signal }) => api.getMemberOverview(memberId, { signal }),
    enabled: !!memberId,
    // Personal data is never kept around after it leaves the screen.
    gcTime: 0,
  });
}

export function useReservationEligibility(memberId, editionId) {
  const api = useApi();
  return useQuery({
    queryKey: keys.reservationEligibility(memberId ?? '', editionId),
    queryFn: ({ signal }) => api.getReservationEligibility(memberId, editionId, { signal }),
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
export function useLibraryMutation(
  run,
  options = {},
) {
  const api = useApi();
  const queryClient = useQueryClient();
  const last = useRef();
  return useMutation({
    mutationFn: (vars) => {
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
