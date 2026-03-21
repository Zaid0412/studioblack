import { apiGet } from "./client";
import { API } from "./routes";

/**
 *
 */
export function get<T>() {
  return apiGet<T>(API.dashboard);
}
