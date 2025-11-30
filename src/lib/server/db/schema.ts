import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

// Profiles table - stores user profile data
// Links to Supabase auth.users via the id (UUID from Supabase)
export const profiles = pgTable('profiles', {
	id: uuid('id').primaryKey(), // Matches Supabase auth.users.id
	username: text('username').unique().notNull(),
	createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
		.defaultNow()
		.notNull()
});

// Type inference for select and insert
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
