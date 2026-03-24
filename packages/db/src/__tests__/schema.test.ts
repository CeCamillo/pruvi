import { describe, expect, it, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "../test-client";
import { subject, question } from "../schema";

describe("database schema", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
  });

  it("creates and queries subjects", async () => {
    const { db, client } = await createTestDb();
    cleanup = () => client.close();

    const [inserted] = await db
      .insert(subject)
      .values({ name: "Matemática", slug: "matematica" })
      .returning();

    expect(inserted.name).toBe("Matemática");
    expect(inserted.slug).toBe("matematica");
    expect(inserted.id).toBeGreaterThan(0);
  });

  it("creates questions linked to subjects", async () => {
    const { db, client } = await createTestDb();
    cleanup = () => client.close();

    const [sub] = await db.insert(subject).values({ name: "Física", slug: "fisica" }).returning();

    const [q] = await db
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

    expect(q.body).toContain("unidade de força");
    expect(q.options).toEqual(["Joule", "Newton", "Watt", "Pascal"]);
    expect(q.subjectId).toBe(sub.id);

    const found = await db.select().from(question).where(eq(question.id, q.id));
    expect(found).toHaveLength(1);
  });
});
