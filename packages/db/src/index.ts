import { env } from "@pruvi/env/server";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
});
export const db = drizzle(pool, { schema });
