/** Typed fetch wrapper — single place for all API calls. */

/** HTTP error with status code thrown by API request helpers. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body.error || body.message || `Request failed (${res.status})`
    );
  }
  // 204 No Content or empty body — expected for DELETE and some POST responses
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export interface ApiRequestOptions {
  /** Optional AbortController signal for cancellable requests. */
  signal?: AbortSignal;
}

/** Send a GET request and parse the JSON response. */
export function apiGet<T>(url: string, opts?: ApiRequestOptions): Promise<T> {
  return request<T>(url, opts?.signal ? { signal: opts.signal } : undefined);
}

/** Send a POST request with an optional JSON or FormData body. */
export function apiPost<T>(
  url: string,
  body?: unknown,
  opts?: ApiRequestOptions
): Promise<T> {
  const init: RequestInit =
    body instanceof FormData
      ? { method: "POST", body }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        };
  if (opts?.signal) init.signal = opts.signal;
  return request<T>(url, init);
}

/** Send a PATCH request with an optional JSON body. */
export function apiPatch<T>(
  url: string,
  body?: unknown,
  opts?: ApiRequestOptions
): Promise<T> {
  const init: RequestInit = {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
  if (opts?.signal) init.signal = opts.signal;
  return request<T>(url, init);
}

/** Send a DELETE request with an optional JSON body. */
export function apiDelete<T = void>(
  url: string,
  body?: unknown,
  opts?: ApiRequestOptions
): Promise<T> {
  const init: RequestInit = { method: "DELETE" };
  if (body) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  if (opts?.signal) init.signal = opts.signal;
  return request<T>(url, init);
}

/** Fetch a file as a Blob (e.g. for downloads). */
export async function apiBlob(url: string): Promise<Blob> {
  const { blob } = await apiBlobWithHeaders(url);
  return blob;
}

/**
 * Fetch a file as a Blob and expose response headers. Used when the caller
 * needs metadata (truncated flag, total count) shipped in custom `X-…`
 * headers alongside the body.
 */
export async function apiBlobWithHeaders(
  url: string
): Promise<{ blob: Blob; headers: Headers }> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body.error || body.message || `File download failed (${res.status})`
    );
  }
  return { blob: await res.blob(), headers: res.headers };
}
