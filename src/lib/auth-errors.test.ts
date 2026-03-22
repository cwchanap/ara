import { describe, expect, test } from 'bun:test';
import { getErrorMessage, validateEmail, validateUsername, validatePassword } from './auth-errors';

describe('validateEmail', () => {
	test('returns null for valid email', () => {
		expect(validateEmail('user@example.com')).toBeNull();
		expect(validateEmail('user.name@domain.org')).toBeNull();
		expect(validateEmail('user+tag@domain.co.uk')).toBeNull();
	});

	test('returns error for empty email', () => {
		expect(validateEmail('')).toBe('Email is required');
	});

	test('returns error for invalid email format', () => {
		expect(validateEmail('notanemail')).toBe('Please enter a valid email address');
		expect(validateEmail('missing@domain')).toBe('Please enter a valid email address');
		expect(validateEmail('@nodomain.com')).toBe('Please enter a valid email address');
		expect(validateEmail('spaces in@email.com')).toBe('Please enter a valid email address');
	});
});

describe('validateUsername', () => {
	test('returns null for valid username', () => {
		expect(validateUsername('john')).toBeNull();
		expect(validateUsername('john_doe')).toBeNull();
		expect(validateUsername('JohnDoe123')).toBeNull();
		expect(validateUsername('abc')).toBeNull(); // minimum 3 chars
	});

	test('returns error for empty username', () => {
		expect(validateUsername('')).toBe('Username is required');
	});

	test('returns error for username too short', () => {
		expect(validateUsername('ab')).toBe('Username must be at least 3 characters');
		expect(validateUsername('a')).toBe('Username must be at least 3 characters');
	});

	test('returns error for username too long', () => {
		const longUsername = 'a'.repeat(31);
		expect(validateUsername(longUsername)).toBe('Username must be at most 30 characters');
	});

	test('returns error for invalid characters', () => {
		expect(validateUsername('john doe')).toBe(
			'Username can only contain letters, numbers, and underscores'
		);
		expect(validateUsername('john-doe')).toBe(
			'Username can only contain letters, numbers, and underscores'
		);
		expect(validateUsername('john@doe')).toBe(
			'Username can only contain letters, numbers, and underscores'
		);
		expect(validateUsername('john.doe')).toBe(
			'Username can only contain letters, numbers, and underscores'
		);
	});
});

describe('validatePassword', () => {
	test('returns null for valid password', () => {
		expect(validatePassword('password123')).toBeNull();
		expect(validatePassword('12345678')).toBeNull(); // exactly 8 chars
		expect(validatePassword('VeryLongSecurePassword!@#')).toBeNull();
	});

	test('returns error for empty password', () => {
		expect(validatePassword('')).toBe('Password is required');
	});

	test('returns error for password too short', () => {
		expect(validatePassword('1234567')).toBe('Password must be at least 8 characters');
		expect(validatePassword('abc')).toBe('Password must be at least 8 characters');
	});
});

describe('getErrorMessage', () => {
	test('returns user-friendly message for known error codes', () => {
		expect(getErrorMessage({ code: 'user_already_exists' })).toBe(
			'An account with this email already exists'
		);
		expect(getErrorMessage({ code: 'invalid_credentials' })).toBe('Invalid email or password');
		expect(getErrorMessage({ code: 'weak_password' })).toBe(
			'Password must be at least 8 characters'
		);
	});

	test('returns user-friendly message for error message patterns', () => {
		expect(getErrorMessage({ message: 'User already registered' })).toBe(
			'An account with this email already exists'
		);
		expect(getErrorMessage({ message: 'Invalid login credentials' })).toBe(
			'Invalid email or password'
		);
		expect(getErrorMessage({ message: 'Password is too weak' })).toBe(
			'Password must be at least 8 characters'
		);
		expect(getErrorMessage({ message: 'Email is invalid' })).toBe(
			'Please enter a valid email address'
		);
	});

	test('returns default message for unknown errors', () => {
		expect(getErrorMessage({ message: 'Some random error' })).toBe(
			'Something went wrong. Please try again.'
		);
		expect(getErrorMessage({ code: 'unknown_code' })).toBe(
			'Something went wrong. Please try again.'
		);
	});

	test('returns default message for null/undefined', () => {
		expect(getErrorMessage(null)).toBe('Something went wrong. Please try again.');
		expect(getErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
	});

	test('handles string errors', () => {
		expect(getErrorMessage('invalid_credentials')).toBe('Invalid email or password');
		expect(getErrorMessage('random_string')).toBe('Something went wrong. Please try again.');
	});

	test('returns correct message for email_exists error code', () => {
		expect(getErrorMessage({ code: 'email_exists' })).toBe(
			'An account with this email already exists'
		);
	});

	test('returns correct message for username_exists error code', () => {
		expect(getErrorMessage({ code: 'username_exists' })).toBe('This username is already taken');
	});

	test('returns correct message for user_not_found error code', () => {
		expect(getErrorMessage({ code: 'user_not_found' })).toBe('No account found with this email');
	});

	test('returns correct message for unauthorized error code', () => {
		expect(getErrorMessage({ code: 'unauthorized' })).toBe(
			'You must be logged in to perform this action'
		);
	});

	test('returns correct message for invalid_current_password error code', () => {
		expect(getErrorMessage({ code: 'invalid_current_password' })).toBe(
			'Current password is incorrect'
		);
	});

	test('returns correct message for password_mismatch error code', () => {
		expect(getErrorMessage({ code: 'password_mismatch' })).toBe('New passwords do not match');
	});

	test('returns correct message for invalid_grant error code', () => {
		expect(getErrorMessage({ code: 'invalid_grant' })).toBe('Invalid email or password');
	});

	test('returns "already exists" match for message containing "already exists"', () => {
		expect(getErrorMessage({ message: 'Email already exists in the system' })).toBe(
			'An account with this email already exists'
		);
	});

	test('returns correct message for "invalid credentials" (without "login") in message', () => {
		expect(getErrorMessage({ message: 'Invalid credentials provided' })).toBe(
			'Invalid email or password'
		);
	});

	test('returns default message for object without code or message', () => {
		expect(getErrorMessage({ status: 500 })).toBe('Something went wrong. Please try again.');
	});

	test('returns default message for boolean false', () => {
		expect(getErrorMessage(false)).toBe('Something went wrong. Please try again.');
	});

	test('returns default message for number 0', () => {
		expect(getErrorMessage(0)).toBe('Something went wrong. Please try again.');
	});
});
