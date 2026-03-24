import type { z } from "zod";
import { env } from "@pruvi/env/native";
import { authClient } from "@/lib/auth-client";

interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const cookie = authClient.getCookie();

  const res = await fetch(`${env.EXPO_PUBLIC_SERVER_URL}${path}`, {
    ...options,
    credentials: "omit",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...options.headers,
    },
  });

  const json = await res.json();

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? `Request failed: ${res.status}`);
  }

  return (json as ApiSuccessResponse<unknown>).data;
}

export async function apiGet<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const data = await apiFetch(path);
  return schema.parse(data);
}

export async function apiPost<T>(path: string, body: unknown, schema: z.ZodType<T>): Promise<T> {
  const data = await apiFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return schema.parse(data);
}

/** Fire-and-forget POST for dev reset endpoints (no schema validation needed) */
export async function apiPostRaw(path: string): Promise<void> {
  await apiFetch(path, { method: "POST", body: JSON.stringify({}) });
}
