import { describe, expect, test } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { profiles, savedConfigurations, sharedConfigurations } from './schema';
import { VALID_MAP_TYPES } from '$lib/types';
import { readFileSync, readdirSync } from 'node:fs';
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
	const migrationDir = resolve(import.meta.dirname, '../../../../drizzle');

	// Find the highest-numbered migration file that contains the map_type CHECK
	// constraint. This auto-detects the latest constraint-bearing migration so
	// adding a new map type doesn't require editing the test filename.
	function latestMapTypeMigrationSql(): string {
		const files = readdirSync(migrationDir)
			.filter((f) => f.endsWith('.sql'))
			.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
		for (let i = files.length - 1; i >= 0; i--) {
			const sql = readFileSync(resolve(migrationDir, files[i]), 'utf-8');
			if (/CHECK \("map_type" IN \(/.test(sql)) return sql;
		}
		throw new Error('no migration with a map_type CHECK constraint found');
	}

	test('saved_configurations constraint covers all VALID_MAP_TYPES', () => {
		const sql = latestMapTypeMigrationSql();
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
		const sql = latestMapTypeMigrationSql();
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
		const sql = latestMapTypeMigrationSql();
		const matches = sql.matchAll(/CHECK \("map_type" IN \(([^)]+)\)/g);
		for (const match of matches) {
			const constraintTypes = match[1]
				.split(',')
				.map((s: string) => s.trim().replace(/'/g, ''));
			expect(constraintTypes).toHaveLength(VALID_MAP_TYPES.length);
		}
	});

	test('drizzle journal registers the 0013 arnold-cat migration', () => {
		const journal = JSON.parse(
			readFileSync(resolve(migrationDir, 'meta/_journal.json'), 'utf-8')
		) as { entries: { idx: number; tag: string }[] };
		const entry = journal.entries.find((e) => e.tag === '0013_add_arnold_cat_map_type');
		expect(entry).toBeDefined();
		expect(entry!.idx).toBe(13);
		const tags = journal.entries.map((e) => e.tag);
		const migrationFiles = readdirSync(migrationDir).filter((f) => f.endsWith('.sql'));
		expect(migrationFiles.length).toBeGreaterThan(0);
		for (const file of migrationFiles) {
			expect(tags).toContain(file.replace(/\.sql$/, ''));
		}
	});

	test('drizzle journal registers the 0014 gingerbreadman migration', () => {
		const journal = JSON.parse(
			readFileSync(resolve(migrationDir, 'meta/_journal.json'), 'utf-8')
		) as { entries: { idx: number; tag: string }[] };
		const entry = journal.entries.find((e) => e.tag === '0014_add_gingerbreadman_map_type');
		expect(entry).toBeDefined();
		expect(entry!.idx).toBe(14);
		const tags = journal.entries.map((e) => e.tag);
		const migrationFiles = readdirSync(migrationDir).filter((f) => f.endsWith('.sql'));
		expect(migrationFiles.length).toBeGreaterThan(0);
		for (const file of migrationFiles) {
			expect(tags).toContain(file.replace(/\.sql$/, ''));
		}
	});
});

describe('database indexes', () => {
	test('saved_configurations has indexes on userId and userId+createdAt', () => {
		const config = getTableConfig(savedConfigurations);
		expect(config.indexes).toHaveLength(2);

		const names = config.indexes.map(
			(idx) => (idx as unknown as { config: { name: string } }).config.name
		);
		expect(names).toContain('saved_configurations_user_id_idx');
		expect(names).toContain('saved_configurations_user_created_at_idx');
	});

	test('shared_configurations has indexes on userId and expiresAt', () => {
		const config = getTableConfig(sharedConfigurations);
		expect(config.indexes).toHaveLength(2);

		const names = config.indexes.map(
			(idx) => (idx as unknown as { config: { name: string } }).config.name
		);
		expect(names).toContain('shared_configurations_user_id_idx');
		expect(names).toContain('shared_configurations_expires_at_idx');
	});

	test('saved_configurations userId index covers only userId', () => {
		const config = getTableConfig(savedConfigurations);
		const userIdIdx = config.indexes.find(
			(idx) =>
				(idx as unknown as { config: { name: string } }).config.name ===
				'saved_configurations_user_id_idx'
		);
		expect(userIdIdx).toBeDefined();
		const columns = (
			userIdIdx as unknown as { config: { columns: { name: string }[] } }
		).config.columns.map((c) => c.name);
		expect(columns).toEqual(['user_id']);
	});

	test('saved_configurations composite index covers userId and createdAt', () => {
		const config = getTableConfig(savedConfigurations);
		const compositeIdx = config.indexes.find(
			(idx) =>
				(idx as unknown as { config: { name: string } }).config.name ===
				'saved_configurations_user_created_at_idx'
		);
		expect(compositeIdx).toBeDefined();
		const columns = (
			compositeIdx as unknown as { config: { columns: { name: string }[] } }
		).config.columns.map((c) => c.name);
		expect(columns).toEqual(['user_id', 'created_at']);
	});

	test('shared_configurations expiresAt index covers only expiresAt', () => {
		const config = getTableConfig(sharedConfigurations);
		const expiresIdx = config.indexes.find(
			(idx) =>
				(idx as unknown as { config: { name: string } }).config.name ===
				'shared_configurations_expires_at_idx'
		);
		expect(expiresIdx).toBeDefined();
		const columns = (
			expiresIdx as unknown as { config: { columns: { name: string }[] } }
		).config.columns.map((c) => c.name);
		expect(columns).toEqual(['expires_at']);
	});
});

describe('schema column defaults and update callbacks', () => {
	test('profiles updated_at has an onUpdate callback returning ISO string', () => {
		const config = getTableConfig(profiles);
		const updatedAt = config.columns.find(
			(col) => (col as unknown as { name: string }).name === 'updated_at'
		);
		expect(updatedAt).toBeDefined();
		const onUpdateFn = (updatedAt as unknown as { onUpdateFn?: () => string }).onUpdateFn;
		expect(typeof onUpdateFn).toBe('function');
		const result = onUpdateFn!();
		expect(typeof result).toBe('string');
		expect(new Date(result).toISOString()).toBe(result);
	});

	test('saved_configurations updated_at has an onUpdate callback returning ISO string', () => {
		const config = getTableConfig(savedConfigurations);
		const updatedAt = config.columns.find(
			(col) => (col as unknown as { name: string }).name === 'updated_at'
		);
		expect(updatedAt).toBeDefined();
		const onUpdateFn = (updatedAt as unknown as { onUpdateFn?: () => string }).onUpdateFn;
		expect(typeof onUpdateFn).toBe('function');
		const result = onUpdateFn!();
		expect(typeof result).toBe('string');
		expect(new Date(result).toISOString()).toBe(result);
	});
});

describe('foreign key reference callbacks', () => {
	test('saved_configurations.userId references profiles.id with cascade delete', () => {
		const config = getTableConfig(savedConfigurations);
		expect(config.foreignKeys).toHaveLength(1);
		const fk = config.foreignKeys[0] as unknown as {
			reference: () => { foreignTable: typeof profiles; foreignColumns: unknown[] };
			onDelete: string;
		};
		expect(typeof fk.reference).toBe('function');
		const ref = fk.reference();
		expect(ref.foreignTable).toBe(profiles);
		expect(ref.foreignColumns[0]).toBe(profiles.id);
		expect(fk.onDelete).toBe('cascade');
	});

	test('shared_configurations.userId references profiles.id with cascade delete', () => {
		const config = getTableConfig(sharedConfigurations);
		expect(config.foreignKeys).toHaveLength(1);
		const fk = config.foreignKeys[0] as unknown as {
			reference: () => { foreignTable: typeof profiles; foreignColumns: unknown[] };
			onDelete: string;
		};
		expect(typeof fk.reference).toBe('function');
		const ref = fk.reference();
		expect(ref.foreignTable).toBe(profiles);
		expect(ref.foreignColumns[0]).toBe(profiles.id);
		expect(fk.onDelete).toBe('cascade');
	});
});
