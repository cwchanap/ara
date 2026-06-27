import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';

describe('database client initialization', () => {
	const originalDatabaseUrl = process.env.DATABASE_URL;
	const originalNetlifyDatabaseUrl = process.env.NETLIFY_DATABASE_URL;

	beforeAll(() => {
		// Self-contained precondition: ensure a database URL exists so the module
		// loads regardless of whether .env is present (e.g. in CI).
		if (!process.env.DATABASE_URL && !process.env.NETLIFY_DATABASE_URL) {
			process.env.NETLIFY_DATABASE_URL = 'postgresql://test:test@localhost/test';
		}
	});

	afterAll(() => {
		if (originalDatabaseUrl === undefined) {
			delete process.env.DATABASE_URL;
		} else {
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
		if (originalNetlifyDatabaseUrl === undefined) {
			delete process.env.NETLIFY_DATABASE_URL;
		} else {
			process.env.NETLIFY_DATABASE_URL = originalNetlifyDatabaseUrl;
		}
	});

	test('module loads successfully when DATABASE_URL is set', async () => {
		expect(process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL).toBeDefined();

		// import() returns a Promise; await it to properly surface load-time errors.
		await expect(import('./index.js')).resolves.toBeDefined();
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
});

describe('database client initialization – missing DATABASE_URL', () => {
	const originalDatabaseUrl = process.env.DATABASE_URL;
	const originalNetlifyDatabaseUrl = process.env.NETLIFY_DATABASE_URL;

	test('throws when neither DATABASE_URL nor NETLIFY_DATABASE_URL is set', async () => {
		// Use vi.doMock (not hoisted) so it takes effect after resetModules
		vi.resetModules();
		vi.doMock('$env/dynamic/private', () => ({
			env: {
				DATABASE_URL: undefined,
				NETLIFY_DATABASE_URL: undefined
			}
		}));

		await expect(import('./index.js')).rejects.toThrow(
			'DATABASE_URL environment variable is required'
		);

		// Clean up
		vi.doUnmock('$env/dynamic/private');
		vi.resetModules();

		// Restore env vars for subsequent tests
		if (originalDatabaseUrl !== undefined) {
			process.env.DATABASE_URL = originalDatabaseUrl;
		}
		if (originalNetlifyDatabaseUrl !== undefined) {
			process.env.NETLIFY_DATABASE_URL = originalNetlifyDatabaseUrl;
		}
		// Re-import to warm the cache with valid env vars
		if (process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL) {
			await import('./index.js');
		}
	});
});
