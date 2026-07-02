/**
 * Standard map (Chirikov) point generation.
 *
 * Shared by the web worker handler (`chaosMapsHandler`) and the main-thread
 * fallback in `StandardRenderer.svelte` so both paths use identical logic.
 */
export function standardMap(
	numP: number,
	numQ: number,
	iterations: number,
	k: number,
	maxPoints: number
): [number, number][] {
	if (numP <= 0 || numQ <= 0 || iterations <= 0 || maxPoints <= 0) return [];

	const points: [number, number][] = [];
	const TWO_PI = 2 * Math.PI;
	const normalizeAngle = (value: number) => ((value % TWO_PI) + TWO_PI) % TWO_PI;

	outer: for (let i = 1; i <= numP; i++) {
		for (let j = 1; j <= numQ; j++) {
			let p = normalizeAngle(((i - 1) / numP) * TWO_PI);
			let q = normalizeAngle(((j - 1) / numQ) * TWO_PI);

			for (let iter = 0; iter < iterations; iter++) {
				const pNew = normalizeAngle(p + k * Math.sin(q));
				const qNew = normalizeAngle(q + pNew);

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
