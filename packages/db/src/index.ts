import { env } from "@pruvi/env/server";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import * as schema from "./schema";

const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export { pool };
export const db = drizzle(pool, { schema });
