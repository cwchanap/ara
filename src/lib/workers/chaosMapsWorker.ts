import type { ChaosMapsWorkerRequest, ChaosMapsWorkerResponse } from './types';

function standardMap(
	numP: number,
	numQ: number,
	iterations: number,
	k: number,
	maxPoints: number
): [number, number][] {
	const points: [number, number][] = [];

	outer: for (let i = 1; i <= numP; i++) {
		for (let j = 1; j <= numQ; j++) {
			let p = (i / numP) % (2 * Math.PI);
			let q = (j / numQ) % (2 * Math.PI);

			for (let k = 0; k < iterations; k++) {
				const pNew = (p + k * Math.sin(q)) % (2 * Math.PI);
				const qNew = (q + pNew) % (2 * Math.PI);

				points.push([qNew, pNew]);

				p = pNew;
				q = qNew;

				if (points.length >= maxPoints) {
					break outer;
				}
			}
		}
	}

	return points;
}

function f(x: number, a: number): number {
	return a * x + (2 * (1 - a) * x * x) / (1 + x * x);
}

function calculateChaos(
	a: number,
	b: number,
	x0: number,
	y0: number,
	iterations: number,
	maxPoints: number
): [number, number][] {
	const points: [number, number][] = [];
	let x = x0;
	let y = y0;

	const steps = Math.min(iterations, maxPoints);
	for (let i = 0; i < steps; i++) {
		const xNew = y + f(x, a);
		const yNew = -b * x + f(xNew, a);

		points.push([xNew, yNew]);

		x = xNew;
		y = yNew;
	}

	return points;
}

// Worker self typing is provided by TypeScript's webworker lib
// The global 'self' is already typed as WorkerGlobalScope

self.onmessage = (event: MessageEvent<ChaosMapsWorkerRequest>) => {
	const data = event.data;
	if (!data) return;

	if (data.type === 'standard') {
		const points = standardMap(data.numP, data.numQ, data.iterations, data.k, data.maxPoints);
		const response: ChaosMapsWorkerResponse = {
			type: 'standardResult',
			id: data.id,
			points
		};
		self.postMessage(response);
	} else if (data.type === 'chaos') {
		const points = calculateChaos(
			data.a,
			data.b,
			data.x0,
			data.y0,
			data.iterations,
			data.maxPoints
		);
		const response: ChaosMapsWorkerResponse = {
			type: 'chaosResult',
			id: data.id,
			points
		};
		self.postMessage(response);
	}
};
