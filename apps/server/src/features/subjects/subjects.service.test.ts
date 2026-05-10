import { describe, it, expect, beforeEach, vi } from "vitest";
import { SubjectsService } from "./subjects.service";
import type { SubjectsRepository } from "./subjects.repository";

function makeMockRepo() {
  return {
    listAll: vi.fn(),
  } as unknown as SubjectsRepository & {
    listAll: ReturnType<typeof vi.fn>;
  };
}

describe("SubjectsService", () => {
  let repo: ReturnType<typeof makeMockRepo>;
  let service: SubjectsService;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new SubjectsService(repo);
  });

  it("returns subjects from repo wrapped in { subjects } shape", async () => {
    const rows = [
      { id: 1, slug: "matematica", name: "Matemática" },
      { id: 2, slug: "biologia", name: "Biologia" },
    ];
    repo.listAll.mockResolvedValue(rows);

    const result = await service.list();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value).toEqual({ subjects: rows });
    }
  });

  it("returns empty list when repo returns empty", async () => {
    repo.listAll.mockResolvedValue([]);
    const result = await service.list();
    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.subjects).toEqual([]);
    }
  });
});
