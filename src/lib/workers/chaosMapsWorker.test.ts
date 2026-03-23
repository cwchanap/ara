import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { ChaosMapsWorkerRequest, ChaosMapsWorkerResponse } from './types';

type WorkerSelf = {
	onmessage: ((event: { data: ChaosMapsWorkerRequest | null }) => void) | null;
	postMessage: (message: ChaosMapsWorkerResponse) => void;
};

const responses: ChaosMapsWorkerResponse[] = [];
const selfMock: WorkerSelf = {
	onmessage: null,
	postMessage: (message) => {
		responses.push(message);
	}
};

const globalWithSelf = globalThis as { self?: unknown };
const originalSelf = globalWithSelf.self;

beforeAll(async () => {
	Object.defineProperty(globalThis, 'self', {
		value: selfMock,
		configurable: true,
		writable: true
	});
	await import('./chaosMapsWorker');
});

afterAll(() => {
	if (typeof originalSelf === 'undefined') {
		delete globalWithSelf.self;
	} else {
		Object.defineProperty(globalThis, 'self', {
			value: originalSelf,
			configurable: true,
			writable: true
		});
	}
});

describe('chaosMapsWorker', () => {
	test('handles standard map messages', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'standard',
				id: 1,
				numP: 1,
				numQ: 1,
				iterations: 2,
				k: 1,
				maxPoints: 10
			}
		});

		expect(responses).toHaveLength(1);
		expect(responses[0]?.type).toBe('standardResult');
		expect(responses[0]?.points).toHaveLength(2);
	});

	test('normalizes standard map points to [0, 2π)', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'standard',
				id: 3,
				numP: 1,
				numQ: 4,
				iterations: 1,
				k: 5,
				maxPoints: 10
			}
		});

		expect(responses).toHaveLength(1);
		expect(responses[0]?.type).toBe('standardResult');
		for (const [q, p] of responses[0]?.points ?? []) {
			expect(q).toBeGreaterThanOrEqual(0);
			expect(q).toBeLessThan(2 * Math.PI);
			expect(p).toBeGreaterThanOrEqual(0);
			expect(p).toBeLessThan(2 * Math.PI);
		}
	});

	test('handles chaos map messages', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'chaos',
				id: 2,
				a: 1.5,
				b: 0.5,
				x0: 0,
				y0: 0,
				iterations: 3,
				maxPoints: 10
			}
		});

		expect(responses).toHaveLength(1);
		expect(responses[0]?.type).toBe('chaosResult');
		expect(responses[0]?.points).toHaveLength(3);
	});

	test('ignores empty payloads', () => {
		responses.length = 0;
		selfMock.onmessage?.({ data: null });

		expect(responses).toHaveLength(0);
	});

	test('standard map: returns empty array when numP <= 0', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'standard',
				id: 10,
				numP: 0,
				numQ: 1,
				iterations: 5,
				k: 1,
				maxPoints: 100
			}
		});

		expect(responses).toHaveLength(1);
		expect(responses[0]?.type).toBe('standardResult');
		expect(responses[0]?.points).toHaveLength(0);
	});

	test('standard map: returns empty array when numQ <= 0', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'standard',
				id: 11,
				numP: 1,
				numQ: 0,
				iterations: 5,
				k: 1,
				maxPoints: 100
			}
		});

		expect(responses).toHaveLength(1);
		expect(responses[0]?.type).toBe('standardResult');
		expect(responses[0]?.points).toHaveLength(0);
	});

	test('standard map: returns empty array when iterations <= 0', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'standard',
				id: 12,
				numP: 2,
				numQ: 2,
				iterations: 0,
				k: 1,
				maxPoints: 100
			}
		});

		expect(responses).toHaveLength(1);
		expect(responses[0]?.type).toBe('standardResult');
		expect(responses[0]?.points).toHaveLength(0);
	});

	test('standard map: truncates output when maxPoints is reached', () => {
		responses.length = 0;
		// numP=2, numQ=2, iterations=100 → could generate up to 400 points
		// but maxPoints=5 should stop early
		selfMock.onmessage?.({
			data: {
				type: 'standard',
				id: 13,
				numP: 2,
				numQ: 2,
				iterations: 100,
				k: 1,
				maxPoints: 5
			}
		});

		expect(responses).toHaveLength(1);
		expect(responses[0]?.type).toBe('standardResult');
		expect(responses[0]?.points).toHaveLength(5);
	});

	test('standard map: echoes request id in response', () => {
		responses.length = 0;
		const requestId = 42;
		selfMock.onmessage?.({
			data: {
				type: 'standard',
				id: requestId,
				numP: 1,
				numQ: 1,
				iterations: 1,
				k: 0.5,
				maxPoints: 10
			}
		});

		expect(responses[0]?.id).toBe(requestId);
	});

	test('chaos map: echoes request id in response', () => {
		responses.length = 0;
		const requestId = 99;
		selfMock.onmessage?.({
			data: {
				type: 'chaos',
				id: requestId,
				a: 1.4,
				b: 0.3,
				x0: 0,
				y0: 0,
				iterations: 10,
				maxPoints: 100
			}
		});

		expect(responses[0]?.id).toBe(requestId);
	});

	test('chaos map: respects maxPoints limit', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'chaos',
				id: 20,
				a: 1.4,
				b: 0.3,
				x0: 0,
				y0: 0,
				iterations: 1000,
				maxPoints: 5
			}
		});

		expect(responses).toHaveLength(1);
		expect(responses[0]?.type).toBe('chaosResult');
		expect(responses[0]?.points).toHaveLength(5);
	});

	test('standard map: multiple initial conditions (numP=3, numQ=3)', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'standard',
				id: 30,
				numP: 3,
				numQ: 3,
				iterations: 2,
				k: 0.5,
				maxPoints: 1000
			}
		});

		// 3 × 3 initial conditions × 2 iterations = 18 points
		expect(responses[0]?.points).toHaveLength(18);
	});

	test('standard map: returns empty array when maxPoints = 0', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'standard',
				id: 40,
				numP: 2,
				numQ: 2,
				iterations: 10,
				k: 1,
				maxPoints: 0
			}
		});

		expect(responses).toHaveLength(1);
		expect(responses[0]?.type).toBe('standardResult');
		expect(responses[0]?.points).toHaveLength(0);
	});

	test('standard map: returns empty array when maxPoints < 0', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'standard',
				id: 41,
				numP: 2,
				numQ: 2,
				iterations: 10,
				k: 1,
				maxPoints: -5
			}
		});

		expect(responses).toHaveLength(1);
		expect(responses[0]?.type).toBe('standardResult');
		expect(responses[0]?.points).toHaveLength(0);
	});

	test('chaos map: returns 0 points when maxPoints = 0', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'chaos',
				id: 50,
				a: 1.4,
				b: 0.3,
				x0: 0,
				y0: 0,
				iterations: 100,
				maxPoints: 0
			}
		});

		// Math.min(100, 0) = 0 steps → empty array
		expect(responses).toHaveLength(1);
		expect(responses[0]?.type).toBe('chaosResult');
		expect(responses[0]?.points).toHaveLength(0);
	});

	test('chaos map: returns exactly 1 point when maxPoints = 1', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'chaos',
				id: 51,
				a: 1.4,
				b: 0.3,
				x0: 0,
				y0: 0,
				iterations: 1000,
				maxPoints: 1
			}
		});

		expect(responses).toHaveLength(1);
		expect(responses[0]?.type).toBe('chaosResult');
		expect(responses[0]?.points).toHaveLength(1);
	});

	test('chaos map: output points are finite numbers', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'chaos',
				id: 52,
				a: 1.5,
				b: 0.5,
				x0: 0.1,
				y0: 0.1,
				iterations: 50,
				maxPoints: 50
			}
		});

		expect(responses).toHaveLength(1);
		for (const [x, y] of responses[0]?.points ?? []) {
			expect(Number.isFinite(x)).toBe(true);
			expect(Number.isFinite(y)).toBe(true);
		}
	});

	test('chaos map: different a values produce different trajectories', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'chaos',
				id: 60,
				a: 1.4,
				b: 0.3,
				x0: 0.5,
				y0: 0.5,
				iterations: 50,
				maxPoints: 50
			}
		});
		const points1 = [...(responses[0]?.points ?? [])];

		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'chaos',
				id: 61,
				a: 0.1,
				b: 0.3,
				x0: 0.5,
				y0: 0.5,
				iterations: 50,
				maxPoints: 50
			}
		});
		const points2 = [...(responses[0]?.points ?? [])];

		// Significantly different a values (1.4 vs 0.1) should produce clearly different trajectories
		const diff = Math.abs((points1[49]?.[0] ?? 0) - (points2[49]?.[0] ?? 0));
		expect(diff).toBeGreaterThan(0.001);
	});

	test('standard map: k = 0 produces points on identity line', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'standard',
				id: 70,
				numP: 1,
				numQ: 1,
				iterations: 3,
				k: 0,
				maxPoints: 100
			}
		});

		expect(responses).toHaveLength(1);
		expect(responses[0]?.type).toBe('standardResult');
		// With k=0: pNew = p + 0*sin(q) = p, qNew = q + p (mod 2π)
		// Points should be finite and within [0, 2π)
		const TWO_PI = 2 * Math.PI;
		for (const [q, p] of responses[0]?.points ?? []) {
			expect(q).toBeGreaterThanOrEqual(0);
			expect(q).toBeLessThan(TWO_PI);
			expect(p).toBeGreaterThanOrEqual(0);
			expect(p).toBeLessThan(TWO_PI);
		}
	});
});
