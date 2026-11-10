const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

/** Usa el proxy local en desarrollo y VITE_API_URL en el sitio publicado. */
export function apiFetch(path: string, options: RequestInit = {}) {
  return fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
  });
}
