import { z } from "zod";

export const subjectSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
});

export type Subject = z.infer<typeof subjectSchema>;

export const subjectWithCountSchema = subjectSchema.extend({
  questionCount: z.number(),
});

export type SubjectWithCount = z.infer<typeof subjectWithCountSchema>;
