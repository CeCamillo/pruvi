import { db } from "@pruvi/db";
import { subject } from "@pruvi/db/schema/subjects";
import { topic, subtopic } from "@pruvi/db/schema/topics";
import { and, eq, sql } from "drizzle-orm";

async function main() {
  const [bio] = await db.select().from(subject).where(eq(subject.slug, "biologia")).limit(1);
  if (!bio) {
    console.error("No 'biologia' subject found. Run base seed first.");
    process.exit(1);
  }

  const existing = await db
    .select()
    .from(topic)
    .where(and(eq(topic.subjectId, bio.id), eq(topic.slug, "citologia")))
    .limit(1);
  if (existing.length > 0) {
    console.log("Citologia already seeded — exiting.");
    return;
  }

  const [citologia] = await db
    .insert(topic)
    .values({ subjectId: bio.id, name: "Citologia", slug: "citologia", displayOrder: 1 })
    .returning();

  const subs = [
    { name: "Membrana plasmática", slug: "membrana-plasmatica", order: 0 },
    { name: "Citoplasma", slug: "citoplasma", order: 1 },
    { name: "Núcleo", slug: "nucleo", order: 2 },
  ];
  const inserted = await db
    .insert(subtopic)
    .values(subs.map((s) => ({ topicId: citologia.id, name: s.name, slug: s.slug, displayOrder: s.order })))
    .returning();

  const [geralTopic] = await db
    .select()
    .from(topic)
    .where(and(eq(topic.subjectId, bio.id), eq(topic.slug, "geral")))
    .limit(1);
  if (!geralTopic) {
    console.log("No Geral topic for Biology — leaving subtopics empty.");
    return;
  }
  const [geralSub] = await db
    .select()
    .from(subtopic)
    .where(and(eq(subtopic.topicId, geralTopic.id), eq(subtopic.slug, "geral")))
    .limit(1);
  if (!geralSub) return;

  for (let i = 0; i < inserted.length; i++) {
    await db.execute(sql`
      WITH picked AS (
        SELECT id FROM "question"
        WHERE subject_id = ${bio.id} AND subtopic_id = ${geralSub.id}
        LIMIT 2
      )
      UPDATE "question" SET subtopic_id = ${inserted[i].id}
      WHERE id IN (SELECT id FROM picked)
    `);
  }

  console.log("Demo topics seeded.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
