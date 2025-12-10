import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  validateSessionThunk,
  handleCallbackThunk,
  logoutThunk,
  initializeAuthThunk,
  clearError,
  clearAuth,
} from "@/store/slices/customerAuthSlice";
import {
  CustomerAuthClient,
  createCustomerAuthClient,
  getApiBaseUrl,
} from "@/services/customerAuth";

/**
 * Custom hook for customer authentication
 * 
 * Provides easy access to authentication state and methods
 * 
 * @example
 * ```tsx
 * const { isAuthenticated, customer, login, logout, isLoading } = useCustomerAuth();
 * 
 * if (!isAuthenticated) {
 *   return <button onClick={() => login(shopDomain)}>Sign In</button>;
 * }
 * 
 * return <div>Welcome, {customer?.email}</div>;
 * ```
 */
export const useCustomerAuth = () => {
  const dispatch = useAppDispatch();
  const authState = useAppSelector((state) => state.customerAuth);

  /**
   * Initialize authentication on mount
   * Checks localStorage for existing session token and validates it
   */
  useEffect(() => {
    // Only initialize if we haven't already loaded
    if (!authState.isLoading && authState.sessionToken === null && !authState.isAuthenticated) {
      dispatch(initializeAuthThunk());
    }
  }, [dispatch]); // Only run once on mount

  /**
   * Get authentication client instance
   */
  const getAuthClient = (): CustomerAuthClient => {
    try {
      return createCustomerAuthClient();
    } catch (error) {
      // Fallback if API base URL not configured
      const fallbackUrl = import.meta.env.VITE_API_ENDPOINT || "https://try-on-server-v1.onrender.com";
      return new CustomerAuthClient(fallbackUrl);
    }
  };

  /**
   * Initiate login flow (standard redirect)
   * @param shopDomain - Storefront domain (e.g., store.myshopify.com or custom-domain.com)
   * @param returnTo - Optional URL to redirect to after successful login
   */
  const login = (shopDomain: string, returnTo?: string): void => {
    try {
      const authClient = getAuthClient();
      
      // If returnTo not provided, use current URL
      const redirectUrl = returnTo || (typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined);
      
      authClient.login(shopDomain, redirectUrl);
      // Note: login() redirects the page, so we won't return here
    } catch (error) {
      console.error("[useCustomerAuth] Login failed:", error);
      // Could dispatch an error action here if needed
    }
  };

  /**
   * Initiate login flow using popup window
   * Opens a popup for authentication, keeping the main page visible
   * @param shopDomain - Storefront domain (e.g., store.myshopify.com or custom-domain.com)
   * @param returnTo - Optional URL to redirect to after successful login (for callback page)
   * @returns Promise that resolves when popup is opened
   */
  const loginWithPopup = async (shopDomain: string, returnTo?: string): Promise<Window | null> => {
    try {
      const authClient = getAuthClient();
      
      // If returnTo not provided, use current URL
      const redirectUrl = returnTo || (typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined);
      
      const popup = await authClient.loginWithPopup(shopDomain, redirectUrl);
      return popup;
    } catch (error) {
      console.error("[useCustomerAuth] Popup login failed:", error);
      throw error;
    }
  };

  /**
   * Handle OAuth callback
   * Should be called on the callback page after OAuth redirect
   */
  const handleCallback = async (): Promise<void> => {
    try {
      await dispatch(handleCallbackThunk()).unwrap();
    } catch (error) {
      console.error("[useCustomerAuth] Callback handling failed:", error);
      throw error;
    }
  };

  /**
   * Logout current session
   */
  const logout = async (): Promise<void> => {
    try {
      await dispatch(logoutThunk()).unwrap();
    } catch (error) {
      console.error("[useCustomerAuth] Logout failed:", error);
      // Logout should succeed even if API call fails
    }
  };

  /**
   * Validate current session
   */
  const validateSession = async (): Promise<boolean> => {
    try {
      await dispatch(validateSessionThunk()).unwrap();
      return true;
    } catch (error) {
      return false;
    }
  };

  /**
   * Clear authentication error
   */
  const clearAuthError = (): void => {
    dispatch(clearError());
  };

  /**
   * Clear all authentication state
   */
  const clearAuthentication = (): void => {
    dispatch(clearAuth());
  };

  /**
   * Get authenticated fetch function
   * Automatically includes session token in requests
   */
  const authenticatedFetch = async (
    url: string | URL | Request,
    options: RequestInit = {}
  ): Promise<Response> => {
    const authClient = getAuthClient();
    return authClient.authenticatedFetch(url, options);
  };

  return {
    // State
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    isValidating: authState.isValidating,
    customer: authState.customer,
    sessionToken: authState.sessionToken,
    error: authState.error,

    // Methods
    login,
    loginWithPopup,
    logout,
    handleCallback,
    validateSession,
    clearAuthError,
    clearAuthentication,
    authenticatedFetch,

    // Helper: Get auth client instance
    getAuthClient,
  };
};

