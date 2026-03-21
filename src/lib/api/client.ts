/** Typed fetch wrapper — single place for all API calls. */

/**
 *
 */
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
  const text = await res.text();
  if (!text) return undefined as T & void;
  return JSON.parse(text) as T;
}

/**
 *
 */
export function apiGet<T>(url: string): Promise<T> {
  return request<T>(url);
}

/**
 *
 */
export function apiPost<T>(url: string, body?: unknown): Promise<T> {
  if (body instanceof FormData) {
    return request<T>(url, { method: "POST", body });
  }
  return request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 *
 */
export function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  return request<T>(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 *
 */
export function apiDelete<T = void>(url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method: "DELETE" };
  if (body) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  return request<T>(url, init);
}

/** Fetch a file as a Blob (e.g. for downloads). */
export async function apiBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError(res.status, `File download failed (${res.status})`);
  }
  return res.blob();
}
