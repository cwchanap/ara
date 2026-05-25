import { describe, expect, test } from 'bun:test';
import { profiles, savedConfigurations, sharedConfigurations } from './schema';

describe('database auth user id columns', () => {
	test('store Neon Auth user ids as text strings', () => {
		expect(profiles.id.columnType).toBe('PgText');
		expect(savedConfigurations.userId.columnType).toBe('PgText');
		expect(sharedConfigurations.userId.columnType).toBe('PgText');
	});

	test('keep app-generated configuration ids as UUIDs', () => {
		expect(savedConfigurations.id.columnType).toBe('PgUUID');
		expect(sharedConfigurations.id.columnType).toBe('PgUUID');
	});
});
