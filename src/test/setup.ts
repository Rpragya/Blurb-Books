import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// React Router's data router creates a Request with jsdom's AbortSignal, which
// Node's fetch (undici) rejects. Drop the foreign signal in tests only.
const NodeRequest = globalThis.Request;
globalThis.Request = class extends NodeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    const { signal: _signal, ...rest } = init ?? {};
    super(input, rest);
  }
} as typeof Request;

// jsdom doesn't implement scrolling; ScrollRestoration calls it on navigation.
window.scrollTo = () => {};
