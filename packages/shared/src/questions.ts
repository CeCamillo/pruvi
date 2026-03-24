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

export const answerRequestSchema = z.object({
  selectedOptionIndex: z.number().min(0).max(4),
});

export type AnswerRequest = z.infer<typeof answerRequestSchema>;

export const answerResponseSchema = z.object({
  correct: z.boolean(),
  correctOptionIndex: z.number(),
  reviewLog: z.object({
    easeFactor: z.number(),
    interval: z.number(),
    repetitions: z.number(),
    nextReviewAt: z.string(),
  }),
});

export type AnswerResponse = z.infer<typeof answerResponseSchema>;
