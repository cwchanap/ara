import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

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

// Saved Configurations table - stores user's saved chaos map configurations
// Each configuration stores map type and parameters as JSONB for flexibility
export const savedConfigurations = pgTable(
	'saved_configurations',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: uuid('user_id')
			.notNull()
			.references(() => profiles.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		mapType: text('map_type').notNull(),
		parameters: jsonb('parameters').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull()
	},
	(table) => [
		index('saved_configurations_user_id_idx').on(table.userId),
		index('saved_configurations_user_created_at_idx').on(table.userId, table.createdAt)
	]
);

// Type inference for saved configurations
export type SavedConfiguration = typeof savedConfigurations.$inferSelect;
export type NewSavedConfiguration = typeof savedConfigurations.$inferInsert;
