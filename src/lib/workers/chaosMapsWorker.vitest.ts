import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
	Object.defineProperty(globalThis, 'self', {
		value: originalSelf,
		configurable: true,
		writable: true
	});
});

describe('chaosMapsWorker', () => {
	it('handles standard map messages', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'standard',
				id: 1,
				numP: 1,
				numQ: 1,
				iterations: 2,
				k: 0.5,
				maxPoints: 100
			}
		});
		expect(responses).toHaveLength(1);
		expect(responses[0].type).toBe('standardResult');
		expect(responses[0].id).toBe(1);
	});

	it('returns correct standard map response structure', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'standard',
				id: 42,
				numP: 2,
				numQ: 2,
				iterations: 3,
				k: 1.0,
				maxPoints: 50
			}
		});
		expect(responses[0]).toMatchObject({ type: 'standardResult', id: 42 });
		expect(Array.isArray((responses[0] as { points?: unknown }).points)).toBe(true);
	});

	it('handles chaos map messages', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'chaos',
				id: 2,
				a: 1.5,
				b: 0.5,
				x0: 0,
				y0: 0,
				iterations: 10,
				maxPoints: 100
			}
		});
		expect(responses).toHaveLength(1);
		expect(responses[0].type).toBe('chaosResult');
		expect(responses[0].id).toBe(2);
	});

	it('returns correct chaos map response structure', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'chaos',
				id: 7,
				a: 1.7,
				b: 0.3,
				x0: 0.1,
				y0: 0.2,
				iterations: 5,
				maxPoints: 10
			}
		});
		expect(responses[0]).toMatchObject({ type: 'chaosResult', id: 7 });
		expect(Array.isArray((responses[0] as { points?: unknown }).points)).toBe(true);
	});

	it('respects maxPoints limit for standard map', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'standard',
				id: 3,
				numP: 10,
				numQ: 10,
				iterations: 100,
				k: 1.0,
				maxPoints: 5
			}
		});
		const points = (responses[0] as { points?: [number, number][] }).points ?? [];
		expect(points.length).toBeLessThanOrEqual(5);
	});

	it('respects maxPoints limit for chaos map', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'chaos',
				id: 4,
				a: 1.5,
				b: 0.5,
				x0: 0,
				y0: 0,
				iterations: 100,
				maxPoints: 5
			}
		});
		const points = (responses[0] as { points?: [number, number][] }).points ?? [];
		expect(points.length).toBeLessThanOrEqual(5);
	});

	it('returns empty points for zero numP in standard map', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'standard',
				id: 5,
				numP: 0,
				numQ: 5,
				iterations: 10,
				k: 1.0,
				maxPoints: 100
			}
		});
		const points = (responses[0] as { points?: [number, number][] }).points ?? [];
		expect(points).toHaveLength(0);
	});

	it('handles null data without crashing', () => {
		responses.length = 0;
		selfMock.onmessage?.({ data: null });
		expect(responses).toHaveLength(0);
	});

	it('produces finite coordinate values for standard map', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'standard',
				id: 6,
				numP: 3,
				numQ: 3,
				iterations: 5,
				k: 0.9,
				maxPoints: 50
			}
		});
		const points = (responses[0] as { points?: [number, number][] }).points ?? [];
		for (const [x, y] of points) {
			expect(Number.isFinite(x)).toBe(true);
			expect(Number.isFinite(y)).toBe(true);
		}
	});

	it('produces finite coordinate values for chaos map', () => {
		responses.length = 0;
		selfMock.onmessage?.({
			data: {
				type: 'chaos',
				id: 8,
				a: 1.5,
				b: 0.5,
				x0: 0,
				y0: 0,
				iterations: 20,
				maxPoints: 20
			}
		});
		const points = (responses[0] as { points?: [number, number][] }).points ?? [];
		for (const [x, y] of points) {
			expect(Number.isFinite(x)).toBe(true);
			expect(Number.isFinite(y)).toBe(true);
		}
	});
});
