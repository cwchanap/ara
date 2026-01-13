/**
 * POST /api/share - Create a shareable configuration link
 *
 * Requires authentication. Creates a public short URL for a chaos map configuration.
 * Rate limited to 10 shares per user per hour.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { base } from '$app/paths';
import { validateParameters } from '$lib/chaos-validation';
import { VALID_MAP_TYPES } from '$lib/types';
import type { ChaosMapType, ChaosMapParameters } from '$lib/types';
import { SHARE_EXPIRATION_DAYS, HTTP_STATUS } from '$lib/constants';
import {
	generateShortCode,
	createShareWithRateLimit,
	calculateExpirationDate
} from '$lib/server/share-utils';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	// Require authentication
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		throw error(HTTP_STATUS.UNAUTHORIZED, 'Please log in to share configurations');
	}

	// Parse request body
	let body: { mapType?: unknown; parameters?: unknown };
	try {
		body = await request.json();
	} catch {
		throw error(HTTP_STATUS.BAD_REQUEST, 'Invalid JSON body');
	}

	const { mapType, parameters } = body;

	// Validate mapType
	if (typeof mapType !== 'string' || !VALID_MAP_TYPES.includes(mapType as ChaosMapType)) {
		throw error(HTTP_STATUS.BAD_REQUEST, 'Invalid map type');
	}

	// Validate parameters
	if (!parameters || Array.isArray(parameters) || typeof parameters !== 'object') {
		throw error(HTTP_STATUS.BAD_REQUEST, 'Parameters are required');
	}

	const validation = validateParameters(mapType as ChaosMapType, parameters);
	if (!validation.isValid) {
		throw error(HTTP_STATUS.BAD_REQUEST, `Invalid parameters: ${validation.errors.join(', ')}`);
	}

	// Generate short code (collisions will be handled by createShareWithRateLimit)
	const shortCode = generateShortCode();

	// Calculate expiration
	const expiresAt = calculateExpirationDate(SHARE_EXPIRATION_DAYS).toISOString();

	// Perform rate limit check and share creation atomically in a single transaction
	const result = await createShareWithRateLimit(
		user.id,
		mapType as ChaosMapType,
		parameters as ChaosMapParameters,
		shortCode,
		expiresAt
	);

	if (!result.success) {
		throw error(
			HTTP_STATUS.TOO_MANY_REQUESTS,
			result.error ?? 'Too many requests. Please try again later.'
		);
	}

	// Build the share URL (include base path for non-root deployments)
	const shareUrl = `${url.origin}${base}/s/${result.share!.shortCode}`;

	return json(
		{
			success: true,
			shortCode: result.share!.shortCode,
			shareUrl,
			expiresAt: result.share!.expiresAt,
			remaining: result.remaining
		},
		{ status: HTTP_STATUS.CREATED }
	);
};
