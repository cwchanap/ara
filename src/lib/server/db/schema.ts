import {
	pgTable,
	uuid,
	text,
	timestamp,
	jsonb,
	index,
	integer,
	varchar
} from 'drizzle-orm/pg-core';

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
		.$onUpdate(() => new Date().toISOString())
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
			.$onUpdate(() => new Date().toISOString())
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

// Shared Configurations table - public shareable links for chaos map configurations
// Anyone can view these without authentication
export const sharedConfigurations = pgTable(
	'shared_configurations',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		shortCode: varchar('short_code', { length: 8 }).unique().notNull(),
		userId: uuid('user_id').references(() => profiles.id, { onDelete: 'set null' }),
		username: text('username'), // Denormalized for public display after user deletion
		mapType: text('map_type').notNull(),
		parameters: jsonb('parameters').notNull(),
		viewCount: integer('view_count').default(0).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull()
	},
	(table) => [
		index('shared_configurations_short_code_idx').on(table.shortCode),
		index('shared_configurations_user_id_idx').on(table.userId),
		index('shared_configurations_expires_at_idx').on(table.expiresAt)
	]
);

// Type inference for shared configurations
export type SharedConfiguration = typeof sharedConfigurations.$inferSelect;
export type NewSharedConfiguration = typeof sharedConfigurations.$inferInsert;
