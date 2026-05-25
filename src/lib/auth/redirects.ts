export function getSafeRedirectPath(redirectParam: string | null, basePath: string): string {
	const fallback = basePath || '/';
	if (!redirectParam) return fallback;
	if (redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
		return redirectParam;
	}
	return fallback;
}

export function withRedirectParam(path: string, redirectPath: string): string {
	if (!redirectPath || redirectPath === '/') return path;
	return `${path}?redirect=${encodeURIComponent(redirectPath)}`;
}
