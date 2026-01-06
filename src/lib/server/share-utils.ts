/**
 * Share Utility Functions
 *
 * Server-side utilities for the shareable configuration URLs feature.
 * Includes short code generation and rate limiting.
 */

import { db, sharedConfigurations } from '$lib/server/db';
import { eq, and, gte, asc } from 'drizzle-orm';
import {
	SHARE_CODE_LENGTH,
	SHARE_CODE_CHARSET,
	SHARE_RATE_LIMIT_PER_HOUR,
	SHARE_CODE_MAX_RETRIES
} from '$lib/constants';

/**
 * Generate a cryptographically random short code.
 *
 * @returns 8-character alphanumeric string
 */
export function generateShortCode(): string {
	const randomValues = crypto.getRandomValues(new Uint8Array(SHARE_CODE_LENGTH));
	let code = '';
	for (let i = 0; i < SHARE_CODE_LENGTH; i++) {
		code += SHARE_CODE_CHARSET[randomValues[i] % SHARE_CODE_CHARSET.length];
	}
	return code;
}

/**
 * Generate a unique short code that doesn't exist in the database.
 * Retries up to SHARE_CODE_MAX_RETRIES times on collision.
 *
 * @returns Unique short code or null if all retries failed
 */
export async function generateUniqueShortCode(): Promise<string | null> {
	for (let attempt = 0; attempt < SHARE_CODE_MAX_RETRIES; attempt++) {
		const code = generateShortCode();

		// Check if code already exists
		const existing = await db
			.select({ id: sharedConfigurations.id })
			.from(sharedConfigurations)
			.where(eq(sharedConfigurations.shortCode, code))
			.limit(1);

		if (existing.length === 0) {
			return code;
		}
	}

	return null;
}

/**
 * Check if a user has exceeded their share rate limit.
 *
 * @param userId - The user's UUID
 * @returns Object with isLimited boolean and remaining shares count
 */
export async function checkShareRateLimit(
	userId: string
): Promise<{ isLimited: boolean; remaining: number; resetAt: Date }> {
	const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

	const shares = await db
		.select({ createdAt: sharedConfigurations.createdAt })
		.from(sharedConfigurations)
		.where(
			and(
				eq(sharedConfigurations.userId, userId),
				gte(sharedConfigurations.createdAt, oneHourAgo.toISOString())
			)
		)
		.orderBy(asc(sharedConfigurations.createdAt));

	const shareCount = shares.length;
	const remaining = Math.max(0, SHARE_RATE_LIMIT_PER_HOUR - shareCount);

	let resetAt: Date;
	if (shareCount >= SHARE_RATE_LIMIT_PER_HOUR && shares[0]) {
		// Reset happens 1 hour after the oldest share in the current window
		const oldestCreatedAt = new Date(shares[0].createdAt);
		resetAt = new Date(oldestCreatedAt.getTime() + 60 * 60 * 1000 + 1000); // +1s buffer
	} else {
		resetAt = new Date(Date.now() + 60 * 60 * 1000);
	}

	return {
		isLimited: shareCount >= SHARE_RATE_LIMIT_PER_HOUR,
		remaining,
		resetAt
	};
}

/**
 * Calculate the expiration date for a new share.
 *
 * @param days - Number of days until expiration (default: 7)
 * @returns Expiration date
 */
export function calculateExpirationDate(days: number = 7): Date {
	const expiration = new Date();
	expiration.setDate(expiration.getDate() + days);
	return expiration;
}

/**
 * Check if a share has expired.
 *
 * @param expiresAt - Expiration timestamp string
 * @returns true if expired
 */
export function isShareExpired(expiresAt: string): boolean {
	return new Date(expiresAt) < new Date();
}

/**
 * Calculate remaining days until expiration.
 *
 * @param expiresAt - Expiration timestamp string
 * @returns Number of days remaining (can be negative if expired)
 */
export function getDaysUntilExpiration(expiresAt: string): number {
	const now = new Date();
	const expiration = new Date(expiresAt);
	const diffMs = expiration.getTime() - now.getTime();
	return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
