import { relations } from "drizzle-orm";
import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { question } from "./questions";

export const subject = pgTable("subject", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
});

export const subjectRelations = relations(subject, ({ many }) => ({
  questions: many(question),
}));
