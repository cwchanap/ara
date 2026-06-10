import { describe, expect, test } from 'vitest';
import { handleWorkerMessage } from './workers/chaosMapsHandler';
import type { IkedaRequest, ChaosMapsWorkerResponse } from './workers/types';

describe('ikeda worker contract', () => {
	test('produces an ikedaResult with matching id and parallel arrays', () => {
		const req: IkedaRequest = {
			type: 'ikeda',
			id: 7,
			u: 0.918,
			iterations: 100,
			burnIn: 20,
			seeds: 30,
			maxPoints: 200000
		};
		const res = handleWorkerMessage(req) as ChaosMapsWorkerResponse & {
			type: 'ikedaResult';
			points: [number, number][];
			seedIndices: number[];
		};
		expect(res.type).toBe('ikedaResult');
		expect(res.id).toBe(7);
		expect(res.seedIndices).toHaveLength(res.points.length);
	});

	test('honors maxPoints by capping the response point count', () => {
		const req: IkedaRequest = {
			type: 'ikeda',
			id: 8,
			u: 0.918,
			iterations: 200,
			burnIn: 10,
			seeds: 100,
			maxPoints: 100
		};
		const res = handleWorkerMessage(req) as ChaosMapsWorkerResponse & {
			type: 'ikedaResult';
			points: [number, number][];
			seedIndices: number[];
		};
		expect(res.points).toHaveLength(100);
		expect(res.seedIndices).toHaveLength(100);
	});
});
