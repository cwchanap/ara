export interface HenonCalcParams {
	a: number;
	b: number;
	iterations: number;
}

export function calculateHenonTuples({ a, b, iterations }: HenonCalcParams): [number, number][] {
	const points: [number, number][] = [];
	let x = 0,
		y = 0;
	for (let i = 0; i < iterations; i++) {
		const xNew = y + 1 - a * x * x;
		const yNew = b * x;
		if (!Number.isFinite(xNew) || !Number.isFinite(yNew)) break;
		if (Math.abs(xNew) > 1e6 || Math.abs(yNew) > 1e6) break;
		points.push([xNew, yNew]);
		x = xNew;
		y = yNew;
	}
	return points;
}
