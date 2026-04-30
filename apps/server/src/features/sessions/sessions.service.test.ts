import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok } from "neverthrow";
import { SessionsService } from "./sessions.service";
import { ValidationError, NotFoundError } from "../../utils/errors";

const mockSession = {
  id: 1,
  userId: "user-1",
  date: "2026-04-16",
  questionsAnswered: 0,
  questionsCorrect: 0,
  completedAt: null as Date | null,
  createdAt: new Date(),
};

const mockQuestions = [
  { id: 1, subjectId: 1, body: "Q1", options: ["a", "b", "c", "d"], correctOptionIndex: 0, difficulty: 1, requiresCalculation: false, source: null, createdAt: new Date() },
  { id: 2, subjectId: 1, body: "Q2", options: ["a", "b", "c", "d"], correctOptionIndex: 0, difficulty: 3, requiresCalculation: false, source: null, createdAt: new Date() },
];

function createMocks() {
  const repo = {
    findTodaySession: vi.fn(),
    createSession: vi.fn(),
    completeSession: vi.fn(),
    findSessionById: vi.fn(),
  };
  const questionsService = {
    selectForSession: vi.fn(),
  };
  const service = new SessionsService(repo as any, questionsService as any);
  return { repo, questionsService, service };
}

describe("SessionsService", () => {
  let repo: ReturnType<typeof createMocks>["repo"];
  let questionsService: ReturnType<typeof createMocks>["questionsService"];
  let service: SessionsService;

  beforeEach(() => {
    ({ repo, questionsService, service } = createMocks());
  });

  describe("startSession", () => {
    it("creates a new session when no existing session", async () => {
      repo.findTodaySession.mockResolvedValue(null);
      repo.createSession.mockResolvedValue(mockSession);
      questionsService.selectForSession.mockResolvedValue(ok(mockQuestions));

      const result = await service.startSession("user-1", "all");

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().session).toEqual(mockSession);
      expect(result._unsafeUnwrap().questions).toEqual(mockQuestions);
      expect(repo.createSession).toHaveBeenCalledWith("user-1");
      expect(questionsService.selectForSession).toHaveBeenCalledWith("user-1", "all");
    });

    it("resumes an active session and fetches fresh questions", async () => {
      const existingSession = { ...mockSession, completedAt: null };
      repo.findTodaySession.mockResolvedValue(existingSession);
      questionsService.selectForSession.mockResolvedValue(ok(mockQuestions));

      const result = await service.startSession("user-1", "all");

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().session).toEqual(existingSession);
      expect(result._unsafeUnwrap().questions).toEqual(mockQuestions);
      expect(repo.createSession).not.toHaveBeenCalled();
      expect(questionsService.selectForSession).toHaveBeenCalledWith("user-1", "all");
    });

    it("returns ValidationError for a completed session", async () => {
      repo.findTodaySession.mockResolvedValue({ ...mockSession, completedAt: new Date() });

      const result = await service.startSession("user-1", "all");

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
      expect(result._unsafeUnwrapErr().message).toBe("You already completed today's session");
    });

    it("returns empty questions array when skipQuestions is true", async () => {
      repo.findTodaySession.mockResolvedValue(null);
      repo.createSession.mockResolvedValue(mockSession);

      const result = await service.startSession("user-1", "all", true);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().questions).toEqual([]);
      expect(questionsService.selectForSession).not.toHaveBeenCalled();
    });
  });

  describe("getTodaySession", () => {
    it("returns the session when it exists", async () => {
      repo.findTodaySession.mockResolvedValue(mockSession);

      const result = await service.getTodaySession("user-1");

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual(mockSession);
    });

    it("returns null when no session exists", async () => {
      repo.findTodaySession.mockResolvedValue(null);

      const result = await service.getTodaySession("user-1");

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBeNull();
    });
  });

  describe("completeSession", () => {
    it("marks session as completed", async () => {
      const activeSession = { ...mockSession, completedAt: null, userId: "user-1" };
      const completedSession = { ...mockSession, questionsAnswered: 10, questionsCorrect: 8, completedAt: new Date() };
      repo.findSessionById.mockResolvedValue(activeSession);
      repo.completeSession.mockResolvedValue(completedSession);

      const result = await service.completeSession("user-1", 1, 10, 8);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toEqual(completedSession);
      expect(repo.completeSession).toHaveBeenCalledWith(1, 10, 8);
    });

    it("returns NotFoundError when userId does not match", async () => {
      repo.findSessionById.mockResolvedValue({ ...mockSession, userId: "other-user" });

      const result = await service.completeSession("user-1", 1, 10, 8);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(NotFoundError);
    });

    it("returns ValidationError when session is already completed", async () => {
      repo.findSessionById.mockResolvedValue({ ...mockSession, completedAt: new Date(), userId: "user-1" });

      const result = await service.completeSession("user-1", 1, 10, 8);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
      expect(result._unsafeUnwrapErr().message).toBe("Session already completed");
    });
  });
});
