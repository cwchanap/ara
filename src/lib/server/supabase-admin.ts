import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { env } from '$env/dynamic/private';

/**
 * Creates a Supabase Admin client with service role key for server-side operations.
 * This client bypasses Row Level Security and should only be used for admin operations
 * like deleting users when signup fails.
 *
 * Returns null if SUPABASE_SERVICE_ROLE_KEY is not configured.
 */
export function createAdminClient() {
	const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

	if (!serviceRoleKey) {
		console.warn(
			'SUPABASE_SERVICE_ROLE_KEY not configured. Admin operations (like orphan user cleanup) will not be available.'
		);
		return null;
	}

	return createClient(PUBLIC_SUPABASE_URL, serviceRoleKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	});
}

/**
 * Deletes a user from Supabase Auth.
 * Used to clean up orphaned auth users when profile creation fails.
 *
 * @param userId - The Supabase user ID to delete
 * @returns true if deletion succeeded, false if it failed or admin client not available
 */
export async function deleteAuthUser(userId: string): Promise<boolean> {
	const adminClient = createAdminClient();

	if (!adminClient) {
		return false;
	}

	try {
		const { error } = await adminClient.auth.admin.deleteUser(userId);

		if (error) {
			console.error('Failed to delete orphaned auth user:', error);
			return false;
		}

		return true;
	} catch (err) {
		console.error('Error deleting orphaned auth user:', err);
		return false;
	}
}
