import { z } from "zod";

export const reviewItemSchema = z.object({
  questionId: z.number().int(),
  body: z.string(),
  correct: z.boolean(),
  // ISO 8601 datetime string — server produces via Date.toISOString(); keeping
  // it strict turns silent downstream NaN corruption (e.g., invalid dates
  // reaching formatRelativeTime) into a loud Zod parse error at the boundary.
  reviewedAt: z.string().datetime(),
});
export type ReviewItem = z.infer<typeof reviewItemSchema>;

export const subjectReviewsResponseSchema = z.object({
  reviews: z.array(reviewItemSchema),
});
export type SubjectReviewsResponse = z.infer<typeof subjectReviewsResponseSchema>;
