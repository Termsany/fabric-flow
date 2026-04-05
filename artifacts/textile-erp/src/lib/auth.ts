import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

const TOKEN_KEY = "textile_erp_token";
const rawApiUrl = import.meta.env.VITE_API_URL?.trim();
const apiBaseUrl = import.meta.env.DEV
  ? ""
  : rawApiUrl
    ? rawApiUrl.replace(/\/+$/, "")
    : "";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
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
  const token = getToken();
  const response = await fetch(getApiUrl(path), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

setBaseUrl(apiBaseUrl);

// Register the auth token getter for API calls
setAuthTokenGetter(() => getToken());
