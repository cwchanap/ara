import type {
	ChaosMapParameters,
	LorenzParameters,
	HenonParameters,
	RosslerParameters,
	LogisticParameters,
	LoziParameters,
	NewtonParameters,
	StandardParameters,
	BifurcationLogisticParameters,
	BifurcationHenonParameters,
	ChaosEsthetiqueParameters,
	LyapunovParameters
} from '$lib/types';

/**
 * Type guard for Lorenz parameters.
 */
export function isLorenzParameters(params: ChaosMapParameters): params is LorenzParameters {
	return params.type === 'lorenz';
}

/**
 * Type guard for Henon parameters.
 */
export function isHenonParameters(params: ChaosMapParameters): params is HenonParameters {
	return params.type === 'henon';
}

/**
 * Type guard for Rossler parameters.
 */
export function isRosslerParameters(params: ChaosMapParameters): params is RosslerParameters {
	return params.type === 'rossler';
}

/**
 * Type guard for Logistic parameters.
 */
export function isLogisticParameters(params: ChaosMapParameters): params is LogisticParameters {
	return params.type === 'logistic';
}

/**
 * Type guard for Lozi parameters.
 */
export function isLoziParameters(params: ChaosMapParameters): params is LoziParameters {
	return params.type === 'lozi';
}

/**
 * Type guard for Newton parameters.
 */
export function isNewtonParameters(params: ChaosMapParameters): params is NewtonParameters {
	return params.type === 'newton';
}

/**
 * Type guard for Standard parameters.
 */
export function isStandardParameters(params: ChaosMapParameters): params is StandardParameters {
	return params.type === 'standard';
}

/**
 * Type guard for Bifurcation Logistic parameters.
 */
export function isBifurcationLogisticParameters(
	params: ChaosMapParameters
): params is BifurcationLogisticParameters {
	return params.type === 'bifurcation-logistic';
}

/**
 * Type guard for Bifurcation Henon parameters.
 */
export function isBifurcationHenonParameters(
	params: ChaosMapParameters
): params is BifurcationHenonParameters {
	return params.type === 'bifurcation-henon';
}

/**
 * Type guard for Chaos Esthetique parameters.
 */
export function isChaosEsthetiqueParameters(
	params: ChaosMapParameters
): params is ChaosEsthetiqueParameters {
	return params.type === 'chaos-esthetique';
}

/**
 * Type guard for Lyapunov parameters.
 */
export function isLyapunovParameters(params: ChaosMapParameters): params is LyapunovParameters {
	return params.type === 'lyapunov';
}

/**
 * Generic type guard that works with any chaos map type.
 *
 * @example
 * const params = initialState?.left;
 * if (params && isParametersOfType(params, 'lorenz')) {
 *   // params is now typed as LorenzParameters
 *   leftSigma = params.sigma;
 * }
 */
export function isParametersOfType<T extends ChaosMapParameters['type']>(
	params: ChaosMapParameters,
	type: T
): params is Extract<ChaosMapParameters, { type: T }> {
	return params.type === type;
}
