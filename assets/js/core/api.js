let csrf = "";
export let currentUser = null;
export async function api(path, options = {}) {
  const response = await fetch("/api" + path, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...options.headers,
    },
  });
  const body = await response
    .json()
    .catch(() => ({ error: "Unexpected server response" }));
  if (!response.ok) {
    const error = new Error(body.error || "Request failed");
    error.status = response.status;
    throw error;
  }
  if (body.csrf) csrf = body.csrf;
  if (body.user) currentUser = body.user;
  return body;
}
export const post = (path, data = {}) =>
  api(path, { method: "POST", body: JSON.stringify(data) });
export function forgetSession() {
  csrf = "";
  currentUser = null;
}
