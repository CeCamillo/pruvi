import { z } from "zod";

import { authClient } from "@/lib/auth-client";

/**
 * Authenticated fetch wrapper around Better Auth's $fetch.
 * Unwraps the server's { success, data } envelope and validates the payload through a Zod schema.
 * Throws on network/auth failure, server error response, or schema mismatch.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await authClient.$fetch(path, options);

  // Better Auth layer: network or auth failure
  if (response.error) {
    throw new Error(response.error.message ?? "Request failed");
  }

  // Server layer: { success: false, error, code }
  const payload = response.data as {
    success: boolean;
    data: unknown;
    error?: string;
    code?: string;
  };
  if (!payload.success) {
    throw new Error(payload.error ?? "Request failed");
  }

  // Parse + validate — throws on shape mismatch
  return schema.parse(payload.data);
}
