import { z } from "zod";

export const calendarQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
});
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;

export const calendarResponseSchema = z.object({
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});
export type CalendarResponse = z.infer<typeof calendarResponseSchema>;
