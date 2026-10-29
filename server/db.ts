/**
 * Database Connection
 *
 * Import this in your server-side code to access the database.
 * Example: import { db } from "./db";
 */
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "../drizzle/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });

// Re-export schema for convenience
export * from "../drizzle/schema";
