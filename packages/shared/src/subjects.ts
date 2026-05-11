import { z } from "zod";

export const subjectSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
});

export type Subject = z.infer<typeof subjectSchema>;

export const SubjectsListResponseSchema = z.object({
  subjects: z.array(subjectSchema),
});

export type SubjectsListResponse = z.infer<typeof SubjectsListResponseSchema>;
