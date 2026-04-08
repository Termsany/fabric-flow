import { getMe, setAuthTokenGetter, setBaseUrl, type User } from "@workspace/api-client-react";

const TOKEN_KEY = "textile_erp_token";
const AUTH_FAILURE_EVENT = "fabric-flow:auth-failed";
const MAX_TOKEN_LENGTH = 4096;
const authSessionMode = (import.meta.env.VITE_AUTH_SESSION_MODE?.trim().toLowerCase() || "bearer") as "bearer" | "cookie" | "hybrid";
const authStorageMode = (import.meta.env.VITE_AUTH_STORAGE?.trim().toLowerCase() || "local") as "local" | "session";
const rawApiUrl = import.meta.env.VITE_API_URL?.trim();
const apiBaseUrl = import.meta.env.DEV
  ? ""
  : rawApiUrl
    ? rawApiUrl.replace(/\/+$/, "")
    : "";

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return authStorageMode === "session" ? window.sessionStorage : window.localStorage;
}

function decodeJwtExp(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function looksLikeJwt(token: string): boolean {
  return token.split(".").length === 3;
}

export function isCookieSessionMode(): boolean {
  return authSessionMode === "cookie" || authSessionMode === "hybrid";
}

export function shouldAttachBearerToken(): boolean {
  return authSessionMode === "bearer" || authSessionMode === "hybrid";
}

export function canBootstrapAuthSession(): boolean {
  return Boolean(getToken()) || isCookieSessionMode();
}

export function getAuthRequestCredentials(): RequestCredentials {
  return isCookieSessionMode() ? "include" : "same-origin";
}

export function getAuthHeaders(): HeadersInit | undefined {
  const token = getToken();
  if (!shouldAttachBearerToken() || !token) {
    return undefined;
  }

  return { Authorization: `Bearer ${token}` };
}

export function notifyAuthFailure(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(AUTH_FAILURE_EVENT));
}

export function addAuthFailureListener(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => listener();
  window.addEventListener(AUTH_FAILURE_EVENT, handler);
  return () => window.removeEventListener(AUTH_FAILURE_EVENT, handler);
}

export function getToken(): string | null {
  const storage = getStorage();
  const token = storage?.getItem(TOKEN_KEY) ?? null;
  if (!token) {
    return null;
  }

  if (token.length > MAX_TOKEN_LENGTH || !looksLikeJwt(token)) {
    storage?.removeItem(TOKEN_KEY);
    return null;
  }

  const exp = decodeJwtExp(token);
  if (exp && Date.now() >= exp * 1000) {
    storage?.removeItem(TOKEN_KEY);
    return null;
  }

  return token;
}

export function setToken(token: string): void {
  getStorage()?.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  getStorage()?.removeItem(TOKEN_KEY);
}

export function getApiUrl(path: string): string {
  if (!apiBaseUrl || !path.startsWith("/")) {
    return path;
  }

  return `${apiBaseUrl}${path}`;
}

function getAssetBaseUrl(): string {
  if (apiBaseUrl) {
    return apiBaseUrl;
  }

  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin.replace(":3000", ":8080");
}

export function getAssetUrl(path: string): string {
  if (!path) {
    return path;
  }

  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) {
    return path;
  }

  const base = getAssetBaseUrl();
  if (!base || !path.startsWith("/")) {
    return path;
  }

  return `${base}${path}`;
}

export async function fetchProtectedAsset(path: string): Promise<string> {
  const response = await fetch(getApiUrl(path), {
    credentials: getAuthRequestCredentials(),
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function fetchCurrentUser(): Promise<User> {
  return getMe({
    credentials: getAuthRequestCredentials(),
    headers: getAuthHeaders(),
  });
}

export async function requestLogout(): Promise<void> {
  await fetch(getApiUrl("/api/auth/logout"), {
    method: "POST",
    credentials: getAuthRequestCredentials(),
  });
}

setBaseUrl(apiBaseUrl);

// Register the auth token getter for API calls
setAuthTokenGetter(() => (shouldAttachBearerToken() ? getToken() : null));
