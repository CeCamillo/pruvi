import { eq, sql } from "drizzle-orm";
import type { SubjectWithCount } from "@pruvi/shared/subjects";
import type { Database } from "@pruvi/db";
import { subject } from "@pruvi/db/schema/subjects";
import { question } from "@pruvi/db/schema/questions";

export async function getSubjectsWithCount(db: Database): Promise<SubjectWithCount[]> {
  const rows = await db
    .select({
      id: subject.id,
      name: subject.name,
      slug: subject.slug,
      questionCount: sql<number>`COUNT(${question.id})::int`.as("question_count"),
    })
    .from(subject)
    .leftJoin(question, eq(question.subjectId, subject.id))
    .groupBy(subject.id, subject.name, subject.slug)
    .orderBy(subject.name);

  return rows;
}
