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
});
