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
	if (!data) return;
	const response = handleWorkerMessage(data);
	self.postMessage(response);
};
