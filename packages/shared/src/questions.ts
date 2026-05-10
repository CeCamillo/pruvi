import { z } from "zod";

export const difficultyEnum = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof difficultyEnum>;

export const questionSchema = z.object({
  id: z.number(),
  content: z.string(),
  options: z.array(z.string()),
  correctOptionIndex: z.number(),
  difficulty: difficultyEnum,
  source: z.string().nullable(),
  subjectId: z.number(),
});

export type Question = z.infer<typeof questionSchema>;
