import {
  roletaAnswerBodySchema,
  roletaAnswerResponseSchema,
  roletaConfigResponseSchema,
  roletaConfigSchema,
  roletaStartResponseSchema,
  type RoletaAnswerBody,
  type RoletaConfig,
} from "@pruvi/shared";

import { apiRequest } from "@/lib/api-client";

export const roletaService = {
  getConfig: () =>
    apiRequest(
      "/roleta/config",
      { method: "GET" },
      roletaConfigResponseSchema,
    ),

  saveConfig: (payload: RoletaConfig) =>
    apiRequest(
      "/roleta/config",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roletaConfigSchema.parse(payload)),
      },
      roletaConfigResponseSchema,
    ),

  spin: () =>
    apiRequest(
      "/roleta/spin",
      { method: "POST" },
      roletaStartResponseSchema,
    ),

  answer: (payload: RoletaAnswerBody) =>
    apiRequest(
      "/roleta/answer",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(roletaAnswerBodySchema.parse(payload)),
      },
      roletaAnswerResponseSchema,
    ),
};
