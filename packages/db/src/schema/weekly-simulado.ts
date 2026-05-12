import { relations } from "drizzle-orm";
import { boolean, date, index, integer, pgTable, primaryKey, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { question } from "./questions";

export const weeklySimulado = pgTable(
  "weekly_simulado",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    weekStartDate: date("week_start_date").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    questionsCount: integer("questions_count").notNull(),
    correctCount: integer("correct_count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("weekly_simulado_user_week_uq").on(t.userId, t.weekStartDate),
    index("weekly_simulado_user_week_idx").on(t.userId, t.weekStartDate),
  ],
);

export const weeklySimuladoQuestion = pgTable(
  "weekly_simulado_question",
  {
    simuladoId: integer("simulado_id").notNull().references(() => weeklySimulado.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    questionId: integer("question_id").notNull().references(() => question.id, { onDelete: "restrict" }),
    selectedOptionIndex: integer("selected_option_index"),
    isCorrect: boolean("is_correct"),
    answeredAt: timestamp("answered_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.simuladoId, t.position] }),
    uniqueIndex("weekly_simulado_question_simulado_question_uq").on(t.simuladoId, t.questionId),
    index("weekly_simulado_question_simulado_idx").on(t.simuladoId),
  ],
);

export const weeklySimuladoRelations = relations(weeklySimulado, ({ many, one }) => ({
  user: one(user, { fields: [weeklySimulado.userId], references: [user.id] }),
  questions: many(weeklySimuladoQuestion),
}));

export const weeklySimuladoQuestionRelations = relations(weeklySimuladoQuestion, ({ one }) => ({
  simulado: one(weeklySimulado, { fields: [weeklySimuladoQuestion.simuladoId], references: [weeklySimulado.id] }),
  question: one(question, { fields: [weeklySimuladoQuestion.questionId], references: [question.id] }),
}));
