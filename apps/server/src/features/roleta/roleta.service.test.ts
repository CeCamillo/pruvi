import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoletaService } from "./roleta.service";
import { NotFoundError, ValidationError } from "../../utils/errors";

function createMocks() {
  const repo = {
    getConfig: vi.fn(),
    saveConfig: vi.fn(),
    listSubjectSlugs: vi.fn(),
    findSubjectBySlug: vi.fn(),
    selectRandomQuestions: vi.fn(),
    findQuestionById: vi.fn(),
    insertRoletaReview: vi.fn(),
    awardXp: vi.fn(),
  };
  const service = new RoletaService(repo as any);
  return { repo, service };
}

const allSlugs = ["matematica", "biologia", "fisica", "quimica", "portugues"];

function mockSubject(overrides: Partial<{ id: number; slug: string; name: string }> = {}) {
  return { id: 1, slug: "matematica", name: "Matemática", ...overrides };
}

function mockQuestion(id: number, difficulty = 1) {
  return {
    id,
    subjectId: 1,
    body: `Q${id}`,
    options: ["a", "b", "c", "d"],
    correctOptionIndex: 0,
    difficulty,
    requiresCalculation: false,
    source: null,
    createdAt: new Date(),
  };
}

describe("RoletaService", () => {
  let repo: ReturnType<typeof createMocks>["repo"];
  let service: RoletaService;

  beforeEach(() => {
    ({ repo, service } = createMocks());
  });

  describe("getConfig", () => {
    it("returns all subject slugs when user has no config", async () => {
      repo.getConfig.mockResolvedValue(null);
      repo.listSubjectSlugs.mockResolvedValue(allSlugs);

      const result = await service.getConfig("u1");

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().subjects).toEqual(allSlugs);
    });

    it("returns the user's stored subjects when set", async () => {
      repo.getConfig.mockResolvedValue(["matematica", "biologia"]);

      const result = await service.getConfig("u1");

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().subjects).toEqual(["matematica", "biologia"]);
      expect(repo.listSubjectSlugs).not.toHaveBeenCalled();
    });
  });

  describe("saveConfig", () => {
    it("rejects when a slug does not exist", async () => {
      repo.listSubjectSlugs.mockResolvedValue(allSlugs);

      const result = await service.saveConfig("u1", { subjects: ["ghost"] });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
      expect(repo.saveConfig).not.toHaveBeenCalled();
    });

    it("persists and echoes a valid array", async () => {
      repo.listSubjectSlugs.mockResolvedValue(allSlugs);

      const result = await service.saveConfig("u1", {
        subjects: ["matematica", "biologia"],
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().subjects).toEqual([
        "matematica",
        "biologia",
      ]);
      expect(repo.saveConfig).toHaveBeenCalledWith("u1", [
        "matematica",
        "biologia",
      ]);
    });
  });

  describe("spin", () => {
    it("returns a spinId, one subject drawn from the pool, and 3 questions", async () => {
      repo.getConfig.mockResolvedValue(["matematica"]);
      repo.findSubjectBySlug.mockResolvedValue(mockSubject());
      repo.selectRandomQuestions.mockResolvedValue([
        mockQuestion(1),
        mockQuestion(2),
        mockQuestion(3),
      ]);

      const result = await service.spin("u1");

      expect(result.isOk()).toBe(true);
      const value = result._unsafeUnwrap();
      expect(value.spinId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(value.subject.slug).toBe("matematica");
      expect(value.questions).toHaveLength(3);
      // Client-safe: no correctOptionIndex leaked
      expect(value.questions[0]).not.toHaveProperty("correctOptionIndex");
    });

    it("falls back to all slugs when user has no config", async () => {
      repo.getConfig.mockResolvedValue(null);
      repo.listSubjectSlugs.mockResolvedValue(allSlugs);
      repo.findSubjectBySlug.mockResolvedValue(mockSubject());
      repo.selectRandomQuestions.mockResolvedValue([
        mockQuestion(1),
        mockQuestion(2),
        mockQuestion(3),
      ]);

      const result = await service.spin("u1");

      expect(result.isOk()).toBe(true);
      expect(repo.findSubjectBySlug).toHaveBeenCalledWith(
        expect.stringMatching(
          /^(matematica|biologia|fisica|quimica|portugues)$/,
        ),
      );
    });

    it("returns ValidationError when the picked subject has no questions", async () => {
      repo.getConfig.mockResolvedValue(["matematica"]);
      repo.findSubjectBySlug.mockResolvedValue(mockSubject());
      repo.selectRandomQuestions.mockResolvedValue([]);

      const result = await service.spin("u1");

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
    });

    it("returns NotFoundError if configured slug is no longer in the DB", async () => {
      repo.getConfig.mockResolvedValue(["deleted-subject"]);
      repo.findSubjectBySlug.mockResolvedValue(null);

      const result = await service.spin("u1");

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(NotFoundError);
    });

    it("returns ValidationError when no subjects are available", async () => {
      repo.getConfig.mockResolvedValue(null);
      repo.listSubjectSlugs.mockResolvedValue([]);

      const result = await service.spin("u1");

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
    });
  });

  describe("answer", () => {
    it("awards floor(baseXp/2) on correct", async () => {
      // easy base = 10 → floor(10/2) = 5
      repo.findQuestionById.mockResolvedValue(mockQuestion(7, 1));

      const result = await service.answer("u1", {
        spinId: "11111111-1111-1111-1111-111111111111",
        questionId: 7,
        selectedOptionIndex: 0,
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({
        correct: true,
        correctOptionIndex: 0,
        xpAwarded: 5,
      });
      expect(repo.awardXp).toHaveBeenCalledWith("u1", 5);
      expect(repo.insertRoletaReview).toHaveBeenCalledWith({
        userId: "u1",
        questionId: 7,
        quality: 4,
      });
    });

    it("awards 0 on wrong and writes quality=1", async () => {
      repo.findQuestionById.mockResolvedValue(mockQuestion(7, 3)); // medium

      const result = await service.answer("u1", {
        spinId: "11111111-1111-1111-1111-111111111111",
        questionId: 7,
        selectedOptionIndex: 2, // wrong
      });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual({
        correct: false,
        correctOptionIndex: 0,
        xpAwarded: 0,
      });
      expect(repo.awardXp).not.toHaveBeenCalled();
      expect(repo.insertRoletaReview).toHaveBeenCalledWith({
        userId: "u1",
        questionId: 7,
        quality: 1,
      });
    });

    it("returns NotFoundError for unknown question", async () => {
      repo.findQuestionById.mockResolvedValue(null);

      const result = await service.answer("u1", {
        spinId: "11111111-1111-1111-1111-111111111111",
        questionId: 999,
        selectedOptionIndex: 0,
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(NotFoundError);
    });

    it("halves medium and hard XP correctly (floor)", async () => {
      // hard base = 35 → floor(35/2) = 17
      repo.findQuestionById.mockResolvedValue(mockQuestion(1, 5));

      const result = await service.answer("u1", {
        spinId: "11111111-1111-1111-1111-111111111111",
        questionId: 1,
        selectedOptionIndex: 0,
      });

      expect(result._unsafeUnwrap().xpAwarded).toBe(17);
    });
  });
});
