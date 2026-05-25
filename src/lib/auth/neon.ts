import { createAuthClient } from '@neondatabase/auth';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

export interface NeonAuthUser {
	id: string;
	email?: string | null;
	name?: string | null;
	image?: string | null;
	user_metadata?: Record<string, unknown> | null;
}

export interface NeonAuthSession {
	user: NeonAuthUser;
	session?: unknown;
	accessToken?: string | null;
	expiresAt?: number | null;
}

export type SafeSessionResult = {
	session: NeonAuthSession | null;
	user: NeonAuthUser | null;
};

export type NeonAuthClient = ReturnType<typeof createAuthClient>;

export function getNeonAuthUrl(): string {
	const url =
		privateEnv.NEON_AUTH_BASE_URL ||
		privateEnv.VITE_NEON_AUTH_URL ||
		publicEnv.PUBLIC_NEON_AUTH_URL ||
		publicEnv.VITE_NEON_AUTH_URL;

	if (!url) {
		throw new Error('NEON_AUTH_BASE_URL or VITE_NEON_AUTH_URL is required');
	}

	return url;
}

export function createNeonAuthClient(): NeonAuthClient {
	return createAuthClient(getNeonAuthUrl());
}

export function normalizeSession(rawSession: unknown): SafeSessionResult {
	if (!rawSession || typeof rawSession !== 'object') {
		return { session: null, user: null };
	}

	const maybeSession = rawSession as { user?: NeonAuthUser | null };
	if (!maybeSession.user?.id) {
		return { session: null, user: null };
	}

	const session = rawSession as NeonAuthSession;
	return { session, user: maybeSession.user };
}
