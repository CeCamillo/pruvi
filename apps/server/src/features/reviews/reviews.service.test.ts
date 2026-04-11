import { describe, it, expect, vi, beforeEach } from "vitest";
import { ReviewsService } from "./reviews.service";
import { NotFoundError, ValidationError } from "../../utils/errors";

const mockRepo = {
  findQuestionById: vi.fn(),
  findLatestReview: vi.fn(),
  insertReview: vi.fn(),
  getUserLives: vi.fn(),
  awardXp: vi.fn(),
  resetLives: vi.fn(),
  decrementLives: vi.fn(),
};

const service = new ReviewsService(mockRepo as any);

const USER_ID = "user-1";
const QUESTION_ID = 42;

const makeQuestion = (overrides?: Partial<{ difficulty: number; correctOptionIndex: number }>) => ({
  id: QUESTION_ID,
  correctOptionIndex: 2,
  difficulty: 3,
  ...overrides,
});

beforeEach(() => {
  vi.restoreAllMocks();

  // Sensible defaults: question exists, no prior review, user has 5 lives
  mockRepo.findQuestionById.mockResolvedValue(makeQuestion());
  mockRepo.findLatestReview.mockResolvedValue(null);
  mockRepo.insertReview.mockResolvedValue(undefined);
  mockRepo.getUserLives.mockResolvedValue({ lives: 5, livesResetAt: null });
  mockRepo.awardXp.mockResolvedValue(undefined);
  mockRepo.resetLives.mockResolvedValue(undefined);
  mockRepo.decrementLives.mockResolvedValue(undefined);
});

describe("ReviewsService.answerQuestion", () => {
  it("correct answer: returns correct=true, SM-2 quality=4, XP awarded based on difficulty, lives unchanged", async () => {
    mockRepo.findQuestionById.mockResolvedValue(makeQuestion({ difficulty: 4 }));

    const result = await service.answerQuestion(USER_ID, QUESTION_ID, 2);

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();

    expect(value.correct).toBe(true);
    expect(value.correctOptionIndex).toBe(2);
    expect(value.livesRemaining).toBe(5);
    expect(value.xpAwarded).toBe(35); // hard = 35 XP

    // SM-2 inserted with quality 4
    expect(mockRepo.insertReview).toHaveBeenCalledOnce();
    expect(mockRepo.insertReview).toHaveBeenCalledWith(
      expect.objectContaining({ quality: 4, userId: USER_ID, questionId: QUESTION_ID })
    );

    // XP awarded
    expect(mockRepo.awardXp).toHaveBeenCalledWith(USER_ID, 35);

    // Lives not decremented
    expect(mockRepo.decrementLives).not.toHaveBeenCalled();
  });

  it("wrong answer: returns correct=false, quality=1, xpAwarded=0, lives decremented by 1", async () => {
    const result = await service.answerQuestion(USER_ID, QUESTION_ID, 0); // wrong option

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();

    expect(value.correct).toBe(false);
    expect(value.xpAwarded).toBe(0);
    expect(value.livesRemaining).toBe(4);

    // SM-2 inserted with quality 1
    expect(mockRepo.insertReview).toHaveBeenCalledWith(
      expect.objectContaining({ quality: 1 })
    );

    // Lives decremented
    expect(mockRepo.decrementLives).toHaveBeenCalledOnce();
    expect(mockRepo.decrementLives).toHaveBeenCalledWith(USER_ID, 5, true); // isFirstDecrement = true (was at 5)
  });

  it("wrong answer at 0 lives: returns ValidationError 'No lives remaining'", async () => {
    mockRepo.getUserLives.mockResolvedValue({ lives: 0, livesResetAt: null });

    const result = await service.answerQuestion(USER_ID, QUESTION_ID, 0);

    expect(result.isErr()).toBe(true);
    const error = result._unsafeUnwrapErr();
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toContain("No lives remaining");
  });

  it("lives auto-refill: when livesResetAt < now, calls repo.resetLives() and resets to 5", async () => {
    const pastDate = new Date(Date.now() - 60_000); // 1 minute ago
    mockRepo.getUserLives.mockResolvedValue({ lives: 2, livesResetAt: pastDate });

    const result = await service.answerQuestion(USER_ID, QUESTION_ID, 2); // correct answer

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();

    expect(mockRepo.resetLives).toHaveBeenCalledWith(USER_ID);
    expect(value.livesRemaining).toBe(5);
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
    // First review: no prior review exists
    mockRepo.findLatestReview.mockResolvedValue(null);
    await service.answerQuestion(USER_ID, QUESTION_ID, 2);

    const firstCall = mockRepo.insertReview.mock.calls[0]![0];
    // INITIAL_SM2_STATE has EF=2.5, repetitions=0, interval=0
    // With quality=4 on initial state (rep=0): newInterval=1, newRepetitions=1
    expect(firstCall.repetitions).toBe(1);
    expect(firstCall.interval).toBe(1);
    expect(firstCall.easinessFactor).toBe("2.50");

    // Subsequent review: latest review exists
    vi.clearAllMocks();
    mockRepo.findQuestionById.mockResolvedValue(makeQuestion());
    mockRepo.getUserLives.mockResolvedValue({ lives: 5, livesResetAt: null });
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
    // With rep=2, quality=4: newRepetitions=3, newInterval=floor(6 * newEF)
    expect(secondCall.repetitions).toBe(3);
    expect(secondCall.interval).toBeGreaterThan(1);
    // EF from prior was 2.60, quality=4 -> newEF = 2.60 + (0.1 - 1*(0.08 + 1*0.02)) = 2.60
    expect(secondCall.easinessFactor).toBe("2.60");
    expect(secondCall.interval).toBe(Math.round(6 * 2.6)); // 16
  });

  it("XP is NOT awarded for wrong answers (repo.awardXp not called)", async () => {
    const result = await service.answerQuestion(USER_ID, QUESTION_ID, 0);

    expect(result.isOk()).toBe(true);
    const value = result._unsafeUnwrap();

    expect(value.xpAwarded).toBe(0);
    expect(mockRepo.awardXp).not.toHaveBeenCalled();
  });
});
