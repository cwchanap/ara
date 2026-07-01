export function f(x: number, a: number): number {
	return a * x + (2 * (1 - a) * x * x) / (1 + x * x);
}

export function calculateChaos(
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
		if (!Number.isFinite(xNew) || !Number.isFinite(yNew)) break;
		points.push([xNew, yNew]);
		x = xNew;
		y = yNew;
	}
	return points;
}
