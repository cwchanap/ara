import { eq } from 'drizzle-orm';
import { db, profiles } from '$lib/server/db';
import type { NeonAuthUser } from '$lib/auth/types';
import type { Profile } from '$lib/types';
import type { Profile as DbProfile } from '$lib/server/db/schema';

const FALLBACK_USERNAME = 'chaos_user';
const MAX_USERNAME_LENGTH = 30;
const MAX_USERNAME_ATTEMPTS = 100;

function sanitizeUsernameSource(source: unknown): string | null {
	if (typeof source !== 'string') return null;

	const sanitized = source
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '')
		.slice(0, MAX_USERNAME_LENGTH)
		.replace(/^_+|_+$/g, '');

	if (!/^[a-z0-9_]{3,30}$/.test(sanitized)) {
		return null;
	}

	return sanitized;
}

function getEmailLocalPart(email: string | null | undefined): string | null {
	if (!email) return null;
	const [localPart] = email.split('@');
	return localPart || null;
}

function getBaseUsername(user: NeonAuthUser): string {
	const metadataName = user.user_metadata?.name;
	const sources = [user.name, metadataName, getEmailLocalPart(user.email), FALLBACK_USERNAME];

	for (const source of sources) {
		const sanitized = sanitizeUsernameSource(source);
		if (sanitized) return sanitized;
	}

	return FALLBACK_USERNAME;
}

function usernameWithSuffix(base: string, suffix: number): string {
	if (suffix === 0) return base;

	const suffixText = `_${suffix}`;
	const baseMaxLength = MAX_USERNAME_LENGTH - suffixText.length;
	return `${base.slice(0, baseMaxLength).replace(/_+$/g, '')}${suffixText}`;
}

function profileFallback(id: string, username: string): Profile {
	const now = new Date().toISOString();
	return {
		id,
		username,
		createdAt: now,
		updatedAt: now
	};
}

function toProfile(profile: DbProfile): Profile {
	return profile;
}

async function findProfileById(id: string): Promise<DbProfile | null> {
	const rows = await db.select().from(profiles).where(eq(profiles.id, id)).limit(1);
	return rows[0] ?? null;
}

function isUniqueViolation(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false;

	const { code, constraint, name, message } = error as {
		code?: unknown;
		constraint?: unknown;
		name?: unknown;
		message?: unknown;
	};

	if (code === '23505') return true;

	return [constraint, name, message].some((value) => {
		if (typeof value !== 'string') return false;
		const normalized = value.toLowerCase();
		return normalized.includes('duplicate') || normalized.includes('unique');
	});
}

export async function ensureProfileForUser(user: NeonAuthUser): Promise<Profile> {
	const existingProfile = await findProfileById(user.id);
	if (existingProfile) {
		return toProfile(existingProfile);
	}

	const baseUsername = getBaseUsername(user);

	for (let suffix = 0; suffix < MAX_USERNAME_ATTEMPTS; suffix++) {
		const username = usernameWithSuffix(baseUsername, suffix);

		try {
			await db.insert(profiles).values({ id: user.id, username });

			const createdProfile = await findProfileById(user.id);
			return createdProfile ? toProfile(createdProfile) : profileFallback(user.id, username);
		} catch (error) {
			if (!isUniqueViolation(error)) {
				throw error;
			}

			const concurrentProfile = await findProfileById(user.id);
			if (concurrentProfile) {
				return toProfile(concurrentProfile);
			}
		}
	}

	throw new Error('Unable to provision a unique username');
}
