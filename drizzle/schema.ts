/**
 * Database Schema
 *
 * Define your database tables here using Drizzle ORM.
 * After modifying this file, run: pnpm db:push
 *
 * Docs: https://orm.drizzle.team/docs/sql-schema-declaration
 */
import { pgTable, serial, text, timestamp, varchar, boolean, integer } from "drizzle-orm/pg-core";

// Example: Users table
// Uncomment and modify as needed:
// export const users = pgTable("users", {
//   id: serial("id").primaryKey(),
//   email: varchar("email", { length: 255 }).notNull().unique(),
//   name: varchar("name", { length: 255 }),
//   createdAt: timestamp("created_at").defaultNow().notNull(),
//   updatedAt: timestamp("updated_at").defaultNow().notNull(),
// });

// Add your tables below:
