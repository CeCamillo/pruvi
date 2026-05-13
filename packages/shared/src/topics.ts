import { z } from "zod";
import { MasteryStateSchema } from "./mastery";

export const SubtopicMasterySchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  slug: z.string(),
  displayOrder: z.number().int().min(0),
  state: MasteryStateSchema,
  efAvg: z.number().nullable(),
  reviewCount: z.number().int().min(0),
});

export const TopicSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  slug: z.string(),
  displayOrder: z.number().int().min(0),
  subtopics: z.array(SubtopicMasterySchema),
});

export const TrilhaResponseSchema = z.object({
  subject: z.object({
    id: z.number().int().positive(),
    name: z.string(),
    slug: z.string(),
  }),
  topics: z.array(TopicSchema),
});

export const TopicDetailResponseSchema = z.object({
  topic: z.object({
    id: z.number().int().positive(),
    name: z.string(),
    slug: z.string(),
    subjectId: z.number().int().positive(),
    displayOrder: z.number().int().min(0),
  }),
  subtopics: z.array(SubtopicMasterySchema),
});

export const MasteryListItemSchema = z.object({
  subtopicId: z.number().int().positive(),
  subtopicName: z.string(),
  topicId: z.number().int().positive(),
  topicName: z.string(),
  subjectId: z.number().int().positive(),
  subjectName: z.string(),
  state: MasteryStateSchema,
  efAvg: z.number().nullable(),
  reviewCount: z.number().int().min(0),
});

export const MasteryListResponseSchema = z.object({
  items: z.array(MasteryListItemSchema),
});

export const MasteryTransitionSchema = z.object({
  subtopicId: z.number().int().positive(),
  name: z.string(),
  from: MasteryStateSchema,
  to: MasteryStateSchema,
});

export const MasteryTransitionsSchema = z.array(MasteryTransitionSchema);

export type MasteryListItem = z.infer<typeof MasteryListItemSchema>;
export type SubtopicMastery = z.infer<typeof SubtopicMasterySchema>;
export type TrilhaResponse = z.infer<typeof TrilhaResponseSchema>;
export type TopicDetailResponse = z.infer<typeof TopicDetailResponseSchema>;
export type MasteryTransition = z.infer<typeof MasteryTransitionSchema>;
export type MasteryTransitions = z.infer<typeof MasteryTransitionsSchema>;
