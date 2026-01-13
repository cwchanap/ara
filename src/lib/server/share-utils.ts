/**
 * Share Utility Functions
 *
 * Server-side utilities for the shareable configuration URLs feature.
 * Includes short code generation and rate limiting.
 */

import { db, sharedConfigurations } from '$lib/server/db';
import { eq, and, gte, asc, sql } from 'drizzle-orm';
import {
	SHARE_CODE_LENGTH,
	SHARE_CODE_CHARSET,
	SHARE_RATE_LIMIT_PER_HOUR,
	SHARE_CODE_MAX_RETRIES
} from '$lib/constants';
import type { ChaosMapType, ChaosMapParameters } from '$lib/types';

/**
 * Generate a cryptographically random short code with uniform distribution.
 * Uses rejection sampling to avoid modulo bias when charset length doesn't evenly divide 256.
 *
 * @returns 8-character alphanumeric string
 */
export function generateShortCode(): string {
	let code = '';
	const charsetLength = SHARE_CODE_CHARSET.length;
	// Calculate max acceptable byte value to avoid modulo bias
	// 256 % 62 = 10, so we discard bytes >= 248
	const maxAcceptable = Math.floor(256 / charsetLength) * charsetLength;

	for (let i = 0; i < SHARE_CODE_LENGTH; i++) {
		let randomByte: number;
		// Rejection sampling: discard bytes that would cause bias
		do {
			const randomValues = crypto.getRandomValues(new Uint8Array(1));
			randomByte = randomValues[0];
		} while (randomByte >= maxAcceptable);

		code += SHARE_CODE_CHARSET[randomByte % charsetLength];
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
 * Atomically check rate limit and create a new share in a single transaction.
 * This prevents race conditions where concurrent requests could bypass the limit.
 * Also handles short code collision by retrying generation within the transaction.
 *
 * @param userId - The user's UUID
 * @param mapType - The chaos map type
 * @param parameters - The map parameters
 * @param shortCode - The generated short code (will be regenerated on collision)
 * @param expiresAt - The expiration timestamp
 * @returns Object with success boolean, share data if successful, remaining count, and reset time
 */
export async function createShareWithRateLimit(
	userId: string,
	mapType: ChaosMapType,
	parameters: ChaosMapParameters,
	shortCode: string,
	expiresAt: string
): Promise<{
	success: boolean;
	share?: {
		id: string;
		shortCode: string;
		expiresAt: string;
	};
	remaining: number;
	resetAt: Date;
	error?: string;
}> {
	const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

	// Use a single transaction for atomic rate limit check and insert with retry on unique constraint
	return db.transaction(async (tx) => {
		// Count existing shares in the last hour (ordered to find oldest for reset calculation)
		const existingShares = await tx
			.select({ createdAt: sharedConfigurations.createdAt })
			.from(sharedConfigurations)
			.where(
				and(
					eq(sharedConfigurations.userId, userId),
					gte(sharedConfigurations.createdAt, oneHourAgo.toISOString())
				)
			)
			.orderBy(asc(sharedConfigurations.createdAt));

		const shareCount = existingShares.length;

		// Check if user has exceeded the limit
		if (shareCount >= SHARE_RATE_LIMIT_PER_HOUR) {
			// Calculate reset time (1 hour after oldest share in window)
			const oldestCreatedAt = new Date(existingShares[0].createdAt);
			const resetAt = new Date(oldestCreatedAt.getTime() + 60 * 60 * 1000 + 1000); // +1s buffer
			return {
				success: false,
				remaining: 0,
				resetAt,
				error: 'Rate limit exceeded. Limit resets in about 1 hour.'
			};
		}

		// User is allowed to create a share - attempt insert with retry on unique constraint
		// This eliminates the TOCTOU race condition by generating and inserting within the transaction
		for (let attempt = 0; attempt < SHARE_CODE_MAX_RETRIES; attempt++) {
			const codeToUse = attempt === 0 ? shortCode : generateShortCode();

			try {
				const [newShare] = await tx
					.insert(sharedConfigurations)
					.values({
						shortCode: codeToUse,
						userId,
						mapType,
						parameters,
						expiresAt
					})
					.returning({
						id: sharedConfigurations.id,
						shortCode: sharedConfigurations.shortCode,
						expiresAt: sharedConfigurations.expiresAt
					});

				// Calculate remaining shares and reset time
				const remaining = SHARE_RATE_LIMIT_PER_HOUR - shareCount - 1;
				const resetAt = new Date(Date.now() + 60 * 60 * 1000);

				return {
					success: true,
					share: newShare,
					remaining,
					resetAt
				};
			} catch (error) {
				// Check for unique constraint violation (PostgreSQL error code 23505)
				// The error object structure depends on the driver, but typically contains 'code' property
				const isUniqueViolation =
					error && typeof error === 'object' && 'code' in error && error.code === '23505';

				// If it's a unique violation and we haven't exhausted retries, continue to next iteration
				if (isUniqueViolation && attempt < SHARE_CODE_MAX_RETRIES - 1) {
					continue;
				}

				// If we exhausted all retries or it's a different error, fail
				throw error;
			}
		}

		// This should never be reached, but TypeScript needs it
		throw new Error('Failed to generate unique short code after retries');
	});
}

/**
 * Check if a user has exceeded their share rate limit.
 *
 * @param userId - The user's UUID
 * @returns Object with isLimited boolean and remaining shares count
 *
 * @deprecated Use createShareWithRateLimit instead to avoid race conditions.
 * This function is kept for backward compatibility but should not be used in new code.
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
 * Increment the view count for a shareable link atomically.
 *
 * @param shareId - The UUID of the shared configuration
 * @throws Error if the database update fails - callers should handle errors appropriately
 */
export async function incrementViewCount(shareId: string): Promise<void> {
	await db
		.update(sharedConfigurations)
		.set({ viewCount: sql`${sharedConfigurations.viewCount} + 1` })
		.where(eq(sharedConfigurations.id, shareId))
		.execute();
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
