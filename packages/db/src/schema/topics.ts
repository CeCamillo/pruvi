import { relations } from "drizzle-orm";
import { index, integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

import { subject } from "./subjects";

export const topic = pgTable(
  "topic",
  {
    id: serial("id").primaryKey(),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subject.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("topic_subject_slug_uniq").on(table.subjectId, table.slug),
    index("topic_subject_order_idx").on(table.subjectId, table.displayOrder),
  ],
);

export const subtopic = pgTable(
  "subtopic",
  {
    id: serial("id").primaryKey(),
    topicId: integer("topic_id")
      .notNull()
      .references(() => topic.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("subtopic_topic_slug_uniq").on(table.topicId, table.slug),
    index("subtopic_topic_order_idx").on(table.topicId, table.displayOrder),
  ],
);

export const topicRelations = relations(topic, ({ one, many }) => ({
  subject: one(subject, {
    fields: [topic.subjectId],
    references: [subject.id],
  }),
  subtopics: many(subtopic),
}));

export const subtopicRelations = relations(subtopic, ({ one }) => ({
  topic: one(topic, {
    fields: [subtopic.topicId],
    references: [topic.id],
  }),
}));
