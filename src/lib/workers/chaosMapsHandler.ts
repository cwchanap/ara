/**
 * Chaos maps message handler — pure function that processes worker requests.
 * Extracted from chaosMapsWorker.ts for testability in Node environments.
 */

import type { ChaosMapsWorkerRequest, ChaosMapsWorkerResponse, ErrorResponse } from './types';
import { calculateIkedaMultiSeed } from '../ikeda';
import { calculateCliffordTuples } from '../clifford';
import { calculateGumowskiMiraMultiSeed } from '../gumowski-mira';
import { calculateChaos } from '../chaos-esthetique';
import { standardMap } from '../standard';

/**
 * Process a single worker request and return the response.
 * The worker's onmessage handler delegates here.
 */
export function handleWorkerMessage(data: ChaosMapsWorkerRequest): ChaosMapsWorkerResponse {
	if (data.type === 'standard') {
		const points = standardMap(data.numP, data.numQ, data.iterations, data.k, data.maxPoints);
		return { type: 'standardResult', id: data.id, points };
	} else if (data.type === 'chaos') {
		const points = calculateChaos(
			data.a,
			data.b,
			data.x0,
			data.y0,
			data.iterations,
			data.maxPoints
		);
		return { type: 'chaosResult', id: data.id, points };
	} else if (data.type === 'ikeda') {
		const { points, seedIndices } = calculateIkedaMultiSeed({
			u: data.u,
			iterations: data.iterations,
			burnIn: data.burnIn,
			seeds: data.seeds,
			maxPoints: data.maxPoints
		});
		return { type: 'ikedaResult', id: data.id, points, seedIndices };
	} else if (data.type === 'clifford') {
		const points = calculateCliffordTuples({
			a: data.a,
			b: data.b,
			c: data.c,
			d: data.d,
			iterations: data.iterations,
			maxPoints: data.maxPoints
		});
		return { type: 'cliffordResult', id: data.id, points };
	} else if (data.type === 'gumowskiMira') {
		const { points, seedIndices } = calculateGumowskiMiraMultiSeed({
			mu: data.mu,
			a: data.a,
			b: data.b,
			iterations: data.iterations,
			burnIn: data.burnIn,
			seeds: data.seeds,
			maxPoints: data.maxPoints
		});
		return { type: 'gumowskiMiraResult', id: data.id, points, seedIndices };
	} else {
		const fallback = data as Record<string, unknown>;
		return {
			type: 'error',
			id: typeof fallback.id === 'number' ? fallback.id : -1,
			message: `Unknown message type: ${String(fallback.type ?? 'undefined')}`
		} satisfies ErrorResponse;
	}
}
