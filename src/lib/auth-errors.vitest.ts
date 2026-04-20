import { describe, expect, it } from 'vitest';
import { getErrorMessage, validateEmail, validateUsername, validatePassword } from './auth-errors';

describe('getErrorMessage', () => {
	it('returns default message for null/undefined', () => {
		expect(getErrorMessage(null)).toBe('Something went wrong. Please try again.');
		expect(getErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
	});

	it('returns message for known error code', () => {
		expect(getErrorMessage({ code: 'invalid_credentials' })).toBe('Invalid email or password');
		expect(getErrorMessage({ code: 'weak_password' })).toBe(
			'Password must be at least 8 characters'
		);
		expect(getErrorMessage({ code: 'user_already_exists' })).toBe(
			'An account with this email already exists'
		);
	});

	it('maps "user already registered" message to friendly text', () => {
		expect(getErrorMessage({ message: 'user already registered' })).toBe(
			'An account with this email already exists'
		);
		expect(getErrorMessage({ message: 'email already exists' })).toBe(
			'An account with this email already exists'
		);
	});

	it('maps "invalid login credentials" message to friendly text', () => {
		expect(getErrorMessage({ message: 'invalid login credentials' })).toBe(
			'Invalid email or password'
		);
		expect(getErrorMessage({ message: 'Invalid credentials for user' })).toBe(
			'Invalid email or password'
		);
	});

	it('maps weak password message', () => {
		expect(getErrorMessage({ message: 'password is too weak' })).toBe(
			'Password must be at least 8 characters'
		);
	});

	it('maps invalid email message', () => {
		expect(getErrorMessage({ message: 'email is invalid' })).toBe(
			'Please enter a valid email address'
		);
		expect(getErrorMessage({ message: 'please provide a valid email' })).toBe(
			'Please enter a valid email address'
		);
	});

	it('returns default for unknown object error', () => {
		expect(getErrorMessage({ message: 'some unknown error', code: 'unknown_code' })).toBe(
			'Something went wrong. Please try again.'
		);
	});

	it('returns mapped message when error is a known string key', () => {
		expect(getErrorMessage('invalid_credentials')).toBe('Invalid email or password');
		expect(getErrorMessage('weak_password')).toBe('Password must be at least 8 characters');
	});

	it('returns default for unknown string error', () => {
		expect(getErrorMessage('some_random_error')).toBe(
			'Something went wrong. Please try again.'
		);
	});
});

describe('validateEmail', () => {
	it('returns null for valid email addresses', () => {
		expect(validateEmail('user@example.com')).toBeNull();
		expect(validateEmail('user.name+tag@domain.co.uk')).toBeNull();
	});

	it('returns error for empty email', () => {
		expect(validateEmail('')).toBe('Email is required');
	});

	it('returns error for invalid format', () => {
		expect(validateEmail('notanemail')).toBe('Please enter a valid email address');
		expect(validateEmail('@nodomain.com')).toBe('Please enter a valid email address');
	});
});

describe('validateUsername', () => {
	it('returns null for valid usernames', () => {
		expect(validateUsername('john_doe')).toBeNull();
		expect(validateUsername('User123')).toBeNull();
	});

	it('returns error for empty username', () => {
		expect(validateUsername('')).toBe('Username is required');
	});

	it('returns error for username too short', () => {
		expect(validateUsername('ab')).toBe('Username must be at least 3 characters');
	});

	it('returns error for username too long', () => {
		expect(validateUsername('a'.repeat(31))).toBe('Username must be at most 30 characters');
	});

	it('returns error for invalid characters', () => {
		expect(validateUsername('user-name')).toBe(
			'Username can only contain letters, numbers, and underscores'
		);
		expect(validateUsername('user name')).toBe(
			'Username can only contain letters, numbers, and underscores'
		);
	});
});

describe('validatePassword', () => {
	it('returns null for valid password', () => {
		expect(validatePassword('StrongPass123')).toBeNull();
		expect(validatePassword('12345678')).toBeNull();
	});

	it('returns error for empty password', () => {
		expect(validatePassword('')).toBe('Password is required');
	});

	it('returns error for password too short', () => {
		expect(validatePassword('short')).toBe('Password must be at least 8 characters');
	});
});
