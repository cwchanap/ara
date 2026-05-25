// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { NeonAuthSession, NeonAuthUser, SafeSessionResult } from '$lib/auth/neon';
import type { NeonAuthClient } from '$lib/auth/neon.server';
import type { Profile } from '$lib/types';

type LegacySupabaseAuthError = { message: string } | null;

type LegacySupabaseAuthBoundary = {
	auth: {
		signInWithPassword: (credentials: {
			email: string;
			password: string;
		}) => Promise<{ error: LegacySupabaseAuthError }>;
		signUp: (credentials: {
			email: string;
			password: string;
			options?: { data?: Record<string, unknown> };
		}) => Promise<{
			data: { user: { id: string } | null; session: unknown | null };
			error: LegacySupabaseAuthError;
		}>;
		updateUser: (attributes: {
			password: string;
		}) => Promise<{ error: LegacySupabaseAuthError }>;
		signOut: (options?: { scope?: string }) => Promise<{ error: LegacySupabaseAuthError }>;
	};
};

declare global {
	namespace App {
		interface Locals {
			neonAuth: NeonAuthClient;
			safeGetSession: () => Promise<SafeSessionResult>;
			supabase: LegacySupabaseAuthBoundary;
		}
		interface PageData {
			session: NeonAuthSession | null;
			user: NeonAuthUser | null;
			profile?: Profile | null;
		}
	}
}

export type { Profile };
export {};
