/**
 * Authenticated Fetch Utility
 * 
 * Since we're using app proxy approach (no session tokens), this just wraps regular fetch.
 * Kept for backward compatibility with existing API calls.
 * 
 * @param url - Request URL
 * @param options - Fetch options
 * @returns Fetch response
 */
export const authenticatedFetch = async (
  url: string | URL | Request,
  options: RequestInit = {}
): Promise<Response> => {
  // App proxy approach doesn't use session tokens
  // Just use regular fetch
  return fetch(url, options);
};
