import { eq } from "drizzle-orm";
import { user } from "@pruvi/db/schema/auth";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export class UsersRepository {
  constructor(private db: DbClient) {}

  async findById(userId: string) {
    const rows = await this.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  async updateProfile(
    userId: string,
    patch: { name?: string; image?: string | null }
  ) {
    const [row] = await this.db
      .update(user)
      .set(patch)
      .where(eq(user.id, userId))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      });
    return row;
  }

  async deleteUser(userId: string) {
    await this.db.delete(user).where(eq(user.id, userId));
  }
}
