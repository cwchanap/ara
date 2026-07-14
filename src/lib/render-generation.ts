/**
 * Latest-wins cancellation utility. Each render request calls `next()`
 * to get a monotonically increasing ID. Before applying an async result
 * (worker response, rAF chunk), check `isStale(id)` — if true, discard.
 *
 * Formalizes the existing `latestWorkerRequestId` pattern used by
 * GumowskiMira, Standard, Ikeda, Clifford, Tinkerbell, and ChaosEsthetique
 * renderers.
 */
export class RenderGeneration {
	private current = 0;

	next(): number {
		return ++this.current;
	}

	isStale(id: number): boolean {
		return id !== this.current;
	}
}
