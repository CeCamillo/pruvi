import { describe, it, expect, vi } from "vitest";
import { SimuladosService } from "./simulados.service";
import { ok } from "neverthrow";
import type { UltraService } from "../ultra/ultra.service";
import type { SimuladosRepository } from "./simulados.repository";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUltra(isUltraValue: boolean) {
  return { isUltra: vi.fn().mockResolvedValue(isUltraValue) } as unknown as UltraService;
}

function makeRepo(overrides: Partial<Record<keyof SimuladosRepository, unknown>> = {}) {
  return {
    findByUserAndWeek: vi.fn().mockResolvedValue(null),
    listPriorCompletedSimulados: vi.fn().mockResolvedValue([]),
    countAnswered: vi.fn().mockResolvedValue(0),
    getOneForUser: vi.fn().mockResolvedValue(null),
    recordAnswer: vi.fn(),
    forceComplete: vi.fn(),
    getResultsAggregate: vi.fn(),
    startOrGetSimulado: vi.fn(),
    ...overrides,
  } as unknown as SimuladosRepository;
}

const NOW = new Date("2026-05-10T15:00:00Z"); // Sunday 12:00 BRT → weekStart=2026-05-10

// ---------------------------------------------------------------------------
// A9 Ultra-lapse exemption (required, fully fleshed-out per plan)
// ---------------------------------------------------------------------------

describe("SimuladosService — A9 Ultra-lapse exemption", () => {
  function buildSut(opts: { isUltra: boolean; existingSimulado: unknown | null }) {
    const ultra = { isUltra: vi.fn().mockResolvedValue(opts.isUltra) } as unknown as import("../ultra/ultra.service").UltraService;
    const repo = {
      findByUserAndWeek: vi.fn().mockResolvedValue(opts.existingSimulado),
      listPriorCompletedSimulados: vi.fn().mockResolvedValue([]),
      countAnswered: vi.fn().mockResolvedValue(0),
      getOneForUser: vi.fn(),
      recordAnswer: vi.fn(),
      forceComplete: vi.fn(),
      getResultsAggregate: vi.fn(),
      startOrGetSimulado: vi.fn(),
    } as unknown as import("./simulados.repository").SimuladosRepository;
    return { service: new SimuladosService(repo, ultra), ultra, repo };
  }

  it("getCurrent: lapsed Ultra with existing in-progress simulado returns 200 (no 403)", async () => {
    const existing = {
      id: 42, userId: "u1", weekStartDate: "2026-05-10",
      startedAt: new Date("2026-05-10T12:00:00Z"), completedAt: null,
      questionsCount: 35, correctCount: 4,
    };
    const { service, ultra } = buildSut({ isUltra: false, existingSimulado: existing });
    const r = await service.getCurrent("u1", new Date("2026-05-10T15:00:00Z"));
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.status).toBe("in_progress");
      expect(r.value.simulado?.id).toBe(42);
    }
    // Critical: the Ultra check must NOT have been called when an existing simulado was found.
    expect(ultra.isUltra).not.toHaveBeenCalled();
  });

  it("getCurrent: lapsed Ultra with NO simulado for the current week returns 403", async () => {
    const { service } = buildSut({ isUltra: false, existingSimulado: null });
    const r = await service.getCurrent("u1", new Date("2026-05-10T15:00:00Z"));
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.message).toContain("ULTRA_REQUIRED");
  });

  it("start: lapsed Ultra always returns 403, even if an old simulado exists", async () => {
    const { service } = buildSut({ isUltra: false, existingSimulado: null });
    const r = await service.start("u1", new Date("2026-05-10T15:00:00Z"));
    expect(r.isErr()).toBe(true);
  });

  it("recordAnswer: lapsed Ultra with owned simulado succeeds (Ultra check skipped)", async () => {
    const ultra = { isUltra: vi.fn().mockResolvedValue(false) } as unknown as import("../ultra/ultra.service").UltraService;
    const repo = {
      recordAnswer: vi.fn().mockResolvedValue({
        kind: "recorded", isCorrect: true, correctOptionIndex: 0, explanation: null,
        answeredCount: 1, completed: false,
      }),
    } as unknown as import("./simulados.repository").SimuladosRepository;
    const service = new SimuladosService(repo, ultra);
    const r = await service.recordAnswer(42, "u1", 100, 0);
    expect(r.isOk()).toBe(true);
    expect(ultra.isUltra).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getCurrent
// ---------------------------------------------------------------------------

describe("SimuladosService.getCurrent", () => {
  it("non-Ultra with no simulado returns ForbiddenError ULTRA_REQUIRED", async () => {
    const service = new SimuladosService(makeRepo(), makeUltra(false));
    const r = await service.getCurrent("u1", NOW);
    expect(r.isErr()).toBe(true);
    if (r.isErr()) {
      expect(r.error.statusCode).toBe(403);
      expect(r.error.message).toContain("ULTRA_REQUIRED");
    }
  });

  it("Ultra + no simulado → status not_started, simulado null", async () => {
    const repo = makeRepo({ listPriorCompletedSimulados: vi.fn().mockResolvedValue([]) });
    const service = new SimuladosService(repo, makeUltra(true));
    const r = await service.getCurrent("u1", NOW);
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.status).toBe("not_started");
      expect(r.value.simulado).toBeNull();
      expect(r.value.weekStart).toBe("2026-05-10");
      expect(r.value.weekEnd).toBe("2026-05-17");
    }
  });

  it("Ultra + in-progress simulado → status in_progress with correct fields", async () => {
    const existing = {
      id: 7, userId: "u1", weekStartDate: "2026-05-10",
      startedAt: new Date("2026-05-10T10:00:00Z"), completedAt: null,
      questionsCount: 35, correctCount: 3,
    };
    const repo = makeRepo({
      findByUserAndWeek: vi.fn().mockResolvedValue(existing),
      countAnswered: vi.fn().mockResolvedValue(5),
    });
    const service = new SimuladosService(repo, makeUltra(true));
    const r = await service.getCurrent("u1", NOW);
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.status).toBe("in_progress");
      expect(r.value.simulado?.id).toBe(7);
      expect(r.value.simulado?.answeredCount).toBe(5);
      expect(r.value.simulado?.correctCount).toBe(3);
    }
  });

  it("Ultra + completed simulado → status completed", async () => {
    const existing = {
      id: 8, userId: "u1", weekStartDate: "2026-05-10",
      startedAt: new Date("2026-05-10T10:00:00Z"),
      completedAt: new Date("2026-05-10T11:00:00Z"),
      questionsCount: 35, correctCount: 20,
    };
    const repo = makeRepo({
      findByUserAndWeek: vi.fn().mockResolvedValue(existing),
      countAnswered: vi.fn().mockResolvedValue(35),
    });
    const service = new SimuladosService(repo, makeUltra(true));
    const r = await service.getCurrent("u1", NOW);
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.status).toBe("completed");
      expect(r.value.simulado?.completedAt).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// start
// ---------------------------------------------------------------------------

describe("SimuladosService.start", () => {
  it("non-Ultra → ForbiddenError 403", async () => {
    const service = new SimuladosService(makeRepo(), makeUltra(false));
    const r = await service.start("u1", NOW);
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.statusCode).toBe(403);
  });

  it("Ultra → calls repo.startOrGetSimulado with (userId, weekStart, 35) and returns stripped question list", async () => {
    const mockSimulado = {
      id: 1, userId: "u1", weekStartDate: "2026-05-10",
      startedAt: new Date("2026-05-10T10:00:00Z"), completedAt: null,
      questionsCount: 2, correctCount: 0,
    };
    const mockQuestions = [
      {
        position: 0, questionId: 10, content: "Q1", options: ["a", "b", "c", "d"],
        subjectId: 1, subtopicId: 1, requiresCalculation: false,
        correctOptionIndex: 2, explanation: "exp1",
        selectedOptionIndex: null, isCorrect: null,
      },
      {
        position: 1, questionId: 11, content: "Q2", options: ["a", "b", "c", "d"],
        subjectId: 1, subtopicId: 1, requiresCalculation: false,
        correctOptionIndex: 0, explanation: null,
        selectedOptionIndex: null, isCorrect: null,
      },
    ];
    const startOrGetSimulado = vi.fn().mockResolvedValue({ simulado: mockSimulado, questions: mockQuestions, created: true });
    const repo = makeRepo({ startOrGetSimulado });
    const service = new SimuladosService(repo, makeUltra(true));
    const r = await service.start("u1", NOW);
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      // Verify repo called with correct args
      expect(startOrGetSimulado).toHaveBeenCalledWith("u1", "2026-05-10", 35);
      // Verify correctOptionIndex and explanation are stripped from returned questions
      for (const q of r.value.questions) {
        expect(q).not.toHaveProperty("correctOptionIndex");
        expect(q).not.toHaveProperty("explanation");
      }
      expect(r.value.questions[0]?.questionId).toBe(10);
      expect(r.value.simulado.id).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// recordAnswer
// ---------------------------------------------------------------------------

describe("SimuladosService.recordAnswer", () => {
  it("not_found → NotFoundError 404", async () => {
    const repo = makeRepo({ recordAnswer: vi.fn().mockResolvedValue({ kind: "not_found" }) });
    const service = new SimuladosService(repo, makeUltra(true));
    const r = await service.recordAnswer(1, "u1", 10, 0);
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.statusCode).toBe(404);
  });

  it("bad_question → ValidationError 400", async () => {
    const repo = makeRepo({ recordAnswer: vi.fn().mockResolvedValue({ kind: "bad_question" }) });
    const service = new SimuladosService(repo, makeUltra(true));
    const r = await service.recordAnswer(1, "u1", 999, 0);
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.statusCode).toBe(400);
  });

  it("already_completed → ConflictError 409", async () => {
    const repo = makeRepo({ recordAnswer: vi.fn().mockResolvedValue({ kind: "already_completed" }) });
    const service = new SimuladosService(repo, makeUltra(true));
    const r = await service.recordAnswer(1, "u1", 10, 0);
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.statusCode).toBe(409);
  });

  it("recorded → ok with correct response shape", async () => {
    const repo = makeRepo({
      recordAnswer: vi.fn().mockResolvedValue({
        kind: "recorded", isCorrect: true, correctOptionIndex: 2, explanation: "exp",
        answeredCount: 3, completed: false,
      }),
    });
    const service = new SimuladosService(repo, makeUltra(true));
    const r = await service.recordAnswer(1, "u1", 10, 2);
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.isCorrect).toBe(true);
      expect(r.value.correctOptionIndex).toBe(2);
      expect(r.value.explanation).toBe("exp");
      expect(r.value.answeredCount).toBe(3);
      expect(r.value.completed).toBe(false);
    }
  });

  it("already_answered → ok with originally-recorded outcome", async () => {
    const repo = makeRepo({
      recordAnswer: vi.fn().mockResolvedValue({
        kind: "already_answered", isCorrect: true, selectedOptionIndex: 2,
        correctOptionIndex: 2, explanation: null, answeredCount: 5, completed: false,
      }),
    });
    const service = new SimuladosService(repo, makeUltra(true));
    const r = await service.recordAnswer(1, "u1", 10, 3);
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.isCorrect).toBe(true);
      expect(r.value.correctOptionIndex).toBe(2);
    }
  });

  it("does NOT call ultra.isUltra (A9 exemption)", async () => {
    const ultra = makeUltra(false);
    const repo = makeRepo({
      recordAnswer: vi.fn().mockResolvedValue({
        kind: "recorded", isCorrect: false, correctOptionIndex: 1, explanation: null,
        answeredCount: 1, completed: false,
      }),
    });
    const service = new SimuladosService(repo, ultra);
    await service.recordAnswer(1, "u1", 10, 0);
    expect(ultra.isUltra).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// forceComplete
// ---------------------------------------------------------------------------

describe("SimuladosService.forceComplete", () => {
  it("not_found → NotFoundError 404", async () => {
    const repo = makeRepo({ forceComplete: vi.fn().mockResolvedValue({ kind: "not_found" }) });
    const service = new SimuladosService(repo, makeUltra(true));
    const r = await service.forceComplete(1, "u1");
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.statusCode).toBe(404);
  });

  it("completed → ok with id and completedAt", async () => {
    const completedAt = new Date("2026-05-10T14:00:00Z");
    const repo = makeRepo({
      forceComplete: vi.fn().mockResolvedValue({ kind: "completed", completedAt }),
    });
    const service = new SimuladosService(repo, makeUltra(true));
    const r = await service.forceComplete(5, "u1");
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.id).toBe(5);
      expect(r.value.completedAt).toBe(completedAt.toISOString());
    }
  });

  it("does NOT call ultra.isUltra (A9 exemption)", async () => {
    const ultra = makeUltra(false);
    const completedAt = new Date();
    const repo = makeRepo({
      forceComplete: vi.fn().mockResolvedValue({ kind: "completed", completedAt }),
    });
    const service = new SimuladosService(repo, ultra);
    await service.forceComplete(1, "u1");
    expect(ultra.isUltra).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getDetail
// ---------------------------------------------------------------------------

describe("SimuladosService.getDetail", () => {
  it("not owned → NotFoundError 404", async () => {
    const service = new SimuladosService(makeRepo(), makeUltra(true));
    const r = await service.getDetail(99, "u1");
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.statusCode).toBe(404);
  });

  it("in-progress: unanswered questions hide correctOptionIndex and explanation", async () => {
    const simulado = {
      id: 1, userId: "u1", weekStartDate: "2026-05-10",
      startedAt: new Date("2026-05-10T10:00:00Z"), completedAt: null,
      questionsCount: 2, correctCount: 1,
    };
    const questions = [
      {
        position: 0, questionId: 10, content: "Q1", options: ["a","b","c","d"],
        subjectId: 1, subtopicId: 1, requiresCalculation: false,
        correctOptionIndex: 2, explanation: "exp1",
        selectedOptionIndex: 2, isCorrect: true, // answered
      },
      {
        position: 1, questionId: 11, content: "Q2", options: ["a","b","c","d"],
        subjectId: 1, subtopicId: 1, requiresCalculation: false,
        correctOptionIndex: 0, explanation: "exp2",
        selectedOptionIndex: null, isCorrect: null, // unanswered
      },
    ];
    const repo = makeRepo({ getOneForUser: vi.fn().mockResolvedValue({ simulado, questions }) });
    const service = new SimuladosService(repo, makeUltra(true));
    const r = await service.getDetail(1, "u1");
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      const answered = r.value.questions[0]!;
      const unanswered = r.value.questions[1]!;
      // Answered question reveals correctOptionIndex and explanation
      expect(answered.correctOptionIndex).toBe(2);
      expect(answered.explanation).toBe("exp1");
      // Unanswered question hides them
      expect(unanswered.correctOptionIndex).toBeNull();
      expect(unanswered.explanation).toBeNull();
    }
  });

  it("completed: ALL questions reveal correctOptionIndex and explanation", async () => {
    const simulado = {
      id: 2, userId: "u1", weekStartDate: "2026-05-10",
      startedAt: new Date("2026-05-10T10:00:00Z"),
      completedAt: new Date("2026-05-10T11:00:00Z"),
      questionsCount: 1, correctCount: 0,
    };
    const questions = [
      {
        position: 0, questionId: 10, content: "Q1", options: ["a","b","c","d"],
        subjectId: 1, subtopicId: 1, requiresCalculation: false,
        correctOptionIndex: 3, explanation: "exp3",
        selectedOptionIndex: null, isCorrect: null, // unanswered but simulado is completed
      },
    ];
    const repo = makeRepo({ getOneForUser: vi.fn().mockResolvedValue({ simulado, questions }) });
    const service = new SimuladosService(repo, makeUltra(true));
    const r = await service.getDetail(2, "u1");
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      // Even unanswered question reveals correctOptionIndex when simulado is completed
      expect(r.value.questions[0]!.correctOptionIndex).toBe(3);
      expect(r.value.questions[0]!.explanation).toBe("exp3");
    }
  });

  it("does NOT call ultra.isUltra (A9 exemption)", async () => {
    const ultra = makeUltra(false);
    const service = new SimuladosService(makeRepo(), ultra);
    await service.getDetail(99, "u1");
    expect(ultra.isUltra).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getResults
// ---------------------------------------------------------------------------

describe("SimuladosService.getResults", () => {
  it("not owned → NotFoundError 404", async () => {
    const service = new SimuladosService(makeRepo(), makeUltra(true));
    const r = await service.getResults(99, "u1");
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.statusCode).toBe(404);
  });

  it("in-progress → ValidationError 400", async () => {
    const simulado = {
      id: 3, userId: "u1", weekStartDate: "2026-05-10",
      startedAt: new Date("2026-05-10T10:00:00Z"), completedAt: null,
      questionsCount: 35, correctCount: 0,
    };
    const repo = makeRepo({
      getOneForUser: vi.fn().mockResolvedValue({ simulado, questions: [] }),
    });
    const service = new SimuladosService(repo, makeUltra(true));
    const r = await service.getResults(3, "u1");
    expect(r.isErr()).toBe(true);
    if (r.isErr()) expect(r.error.statusCode).toBe(400);
  });

  it("completed → ok with aggregate and history", async () => {
    const simulado = {
      id: 4, userId: "u1", weekStartDate: "2026-05-10",
      startedAt: new Date("2026-05-10T10:00:00Z"),
      completedAt: new Date("2026-05-10T11:00:00Z"),
      questionsCount: 35, correctCount: 25,
    };
    const aggregate = {
      correct: 25, total: 35,
      perSubject: [{ subjectId: 1, correct: 15, total: 20 }, { subjectId: 2, correct: 10, total: 15 }],
    };
    const history = [
      { weekStart: "2026-05-03", correct: 20, total: 35, perSubject: [] },
    ];
    const repo = makeRepo({
      getOneForUser: vi.fn().mockResolvedValue({ simulado, questions: [] }),
      getResultsAggregate: vi.fn().mockResolvedValue(aggregate),
      listPriorCompletedSimulados: vi.fn().mockResolvedValue(history),
    });
    const service = new SimuladosService(repo, makeUltra(true));
    const r = await service.getResults(4, "u1");
    expect(r.isOk()).toBe(true);
    if (r.isOk()) {
      expect(r.value.correct).toBe(25);
      expect(r.value.total).toBe(35);
      expect(r.value.weekStart).toBe("2026-05-10");
      expect(r.value.perSubject).toHaveLength(2);
      expect(r.value.history).toHaveLength(1);
    }
  });

  it("does NOT call ultra.isUltra (A9 exemption)", async () => {
    const ultra = makeUltra(false);
    const service = new SimuladosService(makeRepo(), ultra);
    await service.getResults(99, "u1");
    expect(ultra.isUltra).not.toHaveBeenCalled();
  });
});
