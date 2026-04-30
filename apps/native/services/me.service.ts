import { meResponseSchema } from "@pruvi/shared";

import { apiRequest } from "@/lib/api-client";

export const meService = {
  getMe: () =>
    apiRequest("/me", { method: "GET" }, meResponseSchema),
};
