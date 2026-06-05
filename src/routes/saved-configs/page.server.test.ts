/**
 * Tests for saved-configs page server (load + save/delete/rename actions).
 *
 * Covers:
 *  - load: auth guard, DB fetch, parameter validation, filter of invalid configs
 *  - save action: auth guard, name/mapType/params validation, DB insert, error handling
 *  - delete action: auth guard, ownership check, 404, DB delete, error handling
 *  - rename action: auth guard, name validation, ownership check, DB update, error handling
 */

import { beforeEach, describe, expect, vi, test } from 'vitest';

// ── Hoisted mock state ────────────────────────────────────────────────────────

const h = vi.hoisted(() => {
	const state = {
		selectQueue: [] as unknown[][],
		insertQueue: [] as unknown[][],
		deleteShouldThrow: null as Error | null,
		updateShouldThrow: null as Error | null,
		insertShouldThrow: null as Error | null,
		lastInsertedValues: null as Record<string, unknown> | null,
		lastUpdatedValues: null as Record<string, unknown> | null,
		operationLog: [] as string[]
	};

	const ensureProfileForUser = vi.fn(async () => {
		state.operationLog.push('provision');
		return {
			id: 'user-1',
			username: 'user_1',
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z'
		};
	});

	const selectMock = vi.fn(() => {
		const chain: Record<string, unknown> = {
			from: vi.fn(() => chain),
			where: vi.fn(() => chain),
			orderBy: vi.fn(async () => state.selectQueue.shift() ?? []),
			limit: vi.fn(async () => state.selectQueue.shift() ?? [])
		};
		return chain;
	});

	const insertMock = vi.fn(() => ({
		values: (vals: Record<string, unknown>) => {
			state.operationLog.push('insert');
			state.lastInsertedValues = vals;
			return {
				returning: vi.fn(async () => {
					if (state.insertShouldThrow) {
						const e = state.insertShouldThrow;
						state.insertShouldThrow = null;
						throw e;
					}
					return state.insertQueue.shift() ?? [{ id: 'new-config-id' }];
				})
			};
		}
	}));

	const updateMock = vi.fn(() => ({
		set: vi.fn((vals: Record<string, unknown>) => {
			state.lastUpdatedValues = vals;
			return {
				where: vi.fn(async () => {
					if (state.updateShouldThrow) {
						const e = state.updateShouldThrow;
						state.updateShouldThrow = null;
						throw e;
					}
				})
			};
		})
	}));

	const deleteMock = vi.fn(() => ({
		where: vi.fn(async () => {
			if (state.deleteShouldThrow) {
				const e = state.deleteShouldThrow;
				state.deleteShouldThrow = null;
				throw e;
			}
		})
	}));

	return { state, ensureProfileForUser, selectMock, insertMock, updateMock, deleteMock };
});

vi.mock('$lib/server/db', () => ({
	db: {
		select: h.selectMock,
		insert: h.insertMock,
		update: h.updateMock,
		delete: h.deleteMock
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

vi.mock('$lib/server/profile-provisioning', () => ({
	ensureProfileForUser: h.ensureProfileForUser
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
	h.state.selectQueue.length = 0;
	h.state.insertQueue.length = 0;
	h.state.deleteShouldThrow = null;
	h.state.updateShouldThrow = null;
	h.state.insertShouldThrow = null;
	h.state.lastInsertedValues = null;
	h.state.lastUpdatedValues = null;
	h.state.operationLog = [];
	h.selectMock.mockClear();
	h.insertMock.mockClear();
	h.updateMock.mockClear();
	h.deleteMock.mockClear();
	h.ensureProfileForUser.mockClear();
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
		h.state.selectQueue.push([]); // DB returns empty
		const result = (await load({
			locals: makeLocals(),
			url: makeUrl()
		} as unknown as Parameters<typeof load>[0])) as unknown as {
			configurations: Array<{ id: string; mapType: string }>;
		};
		expect(result.configurations).toEqual([]);
	});

	test('returns typed configurations for valid DB rows', async () => {
		h.state.selectQueue.push([makeDbConfig()]);
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
		h.state.selectQueue.push([
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
		h.state.selectQueue.push([
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
		expect(h.ensureProfileForUser).not.toHaveBeenCalled();
		expect(h.state.operationLog).toEqual([]);
	});

	test('returns 400 when name is missing', async () => {
		const result = await actions.save({
			locals: makeLocals(),
			request: makeRequest({ name: '', mapType: 'lorenz', parameters: '{}' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 400, data: { saveError: expect.any(String) } });
		expect(h.ensureProfileForUser).not.toHaveBeenCalled();
		expect(h.state.operationLog).toEqual([]);
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
		h.state.insertQueue.push([{ id: 'new-id' }]);
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
		expect(h.ensureProfileForUser).not.toHaveBeenCalled();
		expect(h.state.operationLog).toEqual([]);
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
		expect(h.ensureProfileForUser).not.toHaveBeenCalled();
		expect(h.state.operationLog).toEqual([]);
	});

	test('returns 201 with configurationId on successful save', async () => {
		h.state.insertQueue.push([{ id: 'saved-config-id' }]);
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

	test('ensures the authenticated user has a profile before inserting', async () => {
		h.state.insertQueue.push([{ id: 'saved-config-id' }]);
		const result = await actions.save({
			locals: makeLocals({ userId: 'first-google-user' }),
			request: makeRequest({
				name: 'My Lorenz Config',
				mapType: 'lorenz',
				parameters: JSON.stringify({ type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 })
			})
		} as unknown as Parameters<typeof load>[0]);

		expect(result).toMatchObject({ success: true });
		expect(h.ensureProfileForUser).toHaveBeenCalledWith({ id: 'first-google-user' });
		expect(h.state.operationLog).toEqual(['provision', 'insert']);
	});

	test('trims whitespace from name before saving', async () => {
		h.state.insertQueue.push([{ id: 'new-id' }]);
		await actions.save({
			locals: makeLocals(),
			request: makeRequest({
				name: '  Trimmed Config  ',
				mapType: 'lorenz',
				parameters: JSON.stringify({ type: 'lorenz', sigma: 10, rho: 28, beta: 2.667 })
			})
		} as unknown as Parameters<typeof load>[0]);
		expect(h.state.lastInsertedValues?.name).toBe('Trimmed Config');
	});

	test('returns 500 when DB insert fails', async () => {
		h.state.insertShouldThrow = new Error('DB connection failed');
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
		h.state.insertQueue.push([{ id: 'rossler-id' }]);
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
		h.state.insertQueue.push([{ id: 'henon-id' }]);
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
		h.state.selectQueue.push([]); // no rows found
		const result = await actions.delete({
			locals: makeLocals(),
			request: makeRequest({ configurationId: 'nonexistent-id' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 404, data: { deleteError: expect.any(String) } });
	});

	test('returns 403 when configuration belongs to another user', async () => {
		h.state.selectQueue.push([{ id: 'config-1', userId: 'other-user' }]);
		const result = await actions.delete({
			locals: makeLocals({ userId: 'requesting-user' }),
			request: makeRequest({ configurationId: 'config-1' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 403, data: { deleteError: expect.any(String) } });
	});

	test('returns deleteSuccess: true on successful deletion', async () => {
		h.state.selectQueue.push([{ id: 'config-1', userId: 'user-1' }]);
		const result = await actions.delete({
			locals: makeLocals({ userId: 'user-1' }),
			request: makeRequest({ configurationId: 'config-1' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ deleteSuccess: true });
		expect(h.deleteMock).toHaveBeenCalledTimes(1);
	});

	test('returns 500 when DB delete throws', async () => {
		h.state.selectQueue.push([{ id: 'config-1', userId: 'user-1' }]);
		h.state.deleteShouldThrow = new Error('DB error');
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
		h.state.selectQueue.push([]); // no rows found
		const result = await actions.rename({
			locals: makeLocals(),
			request: makeRequest({ configurationId: 'nonexistent-id', name: 'New Name' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 404, data: { renameError: expect.any(String) } });
	});

	test('returns 403 when configuration belongs to another user', async () => {
		h.state.selectQueue.push([{ id: 'config-1', userId: 'other-user' }]);
		const result = await actions.rename({
			locals: makeLocals({ userId: 'requesting-user' }),
			request: makeRequest({ configurationId: 'config-1', name: 'New Name' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 403, data: { renameError: expect.any(String) } });
	});

	test('returns renameSuccess with new name on successful rename', async () => {
		h.state.selectQueue.push([{ id: 'config-1', userId: 'user-1' }]);
		const result = await actions.rename({
			locals: makeLocals({ userId: 'user-1' }),
			request: makeRequest({ configurationId: 'config-1', name: 'Renamed Config' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ renameSuccess: true, name: 'Renamed Config' });
		expect(h.updateMock).toHaveBeenCalledTimes(1);
	});

	test('trims whitespace from new name', async () => {
		h.state.selectQueue.push([{ id: 'config-1', userId: 'user-1' }]);
		const result = await actions.rename({
			locals: makeLocals({ userId: 'user-1' }),
			request: makeRequest({ configurationId: 'config-1', name: '  Trimmed Name  ' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ renameSuccess: true, name: 'Trimmed Name' });
		expect(h.state.lastUpdatedValues?.name).toBe('Trimmed Name');
	});

	test('returns 500 when DB update throws', async () => {
		h.state.selectQueue.push([{ id: 'config-1', userId: 'user-1' }]);
		h.state.updateShouldThrow = new Error('DB error');
		const result = await actions.rename({
			locals: makeLocals({ userId: 'user-1' }),
			request: makeRequest({ configurationId: 'config-1', name: 'New Name' })
		} as unknown as Parameters<typeof load>[0]);
		expect(result).toMatchObject({ status: 500, data: { renameError: expect.any(String) } });
	});

	test('accepts name exactly 100 characters', async () => {
		h.state.selectQueue.push([{ id: 'config-1', userId: 'user-1' }]);
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
		h.state.selectQueue.push([
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
		expect(result).toMatchObject({ status: 400, data: { saveError: expect.any(String) } });
	});
});

describe('saved-configs rename action – name not a string from FormData', () => {
	test('returns 400 when name is null (FormData missing value)', async () => {
		// FormData.get('name') returns null when the field is missing.
		h.state.selectQueue.push([makeDbConfig()]); // ownership check passes
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
