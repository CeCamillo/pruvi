import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok } from "neverthrow";
import { SessionsService } from "./sessions.service";
import { ValidationError, NotFoundError } from "../../utils/errors";

const mockSession = {
  id: 1,
  userId: "user-1",
  status: "active" as const,
  questionsAnswered: null,
  questionsCorrect: null,
  completedAt: null,
  createdAt: new Date(),
};

const mockQuestions = [
  { id: 1, subjectId: 1, subtopicId: 10, content: "Q1", options: ["a", "b", "c", "d"], difficulty: "easy" as const, requiresCalculation: false, source: null },
  { id: 2, subjectId: 1, subtopicId: 10, content: "Q2", options: ["a", "b", "c", "d"], difficulty: "medium" as const, requiresCalculation: false, source: null },
];

function createMocks() {
  const repo = {
    findTodaySession: vi.fn(),
    createSession: vi.fn(),
    completeSession: vi.fn(),
    findSessionById: vi.fn(),
    writeMasterySnapshot: vi.fn().mockResolvedValue(undefined),
    readMasterySnapshot: vi.fn().mockResolvedValue(null),
  };
  const questionsService = {
    selectForSession: vi.fn(),
    selectForSubtopic: vi.fn(),
  };
  const topicsService = {
    snapshotMastery: vi.fn().mockResolvedValue({}),
    getCurrentMasteryAndNames: vi.fn().mockResolvedValue({ currentMap: new Map(), namesMap: new Map() }),
    computeTransitions: vi.fn().mockReturnValue([]),
  };
  const service = new SessionsService(repo as any, questionsService as any, topicsService as any);
  return { repo, questionsService, topicsService, service };
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
      const existingSession = { ...mockSession, status: "active" as const };
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
      repo.findTodaySession.mockResolvedValue({ ...mockSession, status: "completed" });

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
      const activeSession = { ...mockSession, status: "active", userId: "user-1" };
      const completedSession = { ...mockSession, status: "completed", questionsAnswered: 10, questionsCorrect: 8, completedAt: new Date() };
      repo.findSessionById.mockResolvedValue(activeSession);
      repo.completeSession.mockResolvedValue(completedSession);
      repo.readMasterySnapshot.mockResolvedValue(null);

      const result = await service.completeSession("user-1", 1, 10, 8);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().session).toEqual(completedSession);
      expect(result._unsafeUnwrap().transitions).toEqual([]);
      expect(repo.completeSession).toHaveBeenCalledWith(1, 10, 8);
    });

    it("returns NotFoundError when userId does not match", async () => {
      repo.findSessionById.mockResolvedValue({ ...mockSession, userId: "other-user" });

      const result = await service.completeSession("user-1", 1, 10, 8);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(NotFoundError);
    });

    it("returns ValidationError when session is already completed", async () => {
      repo.findSessionById.mockResolvedValue({ ...mockSession, status: "completed", userId: "user-1" });

      const result = await service.completeSession("user-1", 1, 10, 8);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
      expect(result._unsafeUnwrapErr().message).toBe("Session already completed");
    });

    it("rejects when questionsCorrect exceeds questionsAnswered", async () => {
      const result = await service.completeSession("user-1", 1, 5, 8);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
      expect(result._unsafeUnwrapErr().message).toBe("Invalid session completion metrics");
      expect(repo.findSessionById).not.toHaveBeenCalled();
    });

    it("rejects negative metrics", async () => {
      const result = await service.completeSession("user-1", 1, -1, 0);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBeInstanceOf(ValidationError);
    });
  });
});

describe("SessionsService.startSession with topicId", () => {
  it("filters questions by subtopic and snapshots mastery for the touched subtopics", async () => {
    const sessionRepo = {
      findTodaySession: vi.fn().mockResolvedValue(null),
      createSession: vi.fn().mockResolvedValue({
        id: 42,
        userId: "u1",
        status: "active",
        questionsAnswered: 0,
        questionsCorrect: 0,
        completedAt: null,
        createdAt: new Date(),
        masterySnapshot: null,
      }),
      writeMasterySnapshot: vi.fn().mockResolvedValue(undefined),
    } as any;

    const questionsService = {
      selectForSession: vi.fn(),
      selectForSubtopic: vi.fn().mockResolvedValue({
        isErr: () => false,
        isOk: () => true,
        value: [{ id: 1, subtopicId: 7 }, { id: 2, subtopicId: 7 }],
        error: undefined,
      }),
    } as any;

    const topicsService = {
      snapshotMastery: vi.fn().mockResolvedValue({ "7": "aprendendo" }),
      getCurrentMasteryAndNames: vi.fn(),
      computeTransitions: vi.fn(),
    } as any;

    const service = new SessionsService(sessionRepo, questionsService, topicsService);
    const result = await service.startSession("u1", "all", false, 7);

    expect(result.isOk()).toBe(true);
    expect(questionsService.selectForSubtopic).toHaveBeenCalledWith("u1", 7);
    expect(topicsService.snapshotMastery).toHaveBeenCalledWith("u1", [7]);
    expect(sessionRepo.writeMasterySnapshot).toHaveBeenCalledWith(42, { "7": "aprendendo" });
  });
});

describe("SessionsService.completeSession returns mastery transitions", () => {
  it("computes upward transitions from snapshot to current state", async () => {
    const completedRow = { id: 9, status: "completed", questionsAnswered: 5, questionsCorrect: 4, completedAt: new Date(), userId: "u1" };
    const sessionRepo = {
      findSessionById: vi.fn().mockResolvedValue({ id: 9, userId: "u1", status: "active", masterySnapshot: { "7": "aprendendo" } }),
      completeSession: vi.fn().mockResolvedValue(completedRow),
      readMasterySnapshot: vi.fn().mockResolvedValue({ "7": "aprendendo" }),
    } as any;
    const questionsService = {} as any;
    const topicsService = {
      getCurrentMasteryAndNames: vi.fn().mockResolvedValue({
        currentMap: new Map([[7, "afiado"]]),
        namesMap: new Map([[7, "Membrana"]]),
      }),
      computeTransitions: vi.fn().mockReturnValue([
        { subtopicId: 7, name: "Membrana", from: "aprendendo", to: "afiado" },
      ]),
      snapshotMastery: vi.fn(),
    } as any;
    const service = new SessionsService(sessionRepo, questionsService, topicsService);
    const result = await service.completeSession("u1", 9, 5, 4);
    expect(result.isOk()).toBe(true);
    const { session, transitions } = result._unsafeUnwrap();
    expect(session!.status).toBe("completed");
    expect(transitions).toEqual([
      { subtopicId: 7, name: "Membrana", from: "aprendendo", to: "afiado" },
    ]);
  });

  it("returns empty transitions when snapshot is null", async () => {
    const sessionRepo = {
      findSessionById: vi.fn().mockResolvedValue({ id: 9, userId: "u1", status: "active", masterySnapshot: null }),
      completeSession: vi.fn().mockResolvedValue({ id: 9, status: "completed" }),
      readMasterySnapshot: vi.fn().mockResolvedValue(null),
    } as any;
    const service = new SessionsService(
      sessionRepo,
      {} as any,
      { computeTransitions: vi.fn().mockReturnValue([]), getCurrentMasteryAndNames: vi.fn(), snapshotMastery: vi.fn() } as any,
    );
    const result = await service.completeSession("u1", 9, 0, 0);
    const { transitions } = result._unsafeUnwrap();
    expect(transitions).toEqual([]);
  });
});
