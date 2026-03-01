import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "./index";
import { question, subject } from "./schema";
import { biologiaQuestions } from "./seed-data/biologia";
import { fisicaQuestions } from "./seed-data/fisica";
import { matematicaQuestions } from "./seed-data/matematica";
import { portuguesQuestions } from "./seed-data/portugues";
import { quimicaQuestions } from "./seed-data/quimica";
import type { QuestionSeed } from "./seed-data/types";

const SUBJECTS = [
  { name: "Matemática", slug: "matematica", questions: matematicaQuestions },
  { name: "Biologia", slug: "biologia", questions: biologiaQuestions },
  { name: "Física", slug: "fisica", questions: fisicaQuestions },
  { name: "Química", slug: "quimica", questions: quimicaQuestions },
  { name: "Português", slug: "portugues", questions: portuguesQuestions },
] satisfies Array<{ name: string; slug: string; questions: QuestionSeed[] }>;

async function seed() {
  console.log("🌱 Starting seed...");

  // Idempotency check — skip if already seeded
  const rows = await db.select({ count: sql<number>`count(*)::int` }).from(subject);
  const count = rows[0]?.count ?? 0;

  if (count > 0) {
    console.log(`✓ Already seeded (${count} subjects found). Skipping.`);
    process.exit(0);
  }

  for (const { name, slug, questions } of SUBJECTS) {
    const [sub] = await db.insert(subject).values({ name, slug }).onConflictDoNothing().returning();

    if (!sub) {
      console.log(`  → Subject "${name}" already exists, skipping questions.`);
      continue;
    }

    await db.insert(question).values(
      questions.map((q) => ({
        body: q.body,
        options: q.options,
        correctOptionIndex: q.correctOptionIndex,
        difficulty: q.difficulty,
        source: q.source,
        subjectId: sub.id,
      })),
    );

    const easy = questions.filter((q) => q.difficulty === 1).length;
    const medium = questions.filter((q) => q.difficulty === 2).length;
    const hard = questions.filter((q) => q.difficulty === 3).length;
    console.log(
      `  ✓ ${name}: ${questions.length} questions (${easy} easy / ${medium} medium / ${hard} hard)`,
    );
  }

  const total = SUBJECTS.reduce((sum, s) => sum + s.questions.length, 0);
  console.log(`\n✅ Seed complete — ${total} questions across ${SUBJECTS.length} subjects.`);
  process.exit(0);
}

seed().catch((err: unknown) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
