import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const subject = pgTable("subject", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
