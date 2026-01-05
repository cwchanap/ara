/**
 * POST /api/share - Create a shareable configuration link
 *
 * Requires authentication. Creates a public short URL for a chaos map configuration.
 * Rate limited to 10 shares per user per hour.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, sharedConfigurations, profiles } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { validateParameters } from '$lib/chaos-validation';
import { VALID_MAP_TYPES } from '$lib/types';
import type { ChaosMapType, ChaosMapParameters } from '$lib/types';
import { SHARE_EXPIRATION_DAYS, HTTP_STATUS } from '$lib/constants';
import {
	generateUniqueShortCode,
	checkShareRateLimit,
	calculateExpirationDate
} from '$lib/server/share-utils';

export const POST: RequestHandler = async ({ request, locals, url }) => {
	// Require authentication
	const { session, user } = await locals.safeGetSession();
	if (!session || !user) {
		throw error(HTTP_STATUS.UNAUTHORIZED, 'Please log in to share configurations');
	}

	// Check rate limit
	const rateLimit = await checkShareRateLimit(user.id);
	if (rateLimit.isLimited) {
		throw error(
			HTTP_STATUS.TOO_MANY_REQUESTS,
			`Rate limit exceeded. You can create ${rateLimit.remaining} more shares. Limit resets in about 1 hour.`
		);
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
	if (!parameters || typeof parameters !== 'object') {
		throw error(HTTP_STATUS.BAD_REQUEST, 'Parameters are required');
	}

	const validation = validateParameters(mapType as ChaosMapType, parameters);
	if (!validation.isValid) {
		throw error(HTTP_STATUS.BAD_REQUEST, `Invalid parameters: ${validation.errors.join(', ')}`);
	}

	// Get user's username for attribution
	const [profile] = await db
		.select({ username: profiles.username })
		.from(profiles)
		.where(eq(profiles.id, user.id))
		.limit(1);

	const username = profile?.username ?? 'Anonymous';

	// Generate unique short code
	const shortCode = await generateUniqueShortCode();
	if (!shortCode) {
		throw error(
			HTTP_STATUS.INTERNAL_SERVER_ERROR,
			'Failed to generate share link. Please try again.'
		);
	}

	// Calculate expiration
	const expiresAt = calculateExpirationDate(SHARE_EXPIRATION_DAYS);

	// Insert shared configuration
	try {
		const [newShare] = await db
			.insert(sharedConfigurations)
			.values({
				shortCode,
				userId: user.id,
				username,
				mapType: mapType as ChaosMapType,
				parameters: parameters as ChaosMapParameters,
				expiresAt: expiresAt.toISOString()
			})
			.returning({
				id: sharedConfigurations.id,
				shortCode: sharedConfigurations.shortCode,
				expiresAt: sharedConfigurations.expiresAt
			});

		// Build the share URL
		const shareUrl = `${url.origin}/s/${newShare.shortCode}`;

		return json(
			{
				success: true,
				shortCode: newShare.shortCode,
				shareUrl,
				expiresAt: newShare.expiresAt,
				remaining: rateLimit.remaining - 1
			},
			{ status: HTTP_STATUS.CREATED }
		);
	} catch (err) {
		console.error('Failed to create shared configuration:', err);
		throw error(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to create share link');
	}
};
