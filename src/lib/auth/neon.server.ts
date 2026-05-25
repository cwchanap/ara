import { createAuthClient } from '@neondatabase/auth';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

export type NeonAuthClient = ReturnType<typeof createAuthClient>;

export function getNeonAuthUrl(): string {
	const url =
		privateEnv.NEON_AUTH_BASE_URL ||
		privateEnv.VITE_NEON_AUTH_URL ||
		publicEnv.PUBLIC_NEON_AUTH_URL;

	if (!url) {
		throw new Error('NEON_AUTH_BASE_URL or VITE_NEON_AUTH_URL is required');
	}

	return url;
}

export function createNeonAuthClient(): NeonAuthClient {
	return createAuthClient(getNeonAuthUrl());
}
