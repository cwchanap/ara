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
// Links to Neon Auth users via the string id from the auth session user.
export const profiles = pgTable('profiles', {
	id: text('id').primaryKey(),
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
// NOTE: map_type CHECK constraints live in migration files (drizzle/) rather
// than here. Drizzle *does* support CHECK via `check()` from pg-core, but we
// keep the constraint in SQL so VALID_MAP_TYPES (src/lib/types.ts) stays the
// single source of truth and the DB list can't drift from the TS union.
// schema.test.ts asserts the migration list matches VALID_MAP_TYPES exactly.
export const savedConfigurations = pgTable(
	'saved_configurations',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
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
// NOTE: map_type CHECK constraints live in migration files (drizzle/) for the
// same single-source-of-truth reason as saved_configurations (see above).
export const sharedConfigurations = pgTable(
	'shared_configurations',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		shortCode: varchar('short_code', { length: 8 }).unique().notNull(),
		userId: text('user_id')
			.references(() => profiles.id, { onDelete: 'cascade' })
			.notNull(),
		mapType: text('map_type').notNull(),
		parameters: jsonb('parameters').notNull(),
		viewCount: integer('view_count').default(0).notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull()
	},
	(table) => [
		index('shared_configurations_user_id_idx').on(table.userId),
		index('shared_configurations_expires_at_idx').on(table.expiresAt)
	]
);

// Type inference for shared configurations
export type SharedConfiguration = typeof sharedConfigurations.$inferSelect;
export type NewSharedConfiguration = typeof sharedConfigurations.$inferInsert;
