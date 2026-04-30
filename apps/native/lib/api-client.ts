import { env } from "@pruvi/env/native";
import { z } from "zod";

import { authClient } from "@/lib/auth-client";

const BASE_URL = env.EXPO_PUBLIC_SERVER_URL;

/**
 * Authenticated fetch wrapper.
 *
 * Uses the Better Auth Expo plugin's cookie (stored in SecureStore) for
 * auth, and plain `fetch` against the server's base URL — deliberately
 * NOT authClient.$fetch, which only resolves paths under /api/auth/ and
 * would 404 every non-auth route.
 *
 * Unwraps the server's `{ success, data }` envelope and validates the
 * payload through a Zod schema. Throws on network failure, non-2xx
 * status, server `success: false`, or schema mismatch.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
  const cookie = authClient.getCookie();
  const headers = new Headers(options.headers);
  if (cookie) {
    headers.set("Cookie", cookie);
  }

  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const response = await fetch(url, { ...options, headers });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  if (!response.ok) {
    const errorMessage =
      (payload as { error?: string } | null)?.error ??
      `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  const envelope = payload as {
    success: boolean;
    data: unknown;
    error?: string;
    code?: string;
  };
  if (!envelope.success) {
    throw new Error(envelope.error ?? "Request failed");
  }

  return schema.parse(envelope.data);
}
