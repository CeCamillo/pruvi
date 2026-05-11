import { describe, expect, it, vi } from "vitest";
import { TopicsService } from "./topics.service";
import type { TopicsRepository } from "./topics.repository";
import { type MasteryState } from "@pruvi/shared";

function makeRepoStub(overrides: Partial<TopicsRepository> = {}) {
  return overrides as unknown as TopicsRepository;
}

describe("TopicsService.computeTransitions", () => {
  const service = new TopicsService(makeRepoStub());

  it("returns empty when snapshot is null", () => {
    const result = service.computeTransitions(null, new Map(), new Map());
    expect(result).toEqual([]);
  });

  it("emits one entry per upward transition with name lookup", () => {
    const snapshot: Record<string, MasteryState> = { "1": "aprendendo", "2": "entendendo" };
    const current = new Map<number, MasteryState>([[1, "entendendo"], [2, "afiado"]]);
    const names = new Map<number, string>([[1, "Membrana"], [2, "Citoplasma"]]);
    const result = service.computeTransitions(snapshot, current, names);
    expect(result).toEqual([
      { subtopicId: 1, name: "Membrana", from: "aprendendo", to: "entendendo" },
      { subtopicId: 2, name: "Citoplasma", from: "entendendo", to: "afiado" },
    ]);
  });

  it("skips unchanged states", () => {
    const snapshot: Record<string, MasteryState> = { "1": "afiado" };
    const current = new Map<number, MasteryState>([[1, "afiado"]]);
    const names = new Map<number, string>([[1, "X"]]);
    expect(service.computeTransitions(snapshot, current, names)).toEqual([]);
  });

  it("skips downward transitions", () => {
    const snapshot: Record<string, MasteryState> = { "1": "afiado" };
    const current = new Map<number, MasteryState>([[1, "entendendo"]]);
    const names = new Map<number, string>([[1, "X"]]);
    expect(service.computeTransitions(snapshot, current, names)).toEqual([]);
  });

  it("emits a transition with name fallback when the names map lacks the id", () => {
    const snapshot: Record<string, MasteryState> = { "1": "aprendendo" };
    const current = new Map<number, MasteryState>([[1, "entendendo"]]);
    expect(service.computeTransitions(snapshot, current, new Map())).toEqual([
      { subtopicId: 1, name: "", from: "aprendendo", to: "entendendo" },
    ]);
  });
});

describe("TopicsService.snapshotMastery", () => {
  it("returns a record keyed by stringified subtopic id with computed state", async () => {
    const repo = makeRepoStub({
      getMasteryBySubtopics: vi.fn().mockResolvedValue(
        new Map([
          [1, { efAvg: 2.5, reviewCount: 8 }],
          [2, { efAvg: null, reviewCount: 0 }],
        ]),
      ),
    });
    const service = new TopicsService(repo);
    const snapshot = await service.snapshotMastery("user_1", [1, 2]);
    expect(snapshot).toEqual({ "1": "afiado", "2": "aprendendo" });
  });

  it("returns empty record for empty input", async () => {
    const service = new TopicsService(makeRepoStub());
    const snapshot = await service.snapshotMastery("user_1", []);
    expect(snapshot).toEqual({});
  });
});

describe("TopicsService.getTrilha", () => {
  it("merges repo mastery rows into states via computeMastery", async () => {
    const repo = makeRepoStub({
      getTrilha: vi.fn().mockResolvedValue({
        subject: { id: 1, name: "Biologia", slug: "biologia" },
        topics: [
          {
            id: 5,
            name: "Citologia",
            slug: "citologia",
            displayOrder: 0,
            subtopics: [
              { id: 10, name: "Membrana", slug: "membrana", displayOrder: 0, efAvg: 2.5, reviewCount: 8 },
              { id: 11, name: "Núcleo", slug: "nucleo", displayOrder: 1, efAvg: null, reviewCount: 0 },
            ],
          },
        ],
      }),
    });
    const service = new TopicsService(repo);
    const result = await service.getTrilha("user_1", 1);
    expect(result.isOk()).toBe(true);
    const trilha = result._unsafeUnwrap();
    expect(trilha.topics[0]!.subtopics[0]!.state).toBe("afiado");
    expect(trilha.topics[0]!.subtopics[1]!.state).toBe("aprendendo");
  });

  it("returns NotFoundError when subject doesn't exist", async () => {
    const repo = makeRepoStub({ getTrilha: vi.fn().mockResolvedValue(null) });
    const service = new TopicsService(repo);
    const result = await service.getTrilha("user_1", 999);
    expect(result.isErr()).toBe(true);
  });
});
