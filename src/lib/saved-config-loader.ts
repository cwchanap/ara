import { validateParameters } from '$lib/chaos-validation';
import type { ChaosMapParameters, ChaosMapType } from '$lib/types';

type ParametersFor<T extends ChaosMapType> = Extract<ChaosMapParameters, { type: T }>;

export type LoadSavedConfigResult<T extends ChaosMapType> =
	| {
			ok: true;
			parameters: ParametersFor<T>;
			source: 'api' | 'sessionStorage';
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
	let parsed: unknown;
	try {
		parsed = JSON.parse(decodeURIComponent(args.configParam));
	} catch (e) {
		void e;
		return {
			ok: false,
			error: 'Failed to parse configuration parameters',
			errors: ['Failed to parse configuration parameters'],
			logMessage: 'Invalid config parameter:',
			logDetails: e
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

	return { ok: true, parameters: parsed as ParametersFor<T> };
}

export async function loadSavedConfigParameters<T extends ChaosMapType>(args: {
	configId: string;
	mapType: T;
	base: string;
	fetchFn: typeof fetch;
}): Promise<LoadSavedConfigResult<T>> {
	let loadedParams: unknown | null = null;
	let source: 'api' | 'sessionStorage' | null = null;

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
				loadedParams = data.parameters ?? null;
				source = 'api';
			}
		}
	} catch (e) {
		void e;
	}

	if (!loadedParams) {
		const storageKey = `saved-config:${args.configId}`;
		try {
			if (typeof sessionStorage !== 'undefined') {
				const raw = sessionStorage.getItem(storageKey);
				if (raw) {
					loadedParams = JSON.parse(raw);
					sessionStorage.removeItem(storageKey);
					source = 'sessionStorage';
				}
			}
		} catch (e) {
			void e;
		}
	}

	if (!loadedParams || !source) {
		return {
			ok: false,
			error: 'Failed to load configuration parameters',
			errors: ['Failed to load configuration parameters']
		};
	}

	const validation = validateParameters(args.mapType, loadedParams);
	if (!validation.isValid) {
		return {
			ok: false,
			error: 'Invalid parameters structure',
			errors: validation.errors,
			validationErrors: validation.errors
		};
	}

	return {
		ok: true,
		parameters: loadedParams as ParametersFor<T>,
		source
	};
}
