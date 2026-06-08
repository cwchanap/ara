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
		seeds: req.seeds
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
			seeds: 30
		};
		const res = handleIkedaRequest(req);
		expect(res.type).toBe('ikedaResult');
		expect(res.id).toBe(7);
		expect(res.seedIndices).toHaveLength(res.points.length);
	});
});
