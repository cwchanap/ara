import { describe, expect, it } from 'vitest';
import { getErrorMessage, validateEmail, validatePassword, validateUsername } from './auth-errors';

describe('getErrorMessage', () => {
	describe('falsy values', () => {
		it('returns default for null', () => {
			expect(getErrorMessage(null)).toBe('Something went wrong. Please try again.');
		});

		it('returns default for undefined', () => {
			expect(getErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
		});

		it('returns default for 0', () => {
			expect(getErrorMessage(0)).toBe('Something went wrong. Please try again.');
		});

		it('returns default for false', () => {
			expect(getErrorMessage(false)).toBe('Something went wrong. Please try again.');
		});

		it('returns default for empty string', () => {
			expect(getErrorMessage('')).toBe('Something went wrong. Please try again.');
		});
	});

	describe('object with error code', () => {
		it('maps user_already_exists', () => {
			expect(getErrorMessage({ code: 'user_already_exists' })).toBe(
				'An account with this email already exists'
			);
		});

		it('maps email_exists', () => {
			expect(getErrorMessage({ code: 'email_exists' })).toBe(
				'An account with this email already exists'
			);
		});

		it('maps username_exists', () => {
			expect(getErrorMessage({ code: 'username_exists' })).toBe(
				'This username is already taken'
			);
		});

		it('maps weak_password', () => {
			expect(getErrorMessage({ code: 'weak_password' })).toBe(
				'Password must be at least 8 characters'
			);
		});

		it('maps invalid_email', () => {
			expect(getErrorMessage({ code: 'invalid_email' })).toBe(
				'Please enter a valid email address'
			);
		});

		it('maps invalid_username', () => {
			expect(getErrorMessage({ code: 'invalid_username' })).toBe(
				'Username must be 3-30 characters (letters, numbers, underscore)'
			);
		});

		it('maps invalid_credentials', () => {
			expect(getErrorMessage({ code: 'invalid_credentials' })).toBe(
				'Invalid email or password'
			);
		});

		it('maps invalid_grant', () => {
			expect(getErrorMessage({ code: 'invalid_grant' })).toBe('Invalid email or password');
		});

		it('maps user_not_found', () => {
			expect(getErrorMessage({ code: 'user_not_found' })).toBe(
				'No account found with this email'
			);
		});

		it('maps unauthorized', () => {
			expect(getErrorMessage({ code: 'unauthorized' })).toBe(
				'You must be logged in to perform this action'
			);
		});

		it('maps invalid_current_password', () => {
			expect(getErrorMessage({ code: 'invalid_current_password' })).toBe(
				'Current password is incorrect'
			);
		});

		it('maps password_mismatch', () => {
			expect(getErrorMessage({ code: 'password_mismatch' })).toBe(
				'New passwords do not match'
			);
		});

		it('returns default for unknown code', () => {
			expect(getErrorMessage({ code: 'unknown_code' })).toBe(
				'Something went wrong. Please try again.'
			);
		});

		it('returns default for object with empty code', () => {
			expect(getErrorMessage({ code: '' })).toBe('Something went wrong. Please try again.');
		});
	});

	describe('object with message pattern matching', () => {
		it('matches "user already registered"', () => {
			expect(getErrorMessage({ message: 'User already registered' })).toBe(
				'An account with this email already exists'
			);
		});

		it('matches "already exists"', () => {
			expect(getErrorMessage({ message: 'User already exists' })).toBe(
				'An account with this email already exists'
			);
		});

		it('matches "already exists" case-insensitively', () => {
			expect(getErrorMessage({ message: 'ALREADY EXISTS' })).toBe(
				'An account with this email already exists'
			);
		});

		it('matches "Email already exists in the system"', () => {
			expect(getErrorMessage({ message: 'Email already exists in the system' })).toBe(
				'An account with this email already exists'
			);
		});

		it('matches "invalid login credentials"', () => {
			expect(getErrorMessage({ message: 'Invalid login credentials' })).toBe(
				'Invalid email or password'
			);
		});

		it('matches "invalid credentials"', () => {
			expect(getErrorMessage({ message: 'invalid credentials' })).toBe(
				'Invalid email or password'
			);
		});

		it('matches "Invalid credentials provided" (without "login")', () => {
			expect(getErrorMessage({ message: 'Invalid credentials provided' })).toBe(
				'Invalid email or password'
			);
		});

		it('matches password + weak', () => {
			expect(getErrorMessage({ message: 'Password is too weak' })).toBe(
				'Password must be at least 8 characters'
			);
		});

		it('matches email + invalid', () => {
			expect(getErrorMessage({ message: 'Email is invalid' })).toBe(
				'Please enter a valid email address'
			);
		});

		it('matches email + valid (not valid)', () => {
			expect(getErrorMessage({ message: 'email is not valid' })).toBe(
				'Please enter a valid email address'
			);
		});
	});

	describe('object with unknown code and non-matching message', () => {
		it('returns default', () => {
			expect(getErrorMessage({ code: 'some_error', message: 'something random' })).toBe(
				'Something went wrong. Please try again.'
			);
		});

		it('returns default for "Some random error" message', () => {
			expect(getErrorMessage({ message: 'Some random error' })).toBe(
				'Something went wrong. Please try again.'
			);
		});

		it('returns default for object without code or message', () => {
			expect(getErrorMessage({ status: 500 })).toBe(
				'Something went wrong. Please try again.'
			);
		});

		it('returns default for empty object', () => {
			expect(getErrorMessage({})).toBe('Something went wrong. Please try again.');
		});
	});

	describe('string input', () => {
		it('maps known error code string', () => {
			expect(getErrorMessage('invalid_credentials')).toBe('Invalid email or password');
		});

		it('maps user_already_exists string', () => {
			expect(getErrorMessage('user_already_exists')).toBe(
				'An account with this email already exists'
			);
		});

		it('returns default for unknown string', () => {
			expect(getErrorMessage('some_unknown_error')).toBe(
				'Something went wrong. Please try again.'
			);
		});

		it('returns default for "random_string"', () => {
			expect(getErrorMessage('random_string')).toBe(
				'Something went wrong. Please try again.'
			);
		});
	});

	describe('code takes priority over message', () => {
		it('uses code when both code and message are present', () => {
			expect(
				getErrorMessage({ code: 'invalid_credentials', message: 'User already registered' })
			).toBe('Invalid email or password');
		});
	});
});

describe('validateUsername', () => {
	it('returns error for empty string', () => {
		expect(validateUsername('')).toBe('Username is required');
	});

	it('returns error for too short username', () => {
		expect(validateUsername('ab')).toBe('Username must be at least 3 characters');
	});

	it('returns error for exactly 2 characters', () => {
		expect(validateUsername('a1')).toBe('Username must be at least 3 characters');
	});

	it('returns error for a single character', () => {
		expect(validateUsername('a')).toBe('Username must be at least 3 characters');
	});

	it('returns error for too long username', () => {
		expect(validateUsername('a'.repeat(31))).toBe('Username must be at most 30 characters');
	});

	it('returns error for exactly 31 characters', () => {
		expect(validateUsername('a'.repeat(31))).toBe('Username must be at most 30 characters');
	});

	it('returns error for invalid characters (spaces)', () => {
		expect(validateUsername('user name')).toBe(
			'Username can only contain letters, numbers, and underscores'
		);
	});

	it('returns error for invalid characters (special chars)', () => {
		expect(validateUsername('user@name')).toBe(
			'Username can only contain letters, numbers, and underscores'
		);
	});

	it('returns error for invalid characters (hyphens)', () => {
		expect(validateUsername('user-name')).toBe(
			'Username can only contain letters, numbers, and underscores'
		);
	});

	it('returns error for invalid characters (dots)', () => {
		expect(validateUsername('john.doe')).toBe(
			'Username can only contain letters, numbers, and underscores'
		);
	});

	it('accepts valid username with letters', () => {
		expect(validateUsername('abc')).toBeNull();
	});

	it('accepts valid username with letters and numbers', () => {
		expect(validateUsername('user123')).toBeNull();
	});

	it('accepts valid username with underscores', () => {
		expect(validateUsername('user_name')).toBeNull();
	});

	it('accepts valid username at min boundary (3 chars)', () => {
		expect(validateUsername('abc')).toBeNull();
	});

	it('accepts valid username at max boundary (30 chars)', () => {
		expect(validateUsername('a'.repeat(30))).toBeNull();
	});

	it('accepts all uppercase letters', () => {
		expect(validateUsername('ABC')).toBeNull();
	});

	it('accepts mixed case with numbers and underscores', () => {
		expect(validateUsername('User_Name_123')).toBeNull();
	});

	it('accepts mixed-case alphanumeric (JohnDoe123)', () => {
		expect(validateUsername('JohnDoe123')).toBeNull();
	});
});

describe('validatePassword', () => {
	it('returns error for empty string', () => {
		expect(validatePassword('')).toBe('Password is required');
	});

	it('returns error for too short password', () => {
		expect(validatePassword('1234567')).toBe('Password must be at least 8 characters');
	});

	it('returns error for exactly 7 characters', () => {
		expect(validatePassword('1234567')).toBe('Password must be at least 8 characters');
	});

	it('returns error for short non-numeric password', () => {
		expect(validatePassword('abc')).toBe('Password must be at least 8 characters');
	});

	it('accepts valid password at min boundary (8 chars)', () => {
		expect(validatePassword('12345678')).toBeNull();
	});

	it('accepts an alphanumeric password', () => {
		expect(validatePassword('password123')).toBeNull();
	});

	it('accepts a password with special characters', () => {
		expect(validatePassword('VeryLongSecurePassword!@#')).toBeNull();
	});

	it('accepts long password', () => {
		expect(validatePassword('a'.repeat(100))).toBeNull();
	});
});

describe('validateEmail', () => {
	it('returns error for empty string', () => {
		expect(validateEmail('')).toBe('Email is required');
	});

	it('returns error for email without @', () => {
		expect(validateEmail('userexample.com')).toBe('Please enter a valid email address');
	});

	it('returns error for plain text (notanemail)', () => {
		expect(validateEmail('notanemail')).toBe('Please enter a valid email address');
	});

	it('returns error for email without domain', () => {
		expect(validateEmail('user@')).toBe('Please enter a valid email address');
	});

	it('returns error for email without TLD', () => {
		expect(validateEmail('user@example')).toBe('Please enter a valid email address');
	});

	it('returns error for email without TLD (missing@domain)', () => {
		expect(validateEmail('missing@domain')).toBe('Please enter a valid email address');
	});

	it('returns error for email with empty local part', () => {
		expect(validateEmail('@nodomain.com')).toBe('Please enter a valid email address');
	});

	it('returns error for email with spaces', () => {
		expect(validateEmail('user @example.com')).toBe('Please enter a valid email address');
	});

	it('returns error for spaces in local part', () => {
		expect(validateEmail('spaces in@email.com')).toBe('Please enter a valid email address');
	});

	it('returns error for double @', () => {
		expect(validateEmail('user@@example.com')).toBe('Please enter a valid email address');
	});

	it('accepts valid email', () => {
		expect(validateEmail('user@example.com')).toBeNull();
	});

	it('accepts email with subdomain', () => {
		expect(validateEmail('user@sub.example.com')).toBeNull();
	});

	it('accepts email with plus addressing', () => {
		expect(validateEmail('user+tag@example.com')).toBeNull();
	});

	it('accepts email with multi-part TLD', () => {
		expect(validateEmail('user+tag@domain.co.uk')).toBeNull();
	});

	it('accepts email with dots in local part', () => {
		expect(validateEmail('first.last@example.com')).toBeNull();
	});

	it('accepts email with dotted local part (user.name@domain.org)', () => {
		expect(validateEmail('user.name@domain.org')).toBeNull();
	});
});
