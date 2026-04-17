import { z } from "zod";

export const reviewItemSchema = z.object({
  questionId: z.number().int(),
  body: z.string(),
  correct: z.boolean(),
  reviewedAt: z.string(),
});
export type ReviewItem = z.infer<typeof reviewItemSchema>;

export const subjectReviewsResponseSchema = z.object({
  reviews: z.array(reviewItemSchema),
});
export type SubjectReviewsResponse = z.infer<typeof subjectReviewsResponseSchema>;
