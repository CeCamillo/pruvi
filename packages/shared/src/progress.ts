import { z } from "zod";

export const subjectProgressSchema = z.object({
  slug: z.string(),
  name: z.string(),
  totalQuestions: z.number().int().min(0),
  correctCount: z.number().int().min(0),
  accuracy: z.number().int().min(0).max(100),
});
export type SubjectProgress = z.infer<typeof subjectProgressSchema>;

export const progressResponseSchema = z.object({
  subjects: z.array(subjectProgressSchema),
});
export type ProgressResponse = z.infer<typeof progressResponseSchema>;
