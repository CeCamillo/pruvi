import { subject } from "@pruvi/db/schema/subjects";
import { question } from "@pruvi/db/schema/questions";
import { createTestDb } from "@pruvi/db/test-client";
import type { Database } from "@pruvi/db";
import { describe, it, expect, beforeEach } from "vitest";
import { getSubjectsWithCount } from "../subjects.repository";

describe("getSubjectsWithCount", () => {
  let db: Database;

  beforeEach(async () => {
    const result = await createTestDb();
    db = result.db as unknown as Database;
  });

  it("returns each subject with the count of its questions", async () => {
    const mathRows = await db
      .insert(subject)
      .values({ name: "Mathematics", slug: "math" })
      .returning();
    const sciRows = await db
      .insert(subject)
      .values({ name: "Science", slug: "science" })
      .returning();
    const mathId = mathRows[0]?.id ?? 0;
    const sciId = sciRows[0]?.id ?? 0;

    await db.insert(question).values([
      { body: "Q1", options: ["a", "b"], correctOptionIndex: 0, subjectId: mathId },
      { body: "Q2", options: ["a", "b"], correctOptionIndex: 0, subjectId: mathId },
      { body: "Q3", options: ["a", "b"], correctOptionIndex: 0, subjectId: sciId },
    ]);

    const rows = await getSubjectsWithCount(db);

    const mathRow = rows.find((r) => r.id === mathId);
    const sciRow = rows.find((r) => r.id === sciId);

    expect(mathRow?.questionCount).toBe(2);
    expect(sciRow?.questionCount).toBe(1);
  });

  it("returns 0 question count for subjects with no questions", async () => {
    await db.insert(subject).values({ name: "History", slug: "history" });

    const rows = await getSubjectsWithCount(db);
    const histRow = rows.find((r) => r.slug === "history");

    expect(histRow?.questionCount).toBe(0);
  });
});
