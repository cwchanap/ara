import { validateParameters } from '$lib/chaos-validation';
import type { ChaosMapParameters, ChaosMapType } from '$lib/types';

type ParametersFor<T extends ChaosMapType> = Extract<ChaosMapParameters, { type: T }>;

const MAX_DECODED_CONFIG_PARAM_LENGTH = 50 * 1024;
const MAX_JSON_NESTING_DEPTH = 20;
const MAX_LOG_MESSAGE_LENGTH = 2000;

function truncateForLog(value: string, maxLength: number) {
	if (value.length <= maxLength) return value;
	return `${value.slice(0, maxLength)}...`;
}

function normalizeErrorForLog(err: unknown) {
	if (err instanceof Error) {
		return {
			name: err.name,
			message: truncateForLog(err.message, MAX_LOG_MESSAGE_LENGTH)
		};
	}
	return {
		error: truncateForLog(String(err), MAX_LOG_MESSAGE_LENGTH)
	};
}

function getMaxJsonNestingDepth(text: string) {
	let depth = 0;
	let maxDepth = 0;
	let inString = false;
	let escaped = false;

	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (inString) {
			if (escaped) {
				escaped = false;
				continue;
			}
			if (ch === '\\') {
				escaped = true;
				continue;
			}
			if (ch === '"') {
				inString = false;
			}
			continue;
		}

		if (ch === '"') {
			inString = true;
			continue;
		}
		if (ch === '{' || ch === '[') {
			depth++;
			if (depth > maxDepth) maxDepth = depth;
			continue;
		}
		if (ch === '}' || ch === ']') {
			depth--;
			if (depth < 0) return { ok: false as const, maxDepth };
		}
	}

	return { ok: true as const, maxDepth };
}

export type LoadSavedConfigResult<T extends ChaosMapType> =
	| {
			ok: true;
			parameters: ParametersFor<T>;
			source: 'api' | 'sessionStorage' | 'sharedApi';
	  }
	| {
			ok: false;
			error: string;
			errors: string[];
			validationErrors?: string[];
	  };

export type ParseConfigParamResult<T extends ChaosMapType> =
	| {
			ok: true;
			parameters: ParametersFor<T>;
	  }
	| {
			ok: false;
			error: string;
			errors: string[];
			logMessage: string;
			logDetails: unknown;
			validationErrors?: string[];
	  };

export function parseConfigParam<T extends ChaosMapType>(args: {
	mapType: T;
	configParam: string;
}): ParseConfigParamResult<T> {
	let decoded: string;
	try {
		decoded = decodeURIComponent(args.configParam);
	} catch (e) {
		return {
			ok: false,
			error: 'Failed to parse configuration parameters',
			errors: ['Failed to parse configuration parameters'],
			logMessage: 'Invalid config parameter:',
			logDetails: normalizeErrorForLog(e)
		};
	}

	if (decoded.length > MAX_DECODED_CONFIG_PARAM_LENGTH) {
		return {
			ok: false,
			error: 'Configuration parameter too large',
			errors: [
				`Configuration parameter too large (max ${MAX_DECODED_CONFIG_PARAM_LENGTH} chars)`
			],
			logMessage: 'Config parameter too large:',
			logDetails: {
				decodedLength: decoded.length,
				maxDecodedLength: MAX_DECODED_CONFIG_PARAM_LENGTH
			}
		};
	}

	const depthCheck = getMaxJsonNestingDepth(decoded);
	if (!depthCheck.ok || depthCheck.maxDepth > MAX_JSON_NESTING_DEPTH) {
		return {
			ok: false,
			error: 'Configuration parameter too deeply nested',
			errors: [
				`Configuration parameter too deeply nested (max depth ${MAX_JSON_NESTING_DEPTH})`
			],
			logMessage: 'Config parameter too deeply nested:',
			logDetails: {
				maxDepth: depthCheck.maxDepth,
				maxAllowedDepth: MAX_JSON_NESTING_DEPTH
			}
		};
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(decoded);
	} catch (e) {
		return {
			ok: false,
			error: 'Failed to parse configuration parameters',
			errors: ['Failed to parse configuration parameters'],
			logMessage: 'Invalid config parameter:',
			logDetails: normalizeErrorForLog(e)
		};
	}

	const validation = validateParameters(args.mapType, parsed);
	if (!validation.isValid) {
		return {
			ok: false,
			error: 'Invalid parameters structure',
			errors: validation.errors,
			logMessage: 'Invalid parameters structure:',
			logDetails: validation.errors,
			validationErrors: validation.errors
		};
	}

	// Use normalized parameters if available (e.g., 'K' -> 'k' for Standard map)
	const parametersToUse = validation.parameters ?? parsed;
	return { ok: true, parameters: parametersToUse as ParametersFor<T> };
}

export async function loadSavedConfigParameters<T extends ChaosMapType>(args: {
	configId: string;
	mapType: T;
	base: string;
	fetchFn: typeof fetch;
}): Promise<LoadSavedConfigResult<T>> {
	let candidateParams: unknown | null = null;
	let candidateSource: 'api' | 'sessionStorage' | null = null;
	let sessionStorageKeyToClear: string | null = null;

	try {
		const response = await args.fetchFn(
			`${args.base}/api/saved-config/${encodeURIComponent(args.configId)}`
		);
		if (response.ok) {
			const data = (await response.json().catch(() => null)) as {
				mapType?: string;
				parameters?: unknown;
			} | null;
			if (data?.mapType === args.mapType) {
				candidateParams = data.parameters ?? null;
				candidateSource = 'api';
			}
		}
	} catch (e) {
		void e;
	}

	if (!candidateParams) {
		const storageKey = `saved-config:${args.configId}`;
		try {
			if (typeof sessionStorage !== 'undefined') {
				const raw = sessionStorage.getItem(storageKey);
				if (raw) {
					candidateParams = JSON.parse(raw);
					candidateSource = 'sessionStorage';
					sessionStorageKeyToClear = storageKey;
				}
			}
		} catch (e) {
			void e;
		}
	}

	if (!candidateParams || !candidateSource) {
		return {
			ok: false,
			error: 'Failed to load configuration parameters',
			errors: ['Failed to load configuration parameters']
		};
	}

	const clearSessionStorageCandidate = () => {
		if (candidateSource === 'sessionStorage' && sessionStorageKeyToClear) {
			try {
				if (typeof sessionStorage !== 'undefined') {
					sessionStorage.removeItem(sessionStorageKeyToClear);
				}
			} catch (e) {
				void e;
			}
		}
	};

	const validation = validateParameters(args.mapType, candidateParams);
	if (!validation.isValid) {
		clearSessionStorageCandidate();
		return {
			ok: false,
			error: 'Invalid parameters structure',
			errors: validation.errors,
			validationErrors: validation.errors
		};
	}

	// Use normalized parameters if available (e.g., 'K' -> 'k' for Standard map)
	const parametersToUse = validation.parameters ?? candidateParams;
	clearSessionStorageCandidate();

	return {
		ok: true,
		parameters: parametersToUse as ParametersFor<T>,
		source: candidateSource
	};
}

/**
 * Load shared configuration parameters from the API using a short code.
 */
export async function loadSharedConfigParameters<T extends ChaosMapType>(args: {
	shareCode: string;
	mapType: T;
	base: string;
	fetchFn: typeof fetch;
}): Promise<LoadSavedConfigResult<T>> {
	try {
		const response = await args.fetchFn(
			`${args.base}/api/shared/${encodeURIComponent(args.shareCode)}`
		);
		if (!response.ok) {
			if (response.status === 410) {
				return {
					ok: false,
					error: 'This shared configuration has expired',
					errors: ['This shared configuration has expired']
				};
			}
			return {
				ok: false,
				error: `Failed to load shared configuration (${response.status})`,
				errors: [`Failed to load shared configuration (${response.status})`]
			};
		}

		const data = (await response.json().catch(() => null)) as {
			mapType?: string;
			parameters?: unknown;
		} | null;

		if (!data || data.mapType !== args.mapType || !data.parameters) {
			return {
				ok: false,
				error: 'Invalid shared configuration data',
				errors: ['Invalid shared configuration data']
			};
		}

		const validation = validateParameters(args.mapType, data.parameters);
		if (!validation.isValid) {
			return {
				ok: false,
				error: 'Invalid parameters structure',
				errors: validation.errors,
				validationErrors: validation.errors
			};
		}

		// Use normalized parameters if available (e.g., 'K' -> 'k' for Standard map)
		const parametersToUse = validation.parameters ?? data.parameters;
		return {
			ok: true,
			parameters: parametersToUse as ParametersFor<T>,
			source: 'sharedApi'
		};
	} catch (e) {
		console.error('Error loading shared config:', e);
		return {
			ok: false,
			error: 'Failed to load shared configuration (network error)',
			errors: ['Failed to load shared configuration (network error)']
		};
	}
}
