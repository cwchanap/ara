/**
 * Public Share Viewer - Server Load
 *
 * Loads shared configuration data for the public viewer page.
 * No authentication required.
 */

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db, sharedConfigurations, profiles } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { HTTP_STATUS } from '$lib/constants';
import {
	isShareExpired,
	getDaysUntilExpiration,
	incrementViewCount
} from '$lib/server/share-utils';
import type { ChaosMapType, ChaosMapParameters } from '$lib/types';
import { VALID_MAP_TYPES } from '$lib/types';

export const load: PageServerLoad = async ({ params }) => {
	const { code } = params;

	if (!code || code.length !== 8) {
		throw error(HTTP_STATUS.BAD_REQUEST, 'Invalid share code');
	}

	// Fetch the shared configuration with profile data
	const [share] = await db
		.select({
			id: sharedConfigurations.id,
			shortCode: sharedConfigurations.shortCode,
			username: profiles.username,
			mapType: sharedConfigurations.mapType,
			parameters: sharedConfigurations.parameters,
			viewCount: sharedConfigurations.viewCount,
			createdAt: sharedConfigurations.createdAt,
			expiresAt: sharedConfigurations.expiresAt
		})
		.from(sharedConfigurations)
		.leftJoin(profiles, eq(sharedConfigurations.userId, profiles.id))
		.where(eq(sharedConfigurations.shortCode, code))
		.limit(1);

	if (!share) {
		throw error(HTTP_STATUS.NOT_FOUND, 'Shared configuration not found');
	}

	// Check if expired
	if (isShareExpired(share.expiresAt)) {
		// Delete expired share (lazy cleanup)
		try {
			await db.delete(sharedConfigurations).where(eq(sharedConfigurations.id, share.id));
		} catch (err) {
			console.error('Failed to delete expired share:', err);
		}
		throw error(HTTP_STATUS.GONE, 'This shared configuration has expired');
	}

	// Validate map type
	if (!VALID_MAP_TYPES.includes(share.mapType as ChaosMapType)) {
		throw error(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Invalid configuration data');
	}

	// Increment view count (best-effort, don't block page load on failure)
	try {
		await incrementViewCount(share.id);
	} catch (err) {
		console.error('Failed to increment view count:', err);
	}

	const daysRemaining = getDaysUntilExpiration(share.expiresAt);

	return {
		shortCode: share.shortCode,
		username: share.username ?? 'Anonymous',
		mapType: share.mapType as ChaosMapType,
		parameters: share.parameters as ChaosMapParameters,
		viewCount: share.viewCount + 1,
		createdAt: share.createdAt,
		expiresAt: share.expiresAt,
		daysRemaining
	};
};
