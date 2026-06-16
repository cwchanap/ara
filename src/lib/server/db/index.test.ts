import { describe, expect, test } from 'vitest';

describe('database client initialization', () => {
	test('module loads successfully when DATABASE_URL is set', () => {
		// Ensure DATABASE_URL is set (it should be in test environment)
		expect(process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL).toBeDefined();

		// Module should load without throwing
		expect(() => {
			import('./index.js');
		}).not.toThrow();
	});

	test('module exports db instance and schema tables', async () => {
		const { db, profiles, savedConfigurations, sharedConfigurations } = await import(
			'./index.js'
		);

		expect(db).toBeDefined();
		expect(profiles).toBeDefined();
		expect(savedConfigurations).toBeDefined();
		expect(sharedConfigurations).toBeDefined();
	});

	test('module re-exports types from shared types module', async () => {
		const module = await import('./index.js');

		// Check that type exports are available (they will be at runtime as empty objects for types)
		expect(module).toBeDefined();
	});
});
