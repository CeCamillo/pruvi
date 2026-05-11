import { subject } from "@pruvi/db/schema/subjects";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export class SubjectsRepository {
  constructor(private db: DbClient) {}

  async listAll() {
    return this.db
      .select({
        id: subject.id,
        slug: subject.slug,
        name: subject.name,
      })
      .from(subject)
      .orderBy(subject.name);
  }
}
