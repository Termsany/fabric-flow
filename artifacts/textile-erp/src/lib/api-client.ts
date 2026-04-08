import { ApiError, customFetch } from "../../../../lib/api-client-react/src/custom-fetch.ts";
import {
  getApiUrl,
  getToken,
  isCookieSessionMode,
  notifyAuthFailure,
  shouldAttachBearerToken,
} from "@/lib/auth";

function extractErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      notifyAuthFailure();
    }

    const data = error.data as
      | { message?: string; error?: string; errors?: Record<string, string[]> }
      | null
      | undefined;

    if (data?.errors) {
      const firstError = Object.values(data.errors)[0]?.[0];
      if (firstError) {
        return firstError;
      }
    }

    return data?.error || data?.message || String(error.message);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error";
}

export async function apiClientRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const isFormDataBody = typeof FormData !== "undefined" && init?.body instanceof FormData;

  try {
    return await customFetch<T>(getApiUrl(path), {
      ...init,
      cache: "no-store",
      credentials: isCookieSessionMode() ? "include" : "same-origin",
      headers: {
        ...(isFormDataBody ? {} : { "Content-Type": "application/json" }),
        ...(shouldAttachBearerToken() && token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    throw new Error(extractErrorMessage(error));
  }
}
