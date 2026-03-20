import { apiGet } from "./client";

/**
 *
 */
export function get<T>() {
  return apiGet<T>("/api/dashboard");
}
