import { apiGet } from "./client";
import { API } from "./routes";

/** Fetch dashboard summary data. */
export function get<T>() {
  return apiGet<T>(API.dashboard());
}
