import { describe, expect, test } from 'vitest';
import { calculateIkedaMultiSeed } from './ikeda';
import type { IkedaRequest, IkedaResponse } from './workers/types';

// Mirrors exactly what the worker does for an 'ikeda' message, validating the
// request/response contract the worker implements.
function handleIkedaRequest(req: IkedaRequest): IkedaResponse {
	const { points, seedIndices } = calculateIkedaMultiSeed({
		u: req.u,
		iterations: req.iterations,
		burnIn: req.burnIn,
		seeds: req.seeds,
		maxPoints: req.maxPoints
	});
	return { type: 'ikedaResult', id: req.id, points, seedIndices };
}

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
		const res = handleIkedaRequest(req);
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
		const res = handleIkedaRequest(req);
		expect(res.points).toHaveLength(100);
		expect(res.seedIndices).toHaveLength(100);
	});
});
