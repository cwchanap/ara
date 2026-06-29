import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest';
import type {
	ChaosMapsWorkerRequest,
	ChaosMapsWorkerResponse,
	ErrorResponse,
	StandardMapResponse,
	ChaosEsthetiqueResponse,
	IkedaResponse
} from './types';
import { handleWorkerMessage } from './chaosMapsHandler';
import * as handlerModule from './chaosMapsHandler';

type SuccessResponse = StandardMapResponse | ChaosEsthetiqueResponse | IkedaResponse;

function asSuccess(r: ChaosMapsWorkerResponse | undefined): SuccessResponse | undefined {
	if (r && r.type !== 'error') return r as SuccessResponse;
	return undefined;
}

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
		expect(asSuccess(responses[0])?.points).toHaveLength(2);
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
		for (const [q, p] of asSuccess(responses[0])?.points ?? []) {
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
		expect(asSuccess(responses[0])?.points).toHaveLength(3);
	});

	test('posts error response for empty payloads', () => {
		responses.length = 0;
		selfMock.onmessage?.({ data: null });

		expect(responses).toHaveLength(1);
		expect(responses[0]?.type).toBe('error');
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
		expect(asSuccess(responses[0])?.points).toHaveLength(0);
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
		expect(asSuccess(responses[0])?.points).toHaveLength(0);
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
		expect(asSuccess(responses[0])?.points).toHaveLength(0);
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
		expect(asSuccess(responses[0])?.points).toHaveLength(5);
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
		expect(asSuccess(responses[0])?.points).toHaveLength(5);
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
		expect(asSuccess(responses[0])?.points).toHaveLength(18);
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
		expect(asSuccess(responses[0])?.points).toHaveLength(0);
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
		expect(asSuccess(responses[0])?.points).toHaveLength(0);
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
		expect(asSuccess(responses[0])?.points).toHaveLength(0);
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
		expect(asSuccess(responses[0])?.points).toHaveLength(1);
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
		for (const [x, y] of asSuccess(responses[0])?.points ?? []) {
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
		const points1 = [...(asSuccess(responses[0])?.points ?? [])];

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
		const points2 = [...(asSuccess(responses[0])?.points ?? [])];

		// Significantly different a values (1.4 vs 0.1) should produce clearly different trajectories
		const diff = Math.abs((points1[49]?.[0] ?? 0) - (points2[49]?.[0] ?? 0));
		expect(diff).toBeGreaterThan(0.001);
	});

	test('standard map: k = 0 keeps p constant and points stay in [0, 2π)', () => {
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

		const points = asSuccess(responses[0])?.points ?? [];
		expect(points).toHaveLength(3);

		// With k=0: pNew = p + 0*sin(q) = p (p is unchanged each iteration)
		const firstP = points[0]?.[1];
		const TWO_PI = 2 * Math.PI;
		for (const [q, p] of points) {
			// p must remain equal to its initial value throughout all iterations
			expect(p).toBeCloseTo(firstP!, 10);
			// Both coordinates must stay within the normalised [0, 2π) range
			expect(q).toBeGreaterThanOrEqual(0);
			expect(q).toBeLessThan(TWO_PI);
			expect(p).toBeGreaterThanOrEqual(0);
			expect(p).toBeLessThan(TWO_PI);
		}
	});
});

// ── unknown / unhandled message types ────────────────────────────────────────

describe('unknown / unhandled message types', () => {
	test('posts an error response for an unrecognised type', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: { type: 'unknown', id: 99 } as unknown as ChaosMapsWorkerRequest
		});
		expect(responses).toHaveLength(1);
		const r = responses[0] as ErrorResponse;
		expect(r.type).toBe('error');
		expect(r.id).toBe(99);
		expect(r.message).toContain('unknown');
	});

	test('posts an error response when type is an empty string', () => {
		responses.length = 0;
		selfMock.onmessage?.({ data: { type: '', id: 1 } as unknown as ChaosMapsWorkerRequest });
		expect(responses).toHaveLength(1);
		const r = responses[0] as ErrorResponse;
		expect(r.type).toBe('error');
	});

	test('posts an error response when type is null', () => {
		responses.length = 0;
		selfMock.onmessage?.({ data: { type: null, id: 1 } as unknown as ChaosMapsWorkerRequest });
		expect(responses).toHaveLength(1);
		const r = responses[0] as ErrorResponse;
		expect(r.type).toBe('error');
	});

	test('error response falls back to id -1 when id is missing', () => {
		responses.length = 0;
		selfMock.onmessage?.({ data: { type: 'bogus' } as unknown as ChaosMapsWorkerRequest });
		expect(responses).toHaveLength(1);
		const r = responses[0] as ErrorResponse;
		expect(r.type).toBe('error');
		expect(r.id).toBe(-1);
		expect(r.message).toContain('bogus');
	});
});

// ── chaos map: negative parameters ───────────────────────────────────────────

describe('chaos map: negative parameter values', () => {
	test('handles negative a value and returns finite points', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'chaos',
				id: 200,
				a: -1.4,
				b: 0.3,
				x0: 0.5,
				y0: 0.5,
				iterations: 20,
				maxPoints: 20
			}
		});
		expect(responses).toHaveLength(1);
		expect(responses[0]?.type).toBe('chaosResult');
		expect(asSuccess(responses[0])?.points).toHaveLength(20);
		for (const [x, y] of asSuccess(responses[0])?.points ?? []) {
			expect(Number.isFinite(x)).toBe(true);
			expect(Number.isFinite(y)).toBe(true);
		}
	});

	test('handles negative b value and returns finite points', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'chaos',
				id: 201,
				a: 1.4,
				b: -0.3,
				x0: 0,
				y0: 0,
				iterations: 15,
				maxPoints: 15
			}
		});
		expect(responses).toHaveLength(1);
		expect(asSuccess(responses[0])?.points).toHaveLength(15);
	});

	test('handles a = 0 (degenerate case) without error', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'chaos',
				id: 202,
				a: 0,
				b: 0.3,
				x0: 1,
				y0: 1,
				iterations: 10,
				maxPoints: 10
			}
		});
		expect(responses[0]?.type).toBe('chaosResult');
		expect(asSuccess(responses[0])?.points).toHaveLength(10);
	});
});

// ── standard map: large k values ─────────────────────────────────────────────

describe('standard map: large k values', () => {
	test('large k (100) still produces normalised points in [0, 2π)', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'standard',
				id: 300,
				numP: 2,
				numQ: 2,
				iterations: 5,
				k: 100,
				maxPoints: 1000
			}
		});
		expect(responses[0]?.type).toBe('standardResult');
		const TWO_PI = 2 * Math.PI;
		for (const [q, p] of asSuccess(responses[0])?.points ?? []) {
			expect(q).toBeGreaterThanOrEqual(0);
			expect(q).toBeLessThan(TWO_PI);
			expect(p).toBeGreaterThanOrEqual(0);
			expect(p).toBeLessThan(TWO_PI);
		}
	});

	test('negative k value produces normalised output', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'standard',
				id: 301,
				numP: 1,
				numQ: 1,
				iterations: 3,
				k: -1,
				maxPoints: 100
			}
		});
		expect(responses[0]?.type).toBe('standardResult');
		expect(asSuccess(responses[0])?.points).toHaveLength(3);
		const TWO_PI = 2 * Math.PI;
		for (const [q, p] of asSuccess(responses[0])?.points ?? []) {
			expect(q).toBeGreaterThanOrEqual(0);
			expect(q).toBeLessThan(TWO_PI);
			expect(p).toBeGreaterThanOrEqual(0);
			expect(p).toBeLessThan(TWO_PI);
		}
	});
});

// ── chaos map: negative initial conditions ────────────────────────────────────

describe('chaos map: negative initial conditions', () => {
	test('handles x0 = -1 and y0 = -1', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'chaos',
				id: 400,
				a: 1.5,
				b: 0.5,
				x0: -1,
				y0: -1,
				iterations: 30,
				maxPoints: 30
			}
		});
		expect(responses[0]?.type).toBe('chaosResult');
		expect(asSuccess(responses[0])?.points).toHaveLength(30);
	});

	test('trajectory from negative x0 differs from positive x0', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'chaos',
				id: 401,
				a: 1.5,
				b: 0.5,
				x0: 1,
				y0: 1,
				iterations: 10,
				maxPoints: 10
			}
		});
		const lastPos = asSuccess(responses[0])?.points?.at(-1)?.[0] ?? 0;

		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'chaos',
				id: 402,
				a: 1.5,
				b: 0.5,
				x0: -1,
				y0: -1,
				iterations: 10,
				maxPoints: 10
			}
		});
		const lastNeg = asSuccess(responses[0])?.points?.at(-1)?.[0] ?? 0;

		expect(Math.abs(lastPos - lastNeg)).toBeGreaterThan(0);
	});
});

// ── standard map: single iteration / edge conditions ──────────────────────────

describe('standard map: single iteration per initial condition', () => {
	test('numP=3 numQ=3 iterations=1 produces exactly 9 points', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'standard',
				id: 500,
				numP: 3,
				numQ: 3,
				iterations: 1,
				k: 0.5,
				maxPoints: 1000
			}
		});
		expect(asSuccess(responses[0])?.points).toHaveLength(9);
	});
});

// ── ikeda map messages ─────────────────────────────────────────────────────────

describe('ikeda map messages', () => {
	test('handles ikeda message type', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'ikeda',
				id: 100,
				u: 0.918,
				iterations: 100,
				burnIn: 20,
				seeds: 30,
				maxPoints: 200000
			}
		});
		expect(responses).toHaveLength(1);
		expect(responses[0]?.type).toBe('ikedaResult');
		expect(responses[0]?.id).toBe(100);
		expect(asSuccess(responses[0])?.points.length).toBeGreaterThan(0);
	});

	test('ikeda response has parallel seedIndices', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'ikeda',
				id: 101,
				u: 0.918,
				iterations: 80,
				burnIn: 10,
				seeds: 25,
				maxPoints: 200000
			}
		});
		const r = responses[0];
		expect(r?.type).toBe('ikedaResult');
		if (r?.type === 'ikedaResult') {
			expect(r.seedIndices).toHaveLength(r.points.length);
		}
	});

	test('ikeda honors maxPoints cap', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'ikeda',
				id: 102,
				u: 0.918,
				iterations: 200,
				burnIn: 10,
				seeds: 100,
				maxPoints: 50
			}
		});
		expect(asSuccess(responses[0])?.points).toHaveLength(50);
		const r1 = responses[0];
		expect(r1?.type).toBe('ikedaResult');
		if (r1?.type === 'ikedaResult') {
			expect(r1.seedIndices).toHaveLength(50);
		}
	});

	test('ikeda with zero seeds returns empty', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'ikeda',
				id: 103,
				u: 0.918,
				iterations: 100,
				burnIn: 10,
				seeds: 0,
				maxPoints: 200000
			}
		});
		expect(asSuccess(responses[0])?.points).toHaveLength(0);
		const r2 = responses[0];
		expect(r2?.type).toBe('ikedaResult');
		if (r2?.type === 'ikedaResult') {
			expect(r2.seedIndices).toHaveLength(0);
		}
	});
});

// ── clifford map messages ──────────────────────────────────────────────────────

describe('handleWorkerMessage — clifford', () => {
	test('returns a cliffordResult capped at maxPoints', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'clifford',
				id: 7,
				a: -1.4,
				b: 1.6,
				c: 1.0,
				d: 0.7,
				iterations: 1000,
				maxPoints: 50
			}
		});
		expect(responses[0]?.type).toBe('cliffordResult');
		expect(responses[0]?.id).toBe(7);
		if (responses[0]?.type === 'cliffordResult') {
			expect(responses[0].points.length).toBe(50);
			expect(responses[0].points[0].length).toBe(2);
		}
	});
});

// ── handler throw → typed ErrorResponse ──────────────────────────────────────
//
// The worker's onmessage wraps dispatch in try/catch so a thrown handler
// (or a future postMessage structured-clone failure) becomes a typed
// ErrorResponse routed through the renderer's existing error branch,
// instead of an uncaught worker ErrorEvent whose `message` is empty.

describe('chaosMapsWorker — handler throw handling', () => {
	test('converts a thrown Error into a typed ErrorResponse with its message', () => {
		responses.length = 0;
		const spy = vi.spyOn(handlerModule, 'handleWorkerMessage').mockImplementation(() => {
			throw new Error('handler boom');
		});

		selfMock.onmessage?.({
			data: {
				type: 'clifford',
				id: 999,
				a: -1.4,
				b: 1.6,
				c: 1.0,
				d: 0.7,
				iterations: 1000,
				maxPoints: 50
			}
		});

		expect(responses).toHaveLength(1);
		const r = responses[0] as ErrorResponse;
		expect(r.type).toBe('error');
		expect(r.id).toBe(999);
		expect(r.message).toBe('handler boom');

		spy.mockRestore();
	});

	test('echoes the request id when the thrown request has a numeric id', () => {
		responses.length = 0;
		const spy = vi.spyOn(handlerModule, 'handleWorkerMessage').mockImplementation(() => {
			throw new Error('ikeda boom');
		});

		selfMock.onmessage?.({
			data: {
				type: 'ikeda',
				id: 4242,
				u: 0.918,
				iterations: 10,
				burnIn: 1,
				seeds: 1,
				maxPoints: 1
			}
		});

		const r = responses[0] as ErrorResponse;
		expect(r.type).toBe('error');
		expect(r.id).toBe(4242);
		expect(r.message).toBe('ikeda boom');

		spy.mockRestore();
	});

	test('falls back to id -1 when the thrown request has no numeric id', () => {
		responses.length = 0;
		const spy = vi.spyOn(handlerModule, 'handleWorkerMessage').mockImplementation(() => {
			throw new Error('no-id boom');
		});

		selfMock.onmessage?.({
			data: { type: 'clifford' } as unknown as ChaosMapsWorkerRequest
		});

		const r = responses[0] as ErrorResponse;
		expect(r.type).toBe('error');
		expect(r.id).toBe(-1);
		expect(r.message).toBe('no-id boom');

		spy.mockRestore();
	});

	test('stringifies non-Error throw values into the message', () => {
		responses.length = 0;
		const spy = vi.spyOn(handlerModule, 'handleWorkerMessage').mockImplementation(() => {
			throw 'string thrown value';
		});

		selfMock.onmessage?.({
			data: {
				type: 'clifford',
				id: 7,
				a: 1,
				b: 1,
				c: 1,
				d: 1,
				iterations: 1,
				maxPoints: 1
			}
		});

		const r = responses[0] as ErrorResponse;
		expect(r.type).toBe('error');
		expect(r.id).toBe(7);
		expect(r.message).toBe('string thrown value');

		spy.mockRestore();
	});

	test('still dispatches normally after a spy is restored (no regression)', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'clifford',
				id: 11,
				a: -1.4,
				b: 1.6,
				c: 1.0,
				d: 0.7,
				iterations: 5,
				maxPoints: 5
			}
		});
		expect(responses[0]?.type).toBe('cliffordResult');
		expect(responses[0]?.id).toBe(11);
	});
});

// ── gumowski-mira map messages ─────────────────────────────────────────────────

describe('handleWorkerMessage — gumowskiMira', () => {
	test('returns gumowskiMiraResult with points and seedIndices', () => {
		const result = handleWorkerMessage({
			type: 'gumowskiMira',
			id: 42,
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			iterations: 200,
			burnIn: 20,
			seeds: 30,
			maxPoints: 5000
		});
		expect(result.type).toBe('gumowskiMiraResult');
		if (result.type !== 'gumowskiMiraResult') return;
		expect(result.id).toBe(42);
		expect(result.points.length).toBeGreaterThan(0);
		expect(result.seedIndices.length).toBe(result.points.length);
	});

	test('is deterministic across calls', () => {
		const req = {
			type: 'gumowskiMira' as const,
			id: 1,
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			iterations: 100,
			burnIn: 0,
			seeds: 10,
			maxPoints: 1000
		};
		const r1 = handleWorkerMessage(req);
		const r2 = handleWorkerMessage(req);
		if (r1.type !== 'gumowskiMiraResult' || r2.type !== 'gumowskiMiraResult') {
			throw new Error('unexpected response type');
		}
		expect(r1.points).toEqual(r2.points);
	});

	test('returns empty for non-positive seeds', () => {
		const result = handleWorkerMessage({
			type: 'gumowskiMira',
			id: 7,
			mu: 0.31,
			a: 0.008,
			b: 0.05,
			iterations: 100,
			burnIn: 0,
			seeds: 0,
			maxPoints: 1000
		});
		if (result.type !== 'gumowskiMiraResult') throw new Error('unexpected type');
		expect(result.points).toEqual([]);
	});
});
