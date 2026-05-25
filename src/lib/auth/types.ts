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
