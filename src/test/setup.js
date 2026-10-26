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
  constructor(input, init) {
    const { signal: _signal, ...rest } = init ?? {};
    super(input, rest);
  }
};

// jsdom doesn't implement scrolling; ScrollRestoration calls it on navigation.
window.scrollTo = () => {};

// jsdom lacks matchMedia (theme + reduced-motion checks) and IntersectionObserver
// (framer-motion's whileInView). Minimal stand-ins: no media matches, and
// everything counts as in view immediately.
window.matchMedia ??= ((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
}));

class IO {
  cb;
  constructor(cb) {
    this.cb = cb;
  }
  observe(target) {
    this.cb([{ isIntersecting: true, intersectionRatio: 1, target }], this);
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
window.IntersectionObserver ??= IO;
