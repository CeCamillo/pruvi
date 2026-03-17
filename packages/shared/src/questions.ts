import { z } from "zod";

export const DifficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const QuestionModeSchema = z.enum(["all", "theoretical"]);
export type QuestionMode = z.infer<typeof QuestionModeSchema>;

/** Question as returned to the client (without correctOptionIndex) */
export const QuestionSchema = z.object({
  id: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  content: z.string().max(5000),
  options: z.array(z.string().max(1000)).length(4),
  difficulty: DifficultySchema,
  requiresCalculation: z.boolean(),
  source: z.string().max(500).nullable(),
});

export type Question = z.infer<typeof QuestionSchema>;
