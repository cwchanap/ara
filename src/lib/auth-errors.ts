/**
 * Maps Supabase error codes to user-friendly messages.
 * Per FR-015: System MUST display user-friendly error messages (not technical errors)
 */

const errorMessages: Record<string, string> = {
	// Signup errors
	user_already_exists: 'An account with this email already exists',
	email_exists: 'An account with this email already exists',
	username_exists: 'This username is already taken',
	weak_password: 'Password must be at least 8 characters',
	invalid_email: 'Please enter a valid email address',
	invalid_username: 'Username must be 3-30 characters (letters, numbers, underscore)',

	// Login errors
	invalid_credentials: 'Invalid email or password',
	invalid_grant: 'Invalid email or password',
	user_not_found: 'No account found with this email',

	// Profile errors
	unauthorized: 'You must be logged in to perform this action',

	// Password change errors
	invalid_current_password: 'Current password is incorrect',
	password_mismatch: 'New passwords do not match',

	// Generic errors
	default: 'Something went wrong. Please try again.'
};

/**
 * Gets a user-friendly error message from a Supabase error
 */
export function getErrorMessage(error: unknown): string {
	if (!error) return errorMessages.default;

	// Handle Supabase AuthError
	if (typeof error === 'object' && error !== null) {
		const err = error as { message?: string; code?: string; status?: number };

		// Check for specific error codes
		if (err.code && errorMessages[err.code]) {
			return errorMessages[err.code];
		}

		// Check for error message patterns
		if (err.message) {
			const msg = err.message.toLowerCase();

			if (msg.includes('user already registered') || msg.includes('already exists')) {
				return errorMessages.user_already_exists;
			}
			if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
				return errorMessages.invalid_credentials;
			}
			if (msg.includes('password') && msg.includes('weak')) {
				return errorMessages.weak_password;
			}
			if (msg.includes('email') && (msg.includes('invalid') || msg.includes('valid'))) {
				return errorMessages.invalid_email;
			}
		}
	}

	// Handle string errors
	if (typeof error === 'string') {
		if (errorMessages[error]) {
			return errorMessages[error];
		}
	}

	return errorMessages.default;
}

/**
 * Validates username format
 * @returns null if valid, error message if invalid
 */
export function validateUsername(username: string): string | null {
	if (!username) {
		return 'Username is required';
	}
	if (username.length < 3) {
		return 'Username must be at least 3 characters';
	}
	if (username.length > 30) {
		return 'Username must be at most 30 characters';
	}
	if (!/^[a-zA-Z0-9_]+$/.test(username)) {
		return 'Username can only contain letters, numbers, and underscores';
	}
	return null;
}

/**
 * Validates password format
 * @returns null if valid, error message if invalid
 */
export function validatePassword(password: string): string | null {
	if (!password) {
		return 'Password is required';
	}
	if (password.length < 8) {
		return 'Password must be at least 8 characters';
	}
	return null;
}

/**
 * Validates email format
 * @returns null if valid, error message if invalid
 */
export function validateEmail(email: string): string | null {
	if (!email) {
		return 'Email is required';
	}
	// Basic email regex - browsers do more thorough validation with type="email"
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return 'Please enter a valid email address';
	}
	return null;
}
