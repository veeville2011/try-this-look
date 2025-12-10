/**
 * Authenticated Fetch Utility
 * 
 * Provides a wrapper around fetch that automatically includes session tokens
 * when available. Falls back to regular fetch if authentication is not available.
 * 
 * This enables progressive enhancement - API calls work with or without authentication.
 */

import { CustomerAuthClient, createCustomerAuthClient } from "@/services/customerAuth";

let authClientInstance: CustomerAuthClient | null = null;

/**
 * Get or create authentication client instance
 */
const getAuthClient = (): CustomerAuthClient | null => {
  try {
    if (!authClientInstance) {
      authClientInstance = createCustomerAuthClient();
    }
    return authClientInstance;
  } catch (error) {
    // API base URL not configured or auth not available
    return null;
  }
};

/**
 * Make authenticated fetch request if session token is available
 * Falls back to regular fetch if authentication is not available
 * 
 * @param url - Request URL
 * @param options - Fetch options
 * @returns Fetch response
 */
export const authenticatedFetch = async (
  url: string | URL | Request,
  options: RequestInit = {}
): Promise<Response> => {
  const authClient = getAuthClient();

  // If no auth client or no session token, use regular fetch
  if (!authClient || !authClient.isAuthenticated()) {
    return fetch(url, options);
  }

  try {
    // Try authenticated fetch
    return await authClient.authenticatedFetch(url, options);
  } catch (error) {
    // If authenticated fetch fails with requiresLogin, we could trigger login
    // For now, fall back to regular fetch to maintain backward compatibility
    if (error && typeof error === "object" && "requiresLogin" in error) {
      // Authentication required but not available
      // For now, fall back to regular fetch
      // In the future, we could trigger login flow here
      console.warn("[authenticatedFetch] Authentication required but falling back to regular fetch");
    }
    
    // Fall back to regular fetch
    return fetch(url, options);
  }
};

/**
 * Check if authentication is available
 */
export const isAuthAvailable = (): boolean => {
  const authClient = getAuthClient();
  return authClient?.isAuthenticated() ?? false;
};

