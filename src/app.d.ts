// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { NeonAuthSession, NeonAuthUser, SafeSessionResult } from '$lib/auth/neon';
import type { NeonAuthClient } from '$lib/auth/neon.server';
import type { Profile } from '$lib/types';

declare global {
	namespace App {
		interface Locals {
			neonAuth: NeonAuthClient;
			safeGetSession: () => Promise<SafeSessionResult>;
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
