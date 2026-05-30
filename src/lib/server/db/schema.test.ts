import { describe, expect, test } from 'bun:test';
import { profiles, savedConfigurations, sharedConfigurations } from './schema';
import { VALID_MAP_TYPES } from '$lib/types';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

describe('migration map_type constraints include all VALID_MAP_TYPES', () => {
	const migrationDir = resolve(import.meta.dir, '../../../../drizzle');

	test('saved_configurations constraint covers all VALID_MAP_TYPES', () => {
		const sql = readFileSync(resolve(migrationDir, '0006_add_chua_map_type.sql'), 'utf-8');
		const savedMatch = sql.match(
			/ALTER TABLE "saved_configurations"[\s\S]*?CHECK \("map_type" IN \(([^)]+)\)/
		);
		expect(savedMatch).not.toBeNull();
		const constraintTypes = savedMatch![1]
			.split(',')
			.map((s: string) => s.trim().replace(/'/g, ''));
		for (const type of VALID_MAP_TYPES) {
			expect(constraintTypes).toContain(type);
		}
	});

	test('shared_configurations constraint covers all VALID_MAP_TYPES', () => {
		const sql = readFileSync(resolve(migrationDir, '0006_add_chua_map_type.sql'), 'utf-8');
		const sharedMatch = sql.match(
			/ALTER TABLE "shared_configurations"[\s\S]*?CHECK \("map_type" IN \(([^)]+)\)/
		);
		expect(sharedMatch).not.toBeNull();
		const constraintTypes = sharedMatch![1]
			.split(',')
			.map((s: string) => s.trim().replace(/'/g, ''));
		for (const type of VALID_MAP_TYPES) {
			expect(constraintTypes).toContain(type);
		}
	});

	test('migration constraint has no extra types beyond VALID_MAP_TYPES', () => {
		const sql = readFileSync(resolve(migrationDir, '0006_add_chua_map_type.sql'), 'utf-8');
		const matches = sql.matchAll(/CHECK \("map_type" IN \(([^)]+)\)/g);
		for (const match of matches) {
			const constraintTypes = match[1]
				.split(',')
				.map((s: string) => s.trim().replace(/'/g, ''));
			expect(constraintTypes).toHaveLength(VALID_MAP_TYPES.length);
		}
	});
});
