import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actions, load } from './saved-configs/+page.server';

const selectResults = vi.hoisted<unknown[][]>(() => []);
const insertResults = vi.hoisted<unknown[][]>(() => []);
const updateResults = vi.hoisted<unknown[][]>(() => []);
const deleteResults = vi.hoisted<unknown[][]>(() => []);
const savedConfigurations = vi.hoisted(() => ({
	id: 'id',
	userId: 'userId',
	mapType: 'mapType',
	parameters: 'parameters',
	createdAt: 'createdAt'
}));
const validateParametersMock = vi.hoisted(() => vi.fn());
const selectMock = vi.hoisted(() => vi.fn());
const insertMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());
const eqMock = vi.hoisted(() => vi.fn((left, right) => ({ left, right })));
const descMock = vi.hoisted(() => vi.fn((value) => value));

function nextResult(queue: unknown[][]) {
	return queue.shift() ?? [];
}

selectMock.mockImplementation(() => {
	const chain = {
		from: vi.fn(() => chain),
		where: vi.fn(() => chain),
		orderBy: vi.fn(async () => nextResult(selectResults)),
		limit: vi.fn(async () => nextResult(selectResults))
	};
	return chain;
});

insertMock.mockImplementation(() => ({
	values: vi.fn(() => ({
		returning: vi.fn(async () => nextResult(insertResults))
	}))
}));

updateMock.mockImplementation(() => ({
	set: vi.fn(() => ({
		where: vi.fn(async () => nextResult(updateResults))
	}))
}));

deleteMock.mockImplementation(() => ({
	where: vi.fn(async () => nextResult(deleteResults))
}));

vi.mock('$app/paths', () => ({ base: '' }));

vi.mock('$lib/chaos-validation', () => ({
	validateParameters: validateParametersMock
}));

vi.mock('$lib/server/db', () => ({
	db: {
		select: selectMock,
		insert: insertMock,
		update: updateMock,
		delete: deleteMock
	},
	savedConfigurations
}));

vi.mock('drizzle-orm', () => ({
	eq: eqMock,
	desc: descMock
}));

function makeLocals({
	session = { access_token: 'token' },
	user = { id: 'user-1' }
}: {
	session?: Record<string, unknown> | null;
	user?: { id: string } | null;
} = {}) {
	return {
		safeGetSession: vi.fn(async () => ({ session, user }))
	};
}

function makeRequest(fields: Record<string, string>) {
	const formData = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		formData.set(key, value);
	}
	return {
		formData: async () => formData
	};
}

describe('saved-configs route server', () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		selectResults.length = 0;
		insertResults.length = 0;
		updateResults.length = 0;
		deleteResults.length = 0;
		validateParametersMock.mockReset();
		validateParametersMock.mockReturnValue({ isValid: true });
		selectMock.mockClear();
		insertMock.mockClear();
		updateMock.mockClear();
		deleteMock.mockClear();
		consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
	});

	it('redirects unauthenticated users from load', async () => {
		await expect(
			load({
				locals: makeLocals({ session: null, user: null }),
				url: new URL('http://localhost/saved-configs')
			} as unknown as Parameters<typeof load>[0])
		).rejects.toMatchObject({
			status: 303,
			location: '/login?redirect=%2Fsaved-configs'
		});
	});

	it('filters out invalid configurations during load', async () => {
		selectResults.push([
			{
				id: 'cfg-valid',
				userId: 'user-1',
				name: 'Valid',
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 8 / 3 },
				createdAt: '2026-03-01T00:00:00.000Z',
				updatedAt: '2026-03-01T00:00:00.000Z'
			},
			{
				id: 'cfg-invalid',
				userId: 'user-1',
				name: 'Invalid',
				mapType: 'lorenz',
				parameters: { type: 'lorenz', sigma: 'bad' },
				createdAt: '2026-03-01T00:00:00.000Z',
				updatedAt: '2026-03-01T00:00:00.000Z'
			}
		]);
		validateParametersMock.mockImplementation((_mapType, parameters) => ({
			isValid:
				parameters !== undefined && (parameters as { sigma?: unknown }).sigma !== 'bad',
			errors: ['Invalid parameters']
		}));

		const result = await load({
			locals: makeLocals(),
			url: new URL('http://localhost/saved-configs')
		} as unknown as Parameters<typeof load>[0]);

		if (!result || !('configurations' in result)) {
			throw new Error('Expected saved configurations from load');
		}

		expect(result.configurations).toHaveLength(1);
		expect(result.configurations[0]?.id).toBe('cfg-valid');
	});

	it('returns a validation error when save name is missing', async () => {
		const result = await actions.save({
			locals: makeLocals(),
			request: makeRequest({
				name: '   ',
				mapType: 'lorenz',
				parameters: JSON.stringify({ type: 'lorenz', sigma: 10, rho: 28, beta: 8 / 3 })
			})
		} as unknown as Parameters<(typeof actions)['save']>[0]);

		expect(result).toMatchObject({
			status: 400,
			data: { saveError: 'Configuration name is required' }
		});
	});

	it('returns an error when save parameters are invalid json', async () => {
		const result = await actions.save({
			locals: makeLocals(),
			request: makeRequest({
				name: 'Lorenz',
				mapType: 'lorenz',
				parameters: '{not-json}'
			})
		} as unknown as Parameters<(typeof actions)['save']>[0]);

		expect(result).toMatchObject({
			status: 400,
			data: { saveError: 'Invalid parameters format' }
		});
	});

	it('saves a trimmed configuration and returns the new id', async () => {
		insertResults.push([{ id: 'cfg-new' }]);

		const result = await actions.save({
			locals: makeLocals(),
			request: makeRequest({
				name: '  Lorenz Save  ',
				mapType: 'lorenz',
				parameters: JSON.stringify({ type: 'lorenz', sigma: 10, rho: 28, beta: 8 / 3 })
			})
		} as unknown as Parameters<(typeof actions)['save']>[0]);

		expect(insertMock).toHaveBeenCalledTimes(1);
		expect(result).toEqual({ success: true, configurationId: 'cfg-new' });
	});

	it('rejects deleting configurations owned by another user', async () => {
		selectResults.push([{ id: 'cfg-1', userId: 'someone-else' }]);

		const result = await actions.delete({
			locals: makeLocals(),
			request: makeRequest({ configurationId: 'cfg-1' })
		} as unknown as Parameters<(typeof actions)['delete']>[0]);

		expect(result).toMatchObject({
			status: 403,
			data: { deleteError: 'You do not have permission to delete this configuration' }
		});
	});

	it('deletes configurations owned by the current user', async () => {
		selectResults.push([{ id: 'cfg-1', userId: 'user-1' }]);
		deleteResults.push([]);

		const result = await actions.delete({
			locals: makeLocals(),
			request: makeRequest({ configurationId: 'cfg-1' })
		} as unknown as Parameters<(typeof actions)['delete']>[0]);

		expect(deleteMock).toHaveBeenCalledTimes(1);
		expect(result).toEqual({ deleteSuccess: true });
	});

	it('returns not found when rename target does not exist', async () => {
		selectResults.push([]);

		const result = await actions.rename({
			locals: makeLocals(),
			request: makeRequest({ configurationId: 'cfg-missing', name: 'Updated Name' })
		} as unknown as Parameters<(typeof actions)['rename']>[0]);

		expect(result).toMatchObject({
			status: 404,
			data: { renameError: 'Configuration not found', configurationId: 'cfg-missing' }
		});
	});

	it('renames an existing configuration', async () => {
		selectResults.push([{ id: 'cfg-1', userId: 'user-1' }]);
		updateResults.push([]);

		const result = await actions.rename({
			locals: makeLocals(),
			request: makeRequest({ configurationId: 'cfg-1', name: '  Updated Name  ' })
		} as unknown as Parameters<(typeof actions)['rename']>[0]);

		expect(updateMock).toHaveBeenCalledTimes(1);
		expect(result).toEqual({ renameSuccess: true, name: 'Updated Name' });
	});

	// ── load: additional branches ─────────────────────────────────────────────

	it('returns empty configurations array when no configs exist', async () => {
		selectResults.push([]);

		const result = await load({
			locals: makeLocals(),
			url: new URL('http://localhost/saved-configs')
		} as unknown as Parameters<typeof load>[0]);

		expect(result).toMatchObject({ configurations: [] });
	});

	it('returns valid configurations from the database', async () => {
		const config = {
			id: 'cfg-valid',
			userId: 'user-1',
			name: 'Lorenz Default',
			mapType: 'lorenz',
			parameters: { type: 'lorenz', sigma: 10, rho: 28, beta: 8 / 3 },
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-01T00:00:00.000Z'
		};
		selectResults.push([config]);

		const result = await load({
			locals: makeLocals(),
			url: new URL('http://localhost/saved-configs')
		} as unknown as Parameters<typeof load>[0]);

		expect(result?.configurations).toHaveLength(1);
		expect(result?.configurations[0]?.id).toBe('cfg-valid');
	});

	// ── save: additional branches ─────────────────────────────────────────────

	it('returns 401 when unauthenticated user calls save', async () => {
		const result = await actions.save({
			locals: makeLocals({ session: null, user: null }),
			request: makeRequest({
				name: 'Test',
				mapType: 'lorenz',
				parameters: JSON.stringify({ type: 'lorenz', sigma: 10, rho: 28, beta: 8 / 3 })
			})
		} as unknown as Parameters<(typeof actions)['save']>[0]);

		expect(result).toMatchObject({ status: 401, data: { saveError: expect.any(String) } });
	});

	it('returns 400 when name exceeds 100 characters', async () => {
		const result = await actions.save({
			locals: makeLocals(),
			request: makeRequest({
				name: 'a'.repeat(101),
				mapType: 'lorenz',
				parameters: JSON.stringify({ type: 'lorenz', sigma: 10, rho: 28, beta: 8 / 3 })
			})
		} as unknown as Parameters<(typeof actions)['save']>[0]);

		expect(result).toMatchObject({
			status: 400,
			data: { saveError: 'Name must be 100 characters or less' }
		});
	});

	it('returns 400 for an invalid mapType', async () => {
		const result = await actions.save({
			locals: makeLocals(),
			request: makeRequest({
				name: 'Test Config',
				mapType: 'not-a-valid-type',
				parameters: JSON.stringify({ type: 'lorenz', sigma: 10, rho: 28, beta: 8 / 3 })
			})
		} as unknown as Parameters<(typeof actions)['save']>[0]);

		expect(result).toMatchObject({ status: 400, data: { saveError: 'Invalid map type' } });
	});

	it('returns 400 when parameters field is absent', async () => {
		// FormData has no "parameters" key → get('parameters') returns null
		const result = await actions.save({
			locals: makeLocals(),
			request: makeRequest({ name: 'Test Config', mapType: 'lorenz' })
		} as unknown as Parameters<(typeof actions)['save']>[0]);

		expect(result).toMatchObject({
			status: 400,
			data: { saveError: 'Parameters are required' }
		});
	});

	it('returns 400 when parameters fail schema validation', async () => {
		validateParametersMock.mockReturnValue({ isValid: false, errors: ['Missing sigma'] });

		const result = await actions.save({
			locals: makeLocals(),
			request: makeRequest({
				name: 'Bad Config',
				mapType: 'lorenz',
				parameters: JSON.stringify({ type: 'lorenz' })
			})
		} as unknown as Parameters<(typeof actions)['save']>[0]);

		expect(result).toMatchObject({ status: 400 });
		expect((result as { data?: { saveError?: string } }).data?.saveError).toContain(
			'Invalid parameters'
		);
	});

	it('returns 500 when the database insert throws during save', async () => {
		insertMock.mockImplementationOnce(() => ({
			values: vi.fn(() => ({
				returning: async () => {
					throw new Error('DB connection lost');
				}
			}))
		}));

		const result = await actions.save({
			locals: makeLocals(),
			request: makeRequest({
				name: 'Test Config',
				mapType: 'lorenz',
				parameters: JSON.stringify({ type: 'lorenz', sigma: 10, rho: 28, beta: 8 / 3 })
			})
		} as unknown as Parameters<(typeof actions)['save']>[0]);

		expect(result).toMatchObject({
			status: 500,
			data: { saveError: 'Failed to save configuration' }
		});
	});

	// ── delete: additional branches ───────────────────────────────────────────

	it('returns 401 when unauthenticated user calls delete', async () => {
		const result = await actions.delete({
			locals: makeLocals({ session: null, user: null }),
			request: makeRequest({ configurationId: 'cfg-1' })
		} as unknown as Parameters<(typeof actions)['delete']>[0]);

		expect(result).toMatchObject({ status: 401, data: { deleteError: expect.any(String) } });
	});

	it('returns 400 when configurationId is empty in delete', async () => {
		const result = await actions.delete({
			locals: makeLocals(),
			request: makeRequest({ configurationId: '' })
		} as unknown as Parameters<(typeof actions)['delete']>[0]);

		expect(result).toMatchObject({
			status: 400,
			data: { deleteError: 'Configuration ID is required' }
		});
	});

	it('returns 404 when config does not exist during delete', async () => {
		selectResults.push([]); // empty — config not found

		const result = await actions.delete({
			locals: makeLocals(),
			request: makeRequest({ configurationId: 'cfg-missing' })
		} as unknown as Parameters<(typeof actions)['delete']>[0]);

		expect(result).toMatchObject({
			status: 404,
			data: { deleteError: 'Configuration not found' }
		});
	});

	it('returns 500 when the database throws during delete', async () => {
		selectMock.mockImplementationOnce(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: async () => {
						throw new Error('DB error');
					}
				}))
			}))
		}));

		const result = await actions.delete({
			locals: makeLocals(),
			request: makeRequest({ configurationId: 'cfg-1' })
		} as unknown as Parameters<(typeof actions)['delete']>[0]);

		expect(result).toMatchObject({
			status: 500,
			data: { deleteError: 'Failed to delete configuration' }
		});
	});

	// ── rename: additional branches ───────────────────────────────────────────

	it('returns 401 when unauthenticated user calls rename', async () => {
		const result = await actions.rename({
			locals: makeLocals({ session: null, user: null }),
			request: makeRequest({ configurationId: 'cfg-1', name: 'New Name' })
		} as unknown as Parameters<(typeof actions)['rename']>[0]);

		expect(result).toMatchObject({ status: 401, data: { renameError: expect.any(String) } });
	});

	it('returns 400 when configurationId is empty in rename', async () => {
		const result = await actions.rename({
			locals: makeLocals(),
			request: makeRequest({ configurationId: '', name: 'New Name' })
		} as unknown as Parameters<(typeof actions)['rename']>[0]);

		expect(result).toMatchObject({
			status: 400,
			data: { renameError: 'Configuration ID is required' }
		});
	});

	it('returns 400 when new name is blank in rename', async () => {
		const result = await actions.rename({
			locals: makeLocals(),
			request: makeRequest({ configurationId: 'cfg-1', name: '   ' })
		} as unknown as Parameters<(typeof actions)['rename']>[0]);

		expect(result).toMatchObject({
			status: 400,
			data: { renameError: 'New name is required', configurationId: 'cfg-1' }
		});
	});

	it('returns 400 when new name exceeds 100 characters in rename', async () => {
		const result = await actions.rename({
			locals: makeLocals(),
			request: makeRequest({ configurationId: 'cfg-1', name: 'b'.repeat(101) })
		} as unknown as Parameters<(typeof actions)['rename']>[0]);

		expect(result).toMatchObject({
			status: 400,
			data: { renameError: 'Name must be 100 characters or less' }
		});
	});

	it('returns 403 when renaming a config that belongs to another user', async () => {
		selectResults.push([{ id: 'cfg-1', userId: 'different-owner' }]);

		const result = await actions.rename({
			locals: makeLocals(),
			request: makeRequest({ configurationId: 'cfg-1', name: 'New Name' })
		} as unknown as Parameters<(typeof actions)['rename']>[0]);

		expect(result).toMatchObject({
			status: 403,
			data: { renameError: 'You do not have permission to rename this configuration' }
		});
	});

	it('returns 500 when the database throws during rename', async () => {
		selectMock.mockImplementationOnce(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: async () => {
						throw new Error('DB error');
					}
				}))
			}))
		}));

		const result = await actions.rename({
			locals: makeLocals(),
			request: makeRequest({ configurationId: 'cfg-1', name: 'New Name' })
		} as unknown as Parameters<(typeof actions)['rename']>[0]);

		expect(result).toMatchObject({
			status: 500,
			data: { renameError: 'Failed to rename configuration' }
		});
	});
});
