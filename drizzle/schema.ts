import { pgTable, unique, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const profiles = pgTable(
	'profiles',
	{
		id: uuid().primaryKey().notNull(),
		username: text().notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull()
	},
	(table) => [unique('profiles_username_unique').on(table.username)]
);
