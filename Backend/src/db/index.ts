import { drizzle } from "drizzle-orm/node-postgres";
import "dotenv/config";
import pg from "pg";
import * as schema from "./schema";

const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});

export const db = drizzle(pool, { schema }); // same as {schema: schema}