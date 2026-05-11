import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReviewsService } from "./reviews.service";
import { NotFoundError, ValidationError } from "../../utils/errors";

const mockRepo = {
  findQuestionById: vi.fn(),
  findLatestReview: vi.fn(),
  insertReview: vi.fn(),
  awardXp: vi.fn(),
};

const mockLivesRepo = {
  materializeRegen: vi.fn(),
  tryDecrement: vi.fn(),
};

const service = new ReviewsService(mockRepo as any, mockLivesRepo as any);

const USER_ID = "user-1";
const QUESTION_ID = 42;

const makeQuestion = (overrides?: Partial<{ difficulty: string; correctOptionIndex: number; explanation: string | null }>) => ({
  id: QUESTION_ID,
  correctOptionIndex: 2,
  difficulty: "medium",
  explanation: null,
  subjectId: 1,
  topicId: 1,
  ...overrides,
});

beforeEach(() => {
  vi.restoreAllMocks();

  mockRepo.findQuestionById.mockResolvedValue(makeQuestion());
  mockRepo.findLatestReview.mockResolvedValue(null);
  mockRepo.insertReview.mockResolvedValue(undefined);
  mockRepo.awardXp.mockResolvedValue(undefined);
  mockLivesRepo.materializeRegen.mockResolvedValue({ lives: 5, lastRegenAt: null });
  mockLivesRepo.tryDecrement.mockResolvedValue({ ok: true, livesAfter: 4, lastRegenAt: null });
});

describe("ReviewsService.answerQuestion", () => {
  it("correct answer: returns correct=true, SM-2 quality=4, XP awarded based on difficulty, lives unchanged", async () => {
    mockRepo.findQuestionById.mockResolvedValue(makeQuestion({ difficulty: "hard" }));

    const result = await service.answerQuestion(USER_ID, QUESTION_ID, 2);

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();

    expect(value.answer.correct).toBe(true);
    expect(value.answer.correctOptionIndex).toBe(2);
    expect(value.answer.livesRemaining).toBe(5);
    expect(value.answer.xpAwarded).toBe(35);

    expect(mockRepo.insertReview).toHaveBeenCalledOnce();
    expect(mockRepo.insertReview).toHaveBeenCalledWith(
      expect.objectContaining({ quality: 4, userId: USER_ID, questionId: QUESTION_ID })
    );

    expect(mockRepo.awardXp).toHaveBeenCalledWith(USER_ID, 35);

    expect(mockLivesRepo.tryDecrement).not.toHaveBeenCalled();
  });

  it("wrong answer: returns correct=false, quality=1, xpAwarded=0, lives decremented by 1", async () => {
    mockLivesRepo.materializeRegen.mockResolvedValue({ lives: 5, lastRegenAt: null });
    mockLivesRepo.tryDecrement.mockResolvedValue({ ok: true, livesAfter: 4, lastRegenAt: null });

    const result = await service.answerQuestion(USER_ID, QUESTION_ID, 0);

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();

    expect(value.answer.correct).toBe(false);
    expect(value.answer.xpAwarded).toBe(0);
    expect(value.answer.livesRemaining).toBe(4);

    expect(mockRepo.insertReview).toHaveBeenCalledWith(
      expect.objectContaining({ quality: 1 })
    );

    expect(mockLivesRepo.tryDecrement).toHaveBeenCalledOnce();
  });

  it("wrong answer with 0 lives: tryDecrement returns ok:false → ValidationError", async () => {
    mockLivesRepo.materializeRegen.mockResolvedValue({ lives: 0, lastRegenAt: new Date() });
    mockLivesRepo.tryDecrement.mockResolvedValue({ ok: false });

    const result = await service.answerQuestion(USER_ID, QUESTION_ID, 0);

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toContain("No lives remaining");
  });

  it("correct answer: tryDecrement never called; livesRemaining reflects materialized value", async () => {
    mockLivesRepo.materializeRegen.mockResolvedValue({ lives: 3, lastRegenAt: new Date() });

    const result = await service.answerQuestion(USER_ID, QUESTION_ID, 2);

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();
    expect(value.answer.livesRemaining).toBe(3);
    expect(mockLivesRepo.tryDecrement).not.toHaveBeenCalled();
  });

  it("question not found: returns NotFoundError", async () => {
    mockRepo.findQuestionById.mockResolvedValue(null);

    const result = await service.answerQuestion(USER_ID, QUESTION_ID, 0);

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.message).toBe("Question not found");
  });

  it("first review uses INITIAL_SM2_STATE, subsequent review uses latest from repo", async () => {
    mockRepo.findLatestReview.mockResolvedValue(null);
    await service.answerQuestion(USER_ID, QUESTION_ID, 2);

    const firstCall = mockRepo.insertReview.mock.calls[0]![0];
    expect(firstCall.repetitions).toBe(1);
    expect(firstCall.interval).toBe(1);

    vi.clearAllMocks();
    mockRepo.findQuestionById.mockResolvedValue(makeQuestion());
    mockLivesRepo.materializeRegen.mockResolvedValue({ lives: 5, lastRegenAt: null });
    mockRepo.insertReview.mockResolvedValue(undefined);
    mockRepo.awardXp.mockResolvedValue(undefined);

    const latestReview = {
      easinessFactor: "2.60",
      interval: 6,
      repetitions: 2,
      nextReviewAt: new Date(),
    };
    mockRepo.findLatestReview.mockResolvedValue(latestReview);

    await service.answerQuestion(USER_ID, QUESTION_ID, 2);

    const secondCall = mockRepo.insertReview.mock.calls[0]![0];
    expect(secondCall.repetitions).toBe(3);
    expect(secondCall.interval).toBeGreaterThan(1);
    expect(secondCall.easinessFactor).toBe("2.60");
    expect(secondCall.interval).toBe(Math.round(6 * 2.6));
  });

  it("XP is NOT awarded for wrong answers (repo.awardXp not called)", async () => {
    const result = await service.answerQuestion(USER_ID, QUESTION_ID, 0);

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();

    expect(value.answer.xpAwarded).toBe(0);
    expect(mockRepo.awardXp).not.toHaveBeenCalled();
  });

  it("includes explanation from question in the answer result", async () => {
    mockRepo.findQuestionById.mockResolvedValue(
      makeQuestion({ explanation: "F=ma is Newton's second law" })
    );

    const result = await service.answerQuestion(USER_ID, QUESTION_ID, 2);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.answer.explanation).toBe("F=ma is Newton's second law");
    }
  });

  it("returns null explanation when question has no explanation", async () => {
    mockRepo.findQuestionById.mockResolvedValue(
      makeQuestion({ explanation: null })
    );

    const result = await service.answerQuestion(USER_ID, QUESTION_ID, 2);

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.answer.explanation).toBeNull();
    }
  });
});
