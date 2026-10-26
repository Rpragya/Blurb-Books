/**
 * The contract between the UI and whatever serves library data.
 *
 * The mock adapter (src/api/mock) implements it in the browser. A Django REST
 * adapter would implement the same interface with fetch(), passing `signal`
 * through so cancelled queries abort their HTTP requests.
 */

export class ApiError extends Error {
  constructor(kind, message, code) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.code = code;
  }
}

export function isAbortError(error) {
  return error instanceof DOMException && error.name === 'AbortError';
}
