/**
 * Tests for saved-configs page server (load + save/delete/rename actions).
 *
 * Covers:
 *  - load: auth guard, DB fetch, parameter validation, filter of invalid configs
 *  - save action: auth guard, name/mapType/params validation, DB insert, error handling
 *  - delete action: auth guard, ownership check, 404, DB delete, error handling
 *  - rename action: auth guard, name validation, ownership check, DB update, error handling
 */

import { beforeEach, describe, expect, mock, test } from 'bun:test';

// ── DB mock state ─────────────────────────────────────────────────────────────

const selectQueue: unknown[][] = [];
const insertQueue: unknown[][] = [];
let deleteShouldThrow: Error | null = null;
let updateShouldThrow: Error | null = null;
let insertShouldThrow: Error | null = null;
let lastInsertedValues: Record<string, unknown> | null = null;
let lastUpdatedValues: Record<string, unknown> | null = null;

const selectMock = mock(() => {
	const chain: Record<string, unknown> = {
		from: mock(() => chain),
		where: mock(() => chain),
		orderBy: mock(async () => selectQueue.shift() ?? []),
		limit: mock(async () => selectQueue.shift() ?? [])
	};
	return chain;
});

const insertMock = mock(() => ({
	values: (vals: Record<string, unknown>) => {
		lastInsertedValues = vals;
		return {
			returning: mock(async () => {
				if (insertShouldThrow) {
					const e = insertShouldThrow;
					insertShouldThrow = null;
					throw e;
				}
				return insertQueue.shift() ?? [{ id: 'new-config-id' }];
			})
		};
	}
}));

const updateMock = mock(() => ({
	set: mock((vals: Record<string, unknown>) => {
		lastUpdatedValues = vals;
		return {
			where: mock(async () => {
				if (updateShouldThrow) {
					const e = updateShouldThrow;
					updateShouldThrow = null;
					throw e;
				}
			})
		};
	})
}));

const deleteMock = mock(() => ({
	where: mock(async () => {
		if (deleteShouldThrow) {
			const e = deleteShouldThrow;
			deleteShouldThrow = null;
			throw e;
		}
	})
}));

mock.module('$lib/server/db', () => ({
	db: {
		select: selectMock,
		insert: insertMock,
		update: updateMock,
		delete: deleteMock
	},
	savedConfigurations: {
		id: 'id',
		userId: 'userId',
		name: 'name',
		mapType: 'mapType',
		parameters: 'parameters',
		createdAt: 'createdAt'
	},
	sharedConfigurations: {},
	profiles: {}
}));

mock.module('drizzle-orm', () => ({
	eq: (a: unknown, b: unknown) => ({ eq: [a, b] }),
	desc: (a: unknown) => ({ desc: a })
}));

// Dynamic import AFTER mock registration.
const { actions, load } = await import('./+page.server');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLocals({
	hasSession = true,
	userId = 'user-1'
}: {
	hasSession?: boolean;
	userId?: string;
} = {}) {
	return {
		safeGetSession: async () => ({
			session: hasSession ? { access_token: 'tok' } : null,
			user: hasSession ? { id: userId } : null
		})
	};
}

function makeRequest(fields: Record<string, string>) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(fields)) fd.set(k, v);
	return { formData: async () => fd };
}

function makeUrl(path = '/saved-configs') {
	return new URL(`http://localhost${path}`);
}

/** A valid saved config row from DB */
function makeDbConfig(overrides: Record<string, unknown> = {}) {
	return {
		id: 'config-1',
		userId: 'user-1',
		name: 'My Config',
		mapType: 'lorenz',
		parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 },
		createdAt: '2024-01-01T00:00:00Z',
		updatedAt: '2024-01-01T00:00:00Z',
		...overrides
	};
}

beforeEach(() => {
	selectQueue.length = 0;
	insertQueue.length = 0;
	deleteShouldThrow = null;
	updateShouldThrow = null;
	insertShouldThrow = null;
	lastInsertedValues = null;
	lastUpdatedValues = null;
	selectMock.mockClear();
	insertMock.mockClear();
	updateMock.mockClear();
	deleteMock.mockClear();
});

// ── load ──────────────────────────────────────────────────────────────────────

describe('saved-configs load', () => {
	test('redirects unauthenticated users to login', async () => {
		await expect(
			load({
				locals: makeLocals({ hasSession: false }),
				url: makeUrl()
			} as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({ status: 303, location: '/login?redirect=%2Fsaved-configs' });
	});

	test('returns empty configurations array when user has none', async () => {
		selectQueue.push([]); // DB returns empty
		const result = (await load({
			locals: makeLocals(),
			url: makeUrl()
		} as unknown as Parameters<typeof load>[0])) as unknown as {
			configurations: Array<{ id: string; mapType: string }>;
		};
		expect(result.configurations).toEqual([]);
	});

	test('returns typed configurations for valid DB rows', async () => {
		selectQueue.push([makeDbConfig()]);
		const result = (await load({
			locals: makeLocals(),
			url: makeUrl()
		} as unknown as Parameters<typeof load>[0])) as unknown as {
			configurations: Array<{ id: string; mapType: string }>;
		};
		expect(result.configurations).toHaveLength(1);
		expect(result.configurations[0].id).toBe('config-1');
		expect(result.configurations[0].mapType).toBe('lorenz');
	});

	test('filters out configurations with invalid parameters', async () => {
		selectQueue.push([
			makeDbConfig({ parameters: { type: 'lorenz', sigma: 'bad' } }), // invalid
			makeDbConfig({
				id: 'config-2',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 }
			}) // valid
		]);
		const result = (await load({
			locals: makeLocals(),
			url: makeUrl()
		} as unknown as Parameters<typeof load>[0])) as unknown as {
			configurations: Array<{ id: string; mapType: string }>;
		};
		expect(result.configurations).toHaveLength(1);
		expect(result.configurations[0].id).toBe('config-2');
	});

	test('returns multiple valid configurations', async () => {
		selectQueue.push([
			makeDbConfig({ id: 'c1' }),
			makeDbConfig({
				id: 'c2',
				mapType: 'rossler',
				parameters: { type: 'rossler', a: 0.2, b: 0.2, c: 5.7 }
			}),
			makeDbConfig({
				id: 'c3',
				mapType: 'henon',
				parameters: { type: 'henon', a: 1.4, b: 0.3, iterations: 2000 }
			})
		]);
		const result = (await load({
			locals: makeLocals(),
			url: makeUrl()
		} as unknown as Parameters<typeof load>[0])) as unknown as {
			configurations: Array<{ id: string; mapType: string }>;
		};
		expect(result.configurations).toHaveLength(3);
	});
});

// ── save action ───────────────────────────────────────────────────────────────

describe('saved-configs save action', () => {
	test('returns 401 when not authenticated', async () => {
		const result = await actions.save({
			locals: makeLocals({ hasSession: false }),
			request: makeRequest({ name: 'Test', mapType: 'lorenz', parameters: '{}' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 401 });
	});

	test('returns 400 when name is missing', async () => {
		const result = await actions.save({
			locals: makeLocals(),
			request: makeRequest({ name: '', mapType: 'lorenz', parameters: '{}' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 400, data: { saveError: expect.any(String) } });
	});

	test('returns 400 when name is only whitespace', async () => {
		const result = await actions.save({
			locals: makeLocals(),
			request: makeRequest({ name: '   ', mapType: 'lorenz', parameters: '{}' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 400 });
	});

	test('returns 400 when name exceeds 100 characters', async () => {
		const result = await actions.save({
			locals: makeLocals(),
			request: makeRequest({
				name: 'a'.repeat(101),
				mapType: 'lorenz',
				parameters: JSON.stringify({ type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 })
			})
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({
			status: 400,
			data: { saveError: expect.stringContaining('100') }
		});
	});

	test('accepts name exactly 100 characters long', async () => {
		insertQueue.push([{ id: 'new-id' }]);
		const result = await actions.save({
			locals: makeLocals(),
			request: makeRequest({
				name: 'a'.repeat(100),
				mapType: 'lorenz',
				parameters: JSON.stringify({ type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 })
			})
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ success: true });
	});

	test('returns 400 for invalid mapType', async () => {
		const result = await actions.save({
			locals: makeLocals(),
			request: makeRequest({ name: 'Test', mapType: 'not-real', parameters: '{}' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({
			status: 400,
			data: { saveError: expect.stringContaining('Invalid map type') }
		});
	});

	test('returns 400 when parameters field is missing', async () => {
		const result = await actions.save({
			locals: makeLocals(),
			request: makeRequest({ name: 'Test', mapType: 'lorenz' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 400 });
	});

	test('returns 400 for invalid JSON parameters', async () => {
		const result = await actions.save({
			locals: makeLocals(),
			request: makeRequest({ name: 'Test', mapType: 'lorenz', parameters: 'not json{' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({
			status: 400,
			data: { saveError: expect.stringContaining('Invalid parameters format') }
		});
	});

	test('returns 400 for invalid lorenz parameters structure', async () => {
		const result = await actions.save({
			locals: makeLocals(),
			request: makeRequest({
				name: 'Test',
				mapType: 'lorenz',
				parameters: JSON.stringify({ type: 'lorenz', sigma: 10 }) // missing rho, beta
			})
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({
			status: 400,
			data: { saveError: expect.stringContaining('Invalid parameters') }
		});
	});

	test('returns 201 with configurationId on successful save', async () => {
		insertQueue.push([{ id: 'saved-config-id' }]);
		const result = await actions.save({
			locals: makeLocals(),
			request: makeRequest({
				name: 'My Lorenz Config',
				mapType: 'lorenz',
				parameters: JSON.stringify({ type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 })
			})
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ success: true, configurationId: 'saved-config-id' });
	});

	test('trims whitespace from name before saving', async () => {
		insertQueue.push([{ id: 'new-id' }]);
		await actions.save({
			locals: makeLocals(),
			request: makeRequest({
				name: '  Trimmed Config  ',
				mapType: 'lorenz',
				parameters: JSON.stringify({ type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 })
			})
		} as unknown as Parameters<typeof load>[0]);
		expect(lastInsertedValues?.name).toBe('Trimmed Config');
	});

	test('returns 500 when DB insert fails', async () => {
		insertShouldThrow = new Error('DB connection failed');
		const result = await actions.save({
			locals: makeLocals(),
			request: makeRequest({
				name: 'Test',
				mapType: 'lorenz',
				parameters: JSON.stringify({ type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 })
			})
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 500, data: { saveError: expect.any(String) } });
	});

	test('saves rossler configuration successfully', async () => {
		insertQueue.push([{ id: 'rossler-id' }]);
		const result = await actions.save({
			locals: makeLocals(),
			request: makeRequest({
				name: 'Rossler Config',
				mapType: 'rossler',
				parameters: JSON.stringify({ type: 'rossler', a: 0.2, b: 0.2, c: 5.7 })
			})
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ success: true });
	});

	test('saves henon configuration successfully', async () => {
		insertQueue.push([{ id: 'henon-id' }]);
		const result = await actions.save({
			locals: makeLocals(),
			request: makeRequest({
				name: 'Henon Config',
				mapType: 'henon',
				parameters: JSON.stringify({ type: 'henon', a: 1.4, b: 0.3, iterations: 2000 })
			})
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ success: true });
	});
});

// ── delete action ─────────────────────────────────────────────────────────────

describe('saved-configs delete action', () => {
	test('returns 401 when not authenticated', async () => {
		const result = await actions.delete({
			locals: makeLocals({ hasSession: false }),
			request: makeRequest({ configurationId: 'config-1' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 401 });
	});

	test('returns 400 when configurationId is missing', async () => {
		const result = await actions.delete({
			locals: makeLocals(),
			request: makeRequest({ configurationId: '' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 400, data: { deleteError: expect.any(String) } });
	});

	test('returns 404 when configuration does not exist', async () => {
		selectQueue.push([]); // no rows found
		const result = await actions.delete({
			locals: makeLocals(),
			request: makeRequest({ configurationId: 'nonexistent-id' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 404, data: { deleteError: expect.any(String) } });
	});

	test('returns 403 when configuration belongs to another user', async () => {
		selectQueue.push([{ id: 'config-1', userId: 'other-user' }]);
		const result = await actions.delete({
			locals: makeLocals({ userId: 'requesting-user' }),
			request: makeRequest({ configurationId: 'config-1' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 403, data: { deleteError: expect.any(String) } });
	});

	test('returns deleteSuccess: true on successful deletion', async () => {
		selectQueue.push([{ id: 'config-1', userId: 'user-1' }]);
		const result = await actions.delete({
			locals: makeLocals({ userId: 'user-1' }),
			request: makeRequest({ configurationId: 'config-1' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ deleteSuccess: true });
		expect(deleteMock).toHaveBeenCalledTimes(1);
	});

	test('returns 500 when DB delete throws', async () => {
		selectQueue.push([{ id: 'config-1', userId: 'user-1' }]);
		deleteShouldThrow = new Error('DB error');
		const result = await actions.delete({
			locals: makeLocals({ userId: 'user-1' }),
			request: makeRequest({ configurationId: 'config-1' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 500, data: { deleteError: expect.any(String) } });
	});
});

// ── rename action ─────────────────────────────────────────────────────────────

describe('saved-configs rename action', () => {
	test('returns 401 when not authenticated', async () => {
		const result = await actions.rename({
			locals: makeLocals({ hasSession: false }),
			request: makeRequest({ configurationId: 'config-1', name: 'New Name' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 401 });
	});

	test('returns 400 when configurationId is missing', async () => {
		const result = await actions.rename({
			locals: makeLocals(),
			request: makeRequest({ configurationId: '', name: 'New Name' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 400, data: { renameError: expect.any(String) } });
	});

	test('returns 400 when name is empty', async () => {
		const result = await actions.rename({
			locals: makeLocals(),
			request: makeRequest({ configurationId: 'config-1', name: '' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 400, data: { renameError: expect.any(String) } });
	});

	test('returns 400 when name exceeds 100 characters', async () => {
		const result = await actions.rename({
			locals: makeLocals(),
			request: makeRequest({ configurationId: 'config-1', name: 'a'.repeat(101) })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({
			status: 400,
			data: { renameError: expect.stringContaining('100') }
		});
	});

	test('returns 404 when configuration does not exist', async () => {
		selectQueue.push([]); // no rows found
		const result = await actions.rename({
			locals: makeLocals(),
			request: makeRequest({ configurationId: 'nonexistent-id', name: 'New Name' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 404, data: { renameError: expect.any(String) } });
	});

	test('returns 403 when configuration belongs to another user', async () => {
		selectQueue.push([{ id: 'config-1', userId: 'other-user' }]);
		const result = await actions.rename({
			locals: makeLocals({ userId: 'requesting-user' }),
			request: makeRequest({ configurationId: 'config-1', name: 'New Name' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 403, data: { renameError: expect.any(String) } });
	});

	test('returns renameSuccess with new name on successful rename', async () => {
		selectQueue.push([{ id: 'config-1', userId: 'user-1' }]);
		const result = await actions.rename({
			locals: makeLocals({ userId: 'user-1' }),
			request: makeRequest({ configurationId: 'config-1', name: 'Renamed Config' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ renameSuccess: true, name: 'Renamed Config' });
		expect(updateMock).toHaveBeenCalledTimes(1);
	});

	test('trims whitespace from new name', async () => {
		selectQueue.push([{ id: 'config-1', userId: 'user-1' }]);
		const result = await actions.rename({
			locals: makeLocals({ userId: 'user-1' }),
			request: makeRequest({ configurationId: 'config-1', name: '  Trimmed Name  ' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ renameSuccess: true, name: 'Trimmed Name' });
		expect(lastUpdatedValues?.name).toBe('Trimmed Name');
	});

	test('returns 500 when DB update throws', async () => {
		selectQueue.push([{ id: 'config-1', userId: 'user-1' }]);
		updateShouldThrow = new Error('DB error');
		const result = await actions.rename({
			locals: makeLocals({ userId: 'user-1' }),
			request: makeRequest({ configurationId: 'config-1', name: 'New Name' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 500, data: { renameError: expect.any(String) } });
	});

	test('accepts name exactly 100 characters', async () => {
		selectQueue.push([{ id: 'config-1', userId: 'user-1' }]);
		const result = await actions.rename({
			locals: makeLocals({ userId: 'user-1' }),
			request: makeRequest({ configurationId: 'config-1', name: 'a'.repeat(100) })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ renameSuccess: true });
	});
});

// ── Additional edge cases ─────────────────────────────────────────────────────

describe('saved-configs load – all configs invalid', () => {
	test('returns empty array when every DB config fails parameter validation', async () => {
		// Two configs both have invalid parameters — both must be filtered out.
		selectQueue.push([
			makeDbConfig({ mapType: 'lorenz', parameters: { type: 'lorenz', sigma: 'bad' } }),
			makeDbConfig({
				id: 'config-2',
				mapType: 'henon',
				parameters: { type: 'henon', a: 'x' }
			})
		]);
		const result = await load({
			locals: makeLocals(),
			url: makeUrl()
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ configurations: [] });
	});
});

describe('saved-configs save action – parametersJson not a string', () => {
	test('returns 400 when parametersJson is null (FormData missing value)', async () => {
		// FormData.get() returns null for missing fields; typeof null !== 'string' → 400.
		const fd = new FormData();
		fd.set('name', 'My Config');
		fd.set('mapType', 'lorenz');
		// deliberately omit 'parameters' so fd.get('parameters') returns null
		const result = await actions.save({
			locals: makeLocals(),
			request: { formData: async () => fd }
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 400 });
		if (result && 'data' in result) {
			expect(result.data.saveError).toBeDefined();
		}
	});
});

describe('saved-configs rename action – name not a string from FormData', () => {
	test('returns 400 when name is null (FormData missing value)', async () => {
		// FormData.get('name') returns null when the field is missing.
		selectQueue.push([makeDbConfig()]); // ownership check passes
		const fd = new FormData();
		fd.set('configurationId', 'config-1');
		// omit name → fd.get('name') === null → typeof null !== 'string' → 400
		const result = await actions.rename({
			locals: makeLocals(),
			request: { formData: async () => fd }
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 400 });
	});
});

describe('saved-configs delete action – configurationId not a string', () => {
	test('returns 400 when configurationId is null (FormData missing value)', async () => {
		const fd = new FormData();
		// omit configurationId → fd.get('configurationId') === null
		const result = await actions.delete({
			locals: makeLocals(),
			request: { formData: async () => fd }
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 400 });
	});
});
