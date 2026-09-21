import * as Sentry from "@sentry/react";

const raw = import.meta.env.VITE_API_URL;

//   safeguard for trailing slashes in the url just in case
const base = typeof raw === "string" ? raw.replace(/\/+$/, "") : "";

// authenticated fetch req that we'll use to send reqeusts to the api
export async function apiFetch(path, options = {}) {
  const { getToken, method = "GET", body } = options;
  const headers = { "Content-Type": "application/json" };

  // getToken is provided by clerk
  if (getToken) {
    const token = await getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
      // We're adding token to the request headers so clerk can check if user is authenticated
      // now our requests will be authenticated because
      // clerk expects a token on the server side
    }
  }

  let res;
  try {
    res = await fetch(`${base}${path}`, {
      method: method,
      headers: headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    Sentry.addBreadcrumb({
      category: "api",
      message: `${method} ${path}`,
      level: "error",
      data: { network: true }, // fetch only fials on network issues
    });
    Sentry.captureException(e, {
      tags: { "api.fetch": "network" },
      extra: { path, method },
    });

    throw e;
  }

  const data = await res.json();
  // log for when all goes good
  Sentry.addBreadcrumb({
    category: "api",
    message: `${method} ${path}`,
    level: res.ok ? "info" : "warning",
    data: { status: res.status },
  });

  if (!res.ok) {
    const msg = typeof data?.error === "string" ? data.error : res.statusText;
    const err = new Error(typeof msg === "string" ? msg : "Request Failed");
    // if something broke server side
    if (res.status >= 500) {
      Sentry.captureException(err, {
        tags: { "api.fetch": "http", "http.status": String(res.status) },
        extra: { path, method, status: res.status },
      });
    }

    throw err;
  }

  return data;
}
