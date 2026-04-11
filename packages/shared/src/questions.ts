import { z } from "zod";

export const questionSchema = z.object({
  id: z.number(),
  body: z.string(),
  options: z.array(z.string()),
  correctOptionIndex: z.number(),
  difficulty: z.number(),
  source: z.string().nullable(),
  subjectId: z.number(),
});

export type Question = z.infer<typeof questionSchema>;

// --- Difficulty ---

export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof difficultySchema>;

/** Map DB integer (1-5) to Difficulty label. 1-2 → easy, 3 → medium, 4-5 → hard. */
export function difficultyFromNumber(n: number): Difficulty {
  if (n <= 2) return "easy";
  if (n === 3) return "medium";
  return "hard";
}

/** SM-2 quality score: 0-5 scale used by the review service. */
export type QualityScore = 0 | 1 | 2 | 3 | 4 | 5;

// --- Client-safe question (no correctOptionIndex) ---

export const clientQuestionSchema = questionSchema.omit({ correctOptionIndex: true });

export type ClientQuestion = z.infer<typeof clientQuestionSchema>;
