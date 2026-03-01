import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../test-client";
import { question, subject } from "../schema";

describe("database schema", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
  });

  it("creates and queries subjects", async () => {
    const { db, client } = await createTestDb();
    cleanup = () => client.close();

    const rows = await db
      .insert(subject)
      .values({ name: "Matemática", slug: "matematica" })
      .returning();
    const inserted = rows[0];

    if (!inserted) throw new Error("Insert returned no rows");
    expect(inserted.name).toBe("Matemática");
    expect(inserted.slug).toBe("matematica");
    expect(inserted.id).toBeGreaterThan(0);
  });

  it("creates questions linked to subjects", async () => {
    const { db, client } = await createTestDb();
    cleanup = () => client.close();

    const subRows = await db.insert(subject).values({ name: "Física", slug: "fisica" }).returning();
    const sub = subRows[0];
    if (!sub) throw new Error("Subject insert returned no rows");

    const qRows = await db
      .insert(question)
      .values({
        body: "Qual é a unidade de força no SI?",
        options: ["Joule", "Newton", "Watt", "Pascal"],
        correctOptionIndex: 1,
        difficulty: 2,
        source: "ENEM 2020",
        subjectId: sub.id,
      })
      .returning();
    const q = qRows[0];
    if (!q) throw new Error("Question insert returned no rows");

    expect(q.body).toContain("unidade de força");
    expect(q.options).toEqual(["Joule", "Newton", "Watt", "Pascal"]);
    expect(q.subjectId).toBe(sub.id);

    const found = await db.select().from(question).where(eq(question.id, q.id));
    expect(found).toHaveLength(1);
  });
});
