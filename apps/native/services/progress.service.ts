import {
  calendarResponseSchema,
  progressResponseSchema,
  subjectReviewsResponseSchema,
} from "@pruvi/shared";

import { apiRequest } from "@/lib/api-client";

export const progressService = {
  getProgress: () =>
    apiRequest("/users/me/progress", { method: "GET" }, progressResponseSchema),

  getSubjectReviews: (slug: string) =>
    apiRequest(
      `/subjects/${encodeURIComponent(slug)}/reviews`,
      { method: "GET" },
      subjectReviewsResponseSchema,
    ),

  getCalendar: (month?: string) =>
    apiRequest(
      `/users/me/calendar${month ? `?month=${month}` : ""}`,
      { method: "GET" },
      calendarResponseSchema,
    ),
};
