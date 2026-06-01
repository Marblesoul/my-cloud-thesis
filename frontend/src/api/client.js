const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export function getCookie(name) {
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  const cookie = cookies.find((item) => item.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : null;
}

export async function apiRequest(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});
  let body = options.body;

  if (body && !(body instanceof FormData) && typeof body !== "string") {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  if (unsafeMethods.has(method)) {
    const csrfToken = getCookie("csrftoken");
    if (csrfToken) {
      headers.set("X-CSRFToken", csrfToken);
    }
  }

  const response = await fetch(path, {
    ...options,
    method,
    headers,
    body,
    credentials: "include",
  });

  const contentType = response.headers.get("Content-Type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = getErrorMessage(payload);
    throw new ApiError(message, response.status, payload);
  }

  return payload;
}

export function fetchCsrfCookie() {
  return apiRequest("/api/csrf/");
}

function getErrorMessage(payload) {
  if (typeof payload === "string") {
    return payload || "API request failed";
  }

  if (payload?.detail) {
    return payload.detail;
  }

  if (payload?.non_field_errors) {
    return normalizeErrorValue(payload.non_field_errors);
  }

  return "Проверьте данные и повторите попытку.";
}

function normalizeErrorValue(value) {
  if (Array.isArray(value)) {
    return value.join(" ");
  }

  if (typeof value === "string") {
    return value;
  }

  return "Некорректное значение.";
}
