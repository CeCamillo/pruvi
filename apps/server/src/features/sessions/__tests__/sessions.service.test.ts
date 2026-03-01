import { describe, expect, it, afterEach } from "vitest";
import { createTestDb } from "@pruvi/db/test-client";
import type { Database } from "@pruvi/db";
import { user } from "@pruvi/db/schema/auth";
import { subject } from "@pruvi/db/schema/subjects";
import { question } from "@pruvi/db/schema/questions";
import { startSession, completeSession, getTodayInfo } from "../sessions.service";

type MockQueue = {
  jobs: Array<{ name: string; data: Record<string, unknown> }>;
  add(name: string, data: Record<string, unknown>): Promise<void>;
};

function makeMockQueue(): MockQueue {
  return {
    jobs: [],
    add(name, data) {
      this.jobs.push({ name, data });
      return Promise.resolve();
    },
  };
}

describe("sessions service", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
  });

  async function setupFixtures(db: Database, questionCount = 6) {
    await db.insert(user).values({
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const subjects = await db
      .insert(subject)
      .values({ name: "Matemática", slug: "matematica" })
      .returning();
    const sub = subjects[0];
    if (!sub) throw new Error("Failed to insert subject");

    await db.insert(question).values(
      Array.from({ length: questionCount }, (_, i) => ({
        body: `Question ${String(i + 1)}?`,
        options: ["A", "B", "C", "D"],
        correctOptionIndex: 0,
        difficulty: 1,
        subjectId: sub.id,
      })),
    );
  }

  it("startSession creates a new session with questions (no correctOptionIndex)", async () => {
    const { db, client } = await createTestDb();
    cleanup = () => client.close();
    const typedDb = db as unknown as Database;
    await setupFixtures(typedDb);

    const result = await startSession(typedDb, { userId: "user-1", count: 5 });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value.session.userId).toBe("user-1");
    expect(result.value.questions).toHaveLength(5);
    result.value.questions.forEach((q) => {
      expect(q).not.toHaveProperty("correctOptionIndex");
    });
  });

  it("startSession resumes an existing incomplete session", async () => {
    const { db, client } = await createTestDb();
    cleanup = () => client.close();
    const typedDb = db as unknown as Database;
    await setupFixtures(typedDb);

    const first = await startSession(typedDb, { userId: "user-1", count: 5 });
    expect(first.isOk()).toBe(true);
    if (!first.isOk()) return;

    const second = await startSession(typedDb, { userId: "user-1", count: 5 });
    expect(second.isOk()).toBe(true);
    if (!second.isOk()) return;

    expect(second.value.session.id).toBe(first.value.session.id);
  });

  it("completeSession marks session complete and queues a job", async () => {
    const { db, client } = await createTestDb();
    cleanup = () => client.close();
    const typedDb = db as unknown as Database;
    await setupFixtures(typedDb);
    const mockQueue = makeMockQueue();

    const started = await startSession(typedDb, { userId: "user-1", count: 5 });
    expect(started.isOk()).toBe(true);
    if (!started.isOk()) return;

    const result = await completeSession(typedDb, mockQueue, {
      sessionId: started.value.session.id,
      userId: "user-1",
      questionsAnswered: 5,
      questionsCorrect: 3,
    });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value.completedAt).not.toBeNull();
    expect(result.value.questionsAnswered).toBe(5);
    expect(result.value.questionsCorrect).toBe(3);
    expect(mockQueue.jobs).toHaveLength(1);
    expect(mockQueue.jobs[0]?.name).toBe("generate-next-session");
    expect(mockQueue.jobs[0]?.data.userId).toBe("user-1");
  });

  it("completeSession returns ForbiddenError for wrong user", async () => {
    const { db, client } = await createTestDb();
    cleanup = () => client.close();
    const typedDb = db as unknown as Database;
    await setupFixtures(typedDb);

    await db.insert(user).values({
      id: "user-2",
      name: "Other User",
      email: "other@example.com",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const mockQueue = makeMockQueue();
    const started = await startSession(typedDb, { userId: "user-1", count: 5 });
    expect(started.isOk()).toBe(true);
    if (!started.isOk()) return;

    const result = await completeSession(typedDb, mockQueue, {
      sessionId: started.value.session.id,
      userId: "user-2",
      questionsAnswered: 5,
      questionsCorrect: 3,
    });

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) return;
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("completeSession returns ConflictError if already complete", async () => {
    const { db, client } = await createTestDb();
    cleanup = () => client.close();
    const typedDb = db as unknown as Database;
    await setupFixtures(typedDb);

    const mockQueue = makeMockQueue();
    const started = await startSession(typedDb, { userId: "user-1", count: 5 });
    expect(started.isOk()).toBe(true);
    if (!started.isOk()) return;

    await completeSession(typedDb, mockQueue, {
      sessionId: started.value.session.id,
      userId: "user-1",
      questionsAnswered: 5,
      questionsCorrect: 3,
    });

    const again = await completeSession(typedDb, mockQueue, {
      sessionId: started.value.session.id,
      userId: "user-1",
      questionsAnswered: 5,
      questionsCorrect: 3,
    });

    expect(again.isErr()).toBe(true);
    if (!again.isErr()) return;
    expect(again.error.code).toBe("CONFLICT");
  });

  it("getTodayInfo returns today's session", async () => {
    const { db, client } = await createTestDb();
    cleanup = () => client.close();
    const typedDb = db as unknown as Database;
    await setupFixtures(typedDb);

    await startSession(typedDb, { userId: "user-1", count: 5 });

    const result = await getTodayInfo(typedDb, "user-1");
    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value).not.toBeNull();
    expect(result.value?.userId).toBe("user-1");
  });

  it("getTodayInfo returns null when no session exists", async () => {
    const { db, client } = await createTestDb();
    cleanup = () => client.close();
    const typedDb = db as unknown as Database;

    await db.insert(user).values({
      id: "user-1",
      name: "Test",
      email: "test@example.com",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await getTodayInfo(typedDb, "user-1");
    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value).toBeNull();
  });
});
