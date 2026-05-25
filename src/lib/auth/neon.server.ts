import { createAuthClient } from '@neondatabase/auth';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import type { Cookies } from '@sveltejs/kit';

type NeonAuthErrorResult = {
	error?: unknown;
};

export type NeonAuthSocialSignInOptions = {
	provider: 'google';
	callbackURL: string;
	disableRedirect?: boolean;
};

export type NeonAuthSocialSignInResult = {
	data?: {
		url?: string | null;
		redirect?: boolean;
	} | null;
	error?: unknown;
};

export type NeonAuthSessionResult = {
	data?: unknown;
	error?: unknown;
};

export type NeonAuthClient = {
	signIn: {
		social: (options: NeonAuthSocialSignInOptions) => Promise<NeonAuthSocialSignInResult>;
	};
	signOut: () => Promise<NeonAuthErrorResult>;
	getSession: () => Promise<NeonAuthSessionResult>;
};

export type NeonAuthClientFactory = (
	url: string,
	config: Parameters<typeof createAuthClient>[1]
) => unknown;

export type CreateNeonAuthClientOptions = {
	headers?: HeadersInit;
	authUrl?: string;
};

const SAFE_AUTH_HEADER_NAMES = ['cookie', 'origin'] as const;
const SAFE_PROXY_HEADER_NAMES = ['origin', 'referer', 'user-agent'] as const;
const SECURE_NEON_AUTH_COOKIE_PREFIX = '__Secure-neon-auth';

export const NEON_AUTH_SESSION_VERIFIER_PARAM = 'neon_auth_session_verifier';

type ProxyFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type NeonAuthProxyOptions = {
	request: Request;
	authUrl?: string;
	fetch?: ProxyFetch;
};

export type NeonOAuthStartResult = {
	ok: boolean;
	status: number;
	providerUrl?: string;
	setCookieHeaders: string[];
	error?: unknown;
};

export type NeonOAuthExchangeResult = {
	ok: boolean;
	status: number;
	redirectUrl: string;
	setCookieHeaders: string[];
	error?: unknown;
};

export type NeonSignOutResult = {
	ok: boolean;
	status: number;
	setCookieHeaders: string[];
	error?: unknown;
};

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> | undefined {
	if (!headers) return undefined;

	const inputHeaders = new Headers(headers);
	const safeHeaders: Record<string, string> = {};

	for (const headerName of SAFE_AUTH_HEADER_NAMES) {
		const value =
			headerName === 'cookie'
				? getSecureNeonAuthCookies(inputHeaders)
				: inputHeaders.get(headerName);
		if (value) {
			safeHeaders[headerName] = value;
		}
	}

	return Object.keys(safeHeaders).length > 0 ? safeHeaders : undefined;
}

function buildAuthEndpoint(authUrl: string, path: string): string {
	return `${authUrl.replace(/\/+$/, '')}${path}`;
}

function getSecureNeonAuthCookies(headers: Headers): string | undefined {
	const cookieHeader = headers.get('cookie');
	if (!cookieHeader) return undefined;

	const secureCookies = cookieHeader
		.split(';')
		.map((cookie) => cookie.trim())
		.filter((cookie) => cookie.startsWith(`${SECURE_NEON_AUTH_COOKIE_PREFIX}`));

	return secureCookies.length > 0 ? secureCookies.join('; ') : undefined;
}

function getFallbackSignOutSetCookieHeaders(request: Request): string[] {
	const secureCookies = getSecureNeonAuthCookies(request.headers);
	if (!secureCookies) return [];

	const cookieNames = new Set(
		secureCookies
			.split(';')
			.map((cookie) => cookie.trim())
			.map((cookie) => {
				const separatorIndex = cookie.indexOf('=');
				return separatorIndex > 0 ? cookie.slice(0, separatorIndex) : '';
			})
			.filter((name) => name.startsWith(SECURE_NEON_AUTH_COOKIE_PREFIX))
	);

	return [...cookieNames].map(
		(name) => `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
	);
}

function getProxyRequestHeaders(request: Request): Headers {
	const incomingHeaders = request.headers;
	const headers = new Headers();
	const cookie = getSecureNeonAuthCookies(incomingHeaders);

	if (cookie) {
		headers.set('cookie', cookie);
	}

	for (const headerName of SAFE_PROXY_HEADER_NAMES) {
		const value = incomingHeaders.get(headerName);
		if (value) {
			headers.set(headerName, value);
		}
	}

	return headers;
}

function getSetCookieHeaders(headers: Headers): string[] {
	const headersWithSetCookie = headers as Headers & { getSetCookie?: () => string[] };
	if (typeof headersWithSetCookie.getSetCookie === 'function') {
		const setCookieHeaders = headersWithSetCookie.getSetCookie();
		if (setCookieHeaders.length > 0) return setCookieHeaders;
	}

	const setCookieHeader = headers.get('set-cookie');
	return setCookieHeader ? [setCookieHeader] : [];
}

async function readJsonResponse(response: Response): Promise<unknown> {
	try {
		return await response.json();
	} catch {
		return null;
	}
}

function getProviderUrl(data: unknown): string | undefined {
	if (!data || typeof data !== 'object') return undefined;

	const directUrl = (data as { url?: unknown }).url;
	if (typeof directUrl === 'string' && directUrl.length > 0) {
		return directUrl;
	}

	const nestedUrl = (data as { data?: { url?: unknown } }).data?.url;
	return typeof nestedUrl === 'string' && nestedUrl.length > 0 ? nestedUrl : undefined;
}

function parseSetCookieHeader(header: string): {
	name: string;
	value: string;
	options: Parameters<Cookies['set']>[2];
} | null {
	const [nameValue, ...attributes] = header.split(';').map((part) => part.trim());
	const separatorIndex = nameValue.indexOf('=');
	if (separatorIndex <= 0) return null;

	const name = nameValue.slice(0, separatorIndex);
	const value = nameValue.slice(separatorIndex + 1);
	const options: Parameters<Cookies['set']>[2] = {
		path: '/',
		encode: (rawValue) => rawValue
	};

	for (const attribute of attributes) {
		const [rawKey, ...rawValueParts] = attribute.split('=');
		const key = rawKey.toLowerCase();
		const attributeValue = rawValueParts.join('=');

		if (key === 'path' && attributeValue) {
			options.path = attributeValue;
		} else if (key === 'domain' && attributeValue) {
			options.domain = attributeValue;
		} else if (key === 'max-age' && attributeValue) {
			const maxAge = Number(attributeValue);
			if (Number.isFinite(maxAge)) {
				options.maxAge = maxAge;
			}
		} else if (key === 'expires' && attributeValue) {
			const expires = new Date(attributeValue);
			if (!Number.isNaN(expires.getTime())) {
				options.expires = expires;
			}
		} else if (key === 'httponly') {
			options.httpOnly = true;
		} else if (key === 'secure') {
			options.secure = true;
		} else if (key === 'samesite' && attributeValue) {
			const sameSite = attributeValue.toLowerCase();
			if (sameSite === 'lax' || sameSite === 'strict' || sameSite === 'none') {
				options.sameSite = sameSite;
			}
		}
	}

	return { name, value, options };
}

export function applyNeonSetCookieHeaders(
	cookies: Pick<Cookies, 'set'>,
	setCookieHeaders: string[]
): void {
	for (const header of setCookieHeaders) {
		const parsed = parseSetCookieHeader(header);
		if (parsed) {
			cookies.set(parsed.name, parsed.value, parsed.options);
		}
	}
}

export function resolveNeonAuthUrl(env: {
	NEON_AUTH_BASE_URL?: string;
	VITE_NEON_AUTH_URL?: string;
	PUBLIC_NEON_AUTH_URL?: string;
}): string {
	const url = env.NEON_AUTH_BASE_URL || env.VITE_NEON_AUTH_URL || env.PUBLIC_NEON_AUTH_URL;

	if (!url) {
		throw new Error(
			'NEON_AUTH_BASE_URL, VITE_NEON_AUTH_URL, or PUBLIC_NEON_AUTH_URL is required'
		);
	}

	return url;
}

export function getNeonAuthUrl(): string {
	return resolveNeonAuthUrl({
		NEON_AUTH_BASE_URL: privateEnv.NEON_AUTH_BASE_URL,
		VITE_NEON_AUTH_URL: privateEnv.VITE_NEON_AUTH_URL,
		PUBLIC_NEON_AUTH_URL: publicEnv.PUBLIC_NEON_AUTH_URL
	});
}

export async function startGoogleOAuth({
	request,
	callbackURL,
	authUrl = getNeonAuthUrl(),
	fetch: fetcher = fetch
}: NeonAuthProxyOptions & { callbackURL: string }): Promise<NeonOAuthStartResult> {
	const headers = getProxyRequestHeaders(request);
	headers.set('content-type', 'application/json');

	try {
		const response = await fetcher(buildAuthEndpoint(authUrl, '/sign-in/social'), {
			method: 'POST',
			headers,
			body: JSON.stringify({
				provider: 'google',
				callbackURL,
				disableRedirect: true
			})
		});
		const data = await readJsonResponse(response);

		return {
			ok: response.ok,
			status: response.status,
			providerUrl: getProviderUrl(data),
			setCookieHeaders: getSetCookieHeaders(response.headers),
			...(response.ok ? {} : { error: data })
		};
	} catch (error) {
		return {
			ok: false,
			status: 0,
			error,
			setCookieHeaders: []
		};
	}
}

export async function exchangeOAuthVerifier({
	request,
	authUrl = getNeonAuthUrl(),
	fetch: fetcher = fetch
}: NeonAuthProxyOptions): Promise<NeonOAuthExchangeResult> {
	const requestUrl = new URL(request.url);
	const redirectUrl = new URL(request.url);
	redirectUrl.searchParams.delete(NEON_AUTH_SESSION_VERIFIER_PARAM);

	const upstreamUrl = new URL(buildAuthEndpoint(authUrl, '/get-session'));
	upstreamUrl.search = requestUrl.search;

	try {
		const response = await fetcher(upstreamUrl, {
			method: 'GET',
			headers: getProxyRequestHeaders(request)
		});
		const data = response.ok ? null : await readJsonResponse(response);

		return {
			ok: response.ok,
			status: response.status,
			redirectUrl: redirectUrl.toString(),
			setCookieHeaders: getSetCookieHeaders(response.headers),
			...(response.ok ? {} : { error: data })
		};
	} catch (error) {
		return {
			ok: false,
			status: 0,
			redirectUrl: redirectUrl.toString(),
			error,
			setCookieHeaders: []
		};
	}
}

export async function signOutWithNeonAuth({
	request,
	authUrl = getNeonAuthUrl(),
	fetch: fetcher = fetch
}: NeonAuthProxyOptions): Promise<NeonSignOutResult> {
	const fallbackSetCookieHeaders = getFallbackSignOutSetCookieHeaders(request);

	try {
		const response = await fetcher(buildAuthEndpoint(authUrl, '/sign-out'), {
			method: 'POST',
			headers: getProxyRequestHeaders(request)
		});
		const data = response.ok ? null : await readJsonResponse(response);
		const setCookieHeaders = getSetCookieHeaders(response.headers);

		return {
			ok: response.ok,
			status: response.status,
			setCookieHeaders:
				setCookieHeaders.length > 0 || response.ok
					? setCookieHeaders
					: fallbackSetCookieHeaders,
			...(response.ok ? {} : { error: data })
		};
	} catch (error) {
		return {
			ok: false,
			status: 0,
			error,
			setCookieHeaders: fallbackSetCookieHeaders
		};
	}
}

export function createNeonAuthClientWithFactory(
	factory: NeonAuthClientFactory,
	options: CreateNeonAuthClientOptions = {}
): NeonAuthClient {
	const config = {
		fetchOptions: {
			headers: normalizeHeaders(options.headers)
		}
	} as unknown as Parameters<typeof createAuthClient>[1];

	return factory(options.authUrl ?? getNeonAuthUrl(), config) as NeonAuthClient;
}

export function createNeonAuthClient(options: CreateNeonAuthClientOptions = {}): NeonAuthClient {
	return createNeonAuthClientWithFactory(createAuthClient, options);
}
