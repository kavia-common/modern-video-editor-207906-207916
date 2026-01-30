const API_BASE =
  process.env.REACT_APP_API_BASE ||
  process.env.REACT_APP_BACKEND_URL ||
  "http://localhost:3001";

/**
 * Normalize API errors so UI can show a useful message.
 * @param {Response} res
 * @returns {Promise<Error>}
 */
async function buildHttpError(res) {
  let bodyText = "";
  try {
    bodyText = await res.text();
  } catch {
    bodyText = "";
  }
  const err = new Error(
    `Request failed (${res.status} ${res.statusText})${bodyText ? `: ${bodyText}` : ""}`
  );
  err.status = res.status;
  err.bodyText = bodyText;
  return err;
}

/**
 * Basic JSON fetch wrapper.
 * @param {string} path
 * @param {RequestInit} init
 */
async function apiFetch(path, init = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    throw await buildHttpError(res);
  }

  // The current backend returns {} for GET /, but we keep this resilient.
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

// PUBLIC_INTERFACE
export async function healthCheck() {
  /** Check if backend is reachable. */
  return apiFetch("/", { method: "GET" });
}

export { API_BASE };
