import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDb, teardownTestDb, cleanupTestDb, getTestDb } from "../../test/db-helpers";
import { subject } from "@pruvi/db/schema/subjects";
import { SubjectsRepository } from "./subjects.repository";

describe("SubjectsRepository integration", () => {
  let repo: SubjectsRepository;

  beforeAll(async () => {
    await setupTestDb();
    repo = new SubjectsRepository(getTestDb());
  });

  beforeEach(async () => {
    await cleanupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("listAll returns subjects sorted by name ASC", async () => {
    const db = getTestDb();

    await db.insert(subject).values([
      { name: "Química", slug: "quimica" },
      { name: "Biologia", slug: "biologia" },
      { name: "Matemática", slug: "matematica" },
    ]);

    const rows = await repo.listAll();

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.name)).toEqual(["Biologia", "Matemática", "Química"]);
    expect(rows.every((r) => typeof r.id === "number")).toBe(true);
    expect(rows.every((r) => typeof r.slug === "string")).toBe(true);
  });

  it("listAll returns empty array when no subjects", async () => {
    const rows = await repo.listAll();
    expect(rows).toEqual([]);
  });
});
