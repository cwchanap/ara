/**
 * Chaos Maps Web Worker
 *
 * Thin adapter: delegates all computation to chaosMapsHandler.ts.
 * This file exists only to wire self.onmessage → handleWorkerMessage.
 */

import type { ChaosMapsWorkerRequest } from './types';
import { handleWorkerMessage } from './chaosMapsHandler';

// Worker self typing is provided by TypeScript's webworker lib
// The global 'self' is already typed as WorkerGlobalScope

self.onmessage = (event: MessageEvent<ChaosMapsWorkerRequest>) => {
	const data = event.data;
	if (!data) {
		self.postMessage({ type: 'error', id: -1, message: 'Empty worker payload' });
		return;
	}
	// Wrap dispatch + postMessage so a thrown handler or a structured-clone
	// failure becomes a typed ErrorResponse on the main thread (where the
	// renderer already routes it through its existing error branch) instead
	// of an uncaught worker error whose ErrorEvent.message is typically
	// empty/"Script error." and useless for debugging.
	try {
		const response = handleWorkerMessage(data);
		self.postMessage(response);
	} catch (err) {
		const id = typeof data.id === 'number' ? data.id : -1;
		const message = err instanceof Error ? err.message : String(err);
		self.postMessage({ type: 'error', id, message });
	}
};
