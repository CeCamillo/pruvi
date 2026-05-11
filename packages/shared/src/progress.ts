import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const SubjectProgressSchema = z.object({
  subjectSlug: z.string(),
  subjectName: z.string(),
  totalReviews: z.number().int().nonnegative(),
  totalCorrect: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(1),
});

export type SubjectProgress = z.infer<typeof SubjectProgressSchema>;

export const ProgressResponseSchema = z.object({
  totalReviews: z.number().int().nonnegative(),
  totalCorrect: z.number().int().nonnegative(),
  accuracy: z.number().min(0).max(1),
  bySubject: z.array(SubjectProgressSchema),
});

export type ProgressResponse = z.infer<typeof ProgressResponseSchema>;

export const CalendarQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
});

export type CalendarQuery = z.infer<typeof CalendarQuerySchema>;

export const CalendarResponseSchema = z.object({
  dates: z.array(isoDate),
});

export type CalendarResponse = z.infer<typeof CalendarResponseSchema>;
