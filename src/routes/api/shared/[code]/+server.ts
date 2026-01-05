/**
 * GET /api/shared/[code] - Retrieve a shared configuration (public)
 *
 * No authentication required. Returns the shared configuration data.
 * Increments view count and checks for expiration.
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db, sharedConfigurations } from '$lib/server/db';
import { eq, sql } from 'drizzle-orm';
import { HTTP_STATUS } from '$lib/constants';
import { isShareExpired, getDaysUntilExpiration } from '$lib/server/share-utils';

export const GET: RequestHandler = async ({ params }) => {
	const { code } = params;

	if (!code || code.length !== 8) {
		throw error(HTTP_STATUS.BAD_REQUEST, 'Invalid share code');
	}

	// Fetch the shared configuration
	const [share] = await db
		.select({
			id: sharedConfigurations.id,
			shortCode: sharedConfigurations.shortCode,
			username: sharedConfigurations.username,
			mapType: sharedConfigurations.mapType,
			parameters: sharedConfigurations.parameters,
			viewCount: sharedConfigurations.viewCount,
			createdAt: sharedConfigurations.createdAt,
			expiresAt: sharedConfigurations.expiresAt
		})
		.from(sharedConfigurations)
		.where(eq(sharedConfigurations.shortCode, code))
		.limit(1);

	if (!share) {
		throw error(HTTP_STATUS.NOT_FOUND, 'Shared configuration not found');
	}

	// Check if expired
	if (isShareExpired(share.expiresAt)) {
		// Optionally delete expired share (lazy cleanup)
		await db.delete(sharedConfigurations).where(eq(sharedConfigurations.id, share.id));
		throw error(HTTP_STATUS.GONE, 'This shared configuration has expired');
	}

	// Increment view count (fire and forget)
	db.update(sharedConfigurations)
		.set({ viewCount: sql`${sharedConfigurations.viewCount} + 1` })
		.where(eq(sharedConfigurations.id, share.id))
		.then(() => {})
		.catch((err) => console.error('Failed to increment view count:', err));

	const daysRemaining = getDaysUntilExpiration(share.expiresAt);

	return json({
		shortCode: share.shortCode,
		username: share.username ?? 'Anonymous',
		mapType: share.mapType,
		parameters: share.parameters,
		viewCount: share.viewCount + 1, // Include the current view
		createdAt: share.createdAt,
		expiresAt: share.expiresAt,
		daysRemaining
	});
};
