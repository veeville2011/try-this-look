/**
 * Customer Account API OAuth 2.0 Authentication Client
 * 
 * Handles all OAuth interactions with the backend for Customer Account API authentication.
 * This client manages session tokens, initiates login flows, handles callbacks, and provides
 * authenticated fetch functionality.
 * 
 * Based on frontendguide.md specifications
 */

const SESSION_TOKEN_KEY = "customer_session_token";

export interface CustomerInfo {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}

export interface SessionValidationResult {
  valid: boolean;
  customer?: CustomerInfo;
  error?: string;
}

export interface CallbackResponse {
  success: boolean;
  data?: {
    sessionToken: string;
    customer: CustomerInfo;
    expiresAt?: string;
  };
  error?: string;
  message?: string;
}

export interface ValidationResponse {
  success: boolean;
  data?: {
    customer: CustomerInfo;
    expiresAt?: string;
  };
  error?: string;
  message?: string;
}

export class CustomerAuthClient {
  private apiBaseUrl: string;
  private sessionToken: string | null = null;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl.replace(/\/$/, ""); // Remove trailing slash
    this.sessionToken = this.getStoredSessionToken();
  }

  /**
   * Retrieve session token from localStorage
   * @returns Session token or null if not found
   */
  getStoredSessionToken(): string | null {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        return null;
      }
      const token = localStorage.getItem(SESSION_TOKEN_KEY);
      return token || null;
    } catch (error) {
      // localStorage might be disabled or quota exceeded
      console.warn("[CustomerAuth] Failed to read from localStorage:", error);
      return null;
    }
  }

  /**
   * Store session token in localStorage
   * @param token - Session token to store
   */
  storeSessionToken(token: string): void {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        throw new Error("localStorage is not available");
      }
      localStorage.setItem(SESSION_TOKEN_KEY, token);
      this.sessionToken = token;
    } catch (error) {
      // Handle localStorage quota exceeded or disabled
      if (error instanceof Error && error.name === "QuotaExceededError") {
        console.error("[CustomerAuth] localStorage quota exceeded");
        throw new Error("Storage quota exceeded. Please clear some data and try again.");
      }
      console.error("[CustomerAuth] Failed to store session token:", error);
      throw error;
    }
  }

  /**
   * Clear session token from localStorage
   */
  clearSessionToken(): void {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.removeItem(SESSION_TOKEN_KEY);
      }
      this.sessionToken = null;
    } catch (error) {
      console.warn("[CustomerAuth] Failed to clear session token:", error);
      // Continue anyway - clear from memory
      this.sessionToken = null;
    }
  }

  /**
   * Validate shop domain format
   * @param shopDomain - Domain to validate
   * @returns true if valid storefront domain
   */
  private validateShopDomain(shopDomain: string): boolean {
    if (!shopDomain || typeof shopDomain !== "string") {
      return false;
    }

    // Remove protocol if present
    let domain = shopDomain.trim().toLowerCase().replace(/^https?:\/\//, "");

    // Must be storefront domain (not admin domain)
    if (domain.includes("admin.shopify.com")) {
      return false;
    }

    // Valid formats:
    // - store.myshopify.com
    // - custom-domain.com
    // - shop.example.com
    return domain.length > 0 && !domain.includes("admin");
  }

  /**
   * Initiate OAuth login flow (standard redirect)
   * @param shopDomain - Storefront domain (public-facing domain where customers shop)
   * @param returnTo - Optional URL to redirect to after successful login
   * @throws Error if shopDomain is invalid
   */
  login(shopDomain: string, returnTo?: string): void {
    if (!this.validateShopDomain(shopDomain)) {
      throw new Error(
        "Invalid shop domain. Must be a storefront domain (e.g., store.myshopify.com or your-custom-domain.com), not an admin domain."
      );
    }

    // Normalize shop domain (remove protocol, ensure proper format)
    let normalizedDomain = shopDomain.trim().toLowerCase().replace(/^https?:\/\//, "");

    // Build login URL with return_to parameter if provided
    const loginUrlObj = new URL(`${this.apiBaseUrl}/api/customer-auth/login`);
    loginUrlObj.searchParams.set("shop", normalizedDomain);
    if (returnTo) {
      loginUrlObj.searchParams.set("return_to", encodeURIComponent(returnTo));
    }
    const loginUrl = loginUrlObj.toString();

    // Store shop domain for potential retry
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("last_shop_domain", normalizedDomain);
      }
    } catch (error) {
      // Ignore localStorage errors
    }

    // Redirect to login URL
    // If in iframe, use window.top to break out of iframe
    try {
      if (window.top && window.top !== window) {
        // We're in an iframe - redirect parent window
        window.top.location.href = loginUrl;
      } else {
        // Not in iframe - normal redirect
        window.location.href = loginUrl;
      }
    } catch (error) {
      // If we can't access window.top (cross-origin), try regular redirect
      console.warn("[CustomerAuth] Could not access window.top, using regular redirect");
      window.location.href = loginUrl;
    }
  }

  /**
   * Initiate OAuth login flow using popup window
   * Opens a popup window for authentication, keeping the main page visible
   * @param shopDomain - Storefront domain (public-facing domain where customers shop)
   * @param returnTo - Optional URL to redirect to after successful login (for callback page)
   * @returns Promise that resolves when popup is opened (popup will communicate via postMessage)
   * @throws Error if shopDomain is invalid or popup is blocked
   */
  loginWithPopup(shopDomain: string, returnTo?: string): Promise<Window | null> {
    if (!this.validateShopDomain(shopDomain)) {
      throw new Error(
        "Invalid shop domain. Must be a storefront domain (e.g., store.myshopify.com or your-custom-domain.com), not an admin domain."
      );
    }

    // Normalize shop domain (remove protocol, ensure proper format)
    let normalizedDomain = shopDomain.trim().toLowerCase().replace(/^https?:\/\//, "");

    // Build login URL with return_to parameter if provided
    const loginUrlObj = new URL(`${this.apiBaseUrl}/api/customer-auth/login`);
    loginUrlObj.searchParams.set("shop", normalizedDomain);
    
    // Add popup mode indicator and callback URL
    const callbackUrl = typeof window !== "undefined" 
      ? `${window.location.origin}/auth/callback`
      : "/auth/callback";
    loginUrlObj.searchParams.set("callback_url", encodeURIComponent(callbackUrl));
    
    if (returnTo) {
      loginUrlObj.searchParams.set("return_to", encodeURIComponent(returnTo));
    }
    
    const loginUrl = loginUrlObj.toString();

    // Store shop domain for potential retry
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("last_shop_domain", normalizedDomain);
        if (returnTo) {
          localStorage.setItem("auth_return_to", returnTo);
        }
      }
    } catch (error) {
      // Ignore localStorage errors
    }

    // Open popup window
    // Popup dimensions: 500x600 is a good size for OAuth flows
    const popupWidth = 500;
    const popupHeight = 600;
    const left = window.screen.width / 2 - popupWidth / 2;
    const top = window.screen.height / 2 - popupHeight / 2;

    const popup = window.open(
      loginUrl,
      "shopify_customer_auth",
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    );

    if (!popup) {
      throw new Error(
        "Popup window was blocked. Please allow popups for this site and try again."
      );
    }

    // Store popup reference for potential cleanup
    if (typeof window !== "undefined") {
      (window as any).__customerAuthPopup = popup;
    }

    return Promise.resolve(popup);
  }

  /**
   * Handle OAuth callback after customer authenticates
   * @returns Customer information and session token
   * @throws Error if callback processing fails
   */
  async handleCallback(): Promise<{ sessionToken: string; customer: CustomerInfo; expiresAt?: string }> {
    // Extract query parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const error = urlParams.get("error");
    const errorDescription = urlParams.get("error_description");

    // Handle OAuth errors
    if (error) {
      const errorMessage = errorDescription || error || "Authentication failed";
      throw new Error(`OAuth error: ${errorMessage}`);
    }

    // Validate required parameters
    if (!code || !state) {
      throw new Error("Missing required OAuth parameters (code or state)");
    }

    try {
      // Make POST request to backend callback endpoint
      const callbackUrl = `${this.apiBaseUrl}/api/customer-auth/callback`;
      const response = await fetch(callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
          state,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || errorData.error || `Callback failed with status ${response.status}`
        );
      }

      const result: CallbackResponse = await response.json();

      if (!result.success || !result.data) {
        throw new Error(result.error || result.message || "Authentication failed");
      }

      // Store session token
      this.storeSessionToken(result.data.sessionToken);

      // Return customer information
      return {
        sessionToken: result.data.sessionToken,
        customer: result.data.customer,
        expiresAt: result.data.expiresAt,
      };
    } catch (error) {
      // Clear any partial state
      this.clearSessionToken();
      throw error;
    }
  }

  /**
   * Validate current session token
   * @returns Validation result with customer information if valid
   */
  async validateSession(): Promise<SessionValidationResult> {
    const token = this.getStoredSessionToken();
    if (!token) {
      return {
        valid: false,
        error: "No session token found",
      };
    }

    try {
      const validateUrl = `${this.apiBaseUrl}/api/customer-auth/validate`;
      const response = await fetch(validateUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": token,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Invalid token - clear it
          this.clearSessionToken();
          return {
            valid: false,
            error: "Session expired or invalid",
          };
        }
        const errorData = await response.json().catch(() => ({}));
        return {
          valid: false,
          error: errorData.message || errorData.error || "Validation failed",
        };
      }

      const result: ValidationResponse = await response.json();

      if (!result.success || !result.data) {
        return {
          valid: false,
          error: result.error || result.message || "Validation failed",
        };
      }

      return {
        valid: true,
        customer: result.data.customer,
      };
    } catch (error) {
      // Network error or other exception
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Network error during validation",
      };
    }
  }

  /**
   * Logout current session
   * @returns Promise that resolves when logout is complete
   */
  async logout(): Promise<void> {
    const token = this.getStoredSessionToken();
    
    // Always clear local token, even if API call fails
    this.clearSessionToken();

    if (!token) {
      // No token to logout - already done
      return;
    }

    try {
      const logoutUrl = `${this.apiBaseUrl}/api/customer-auth/logout`;
      await fetch(logoutUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Token": token,
        },
      });
      // Continue even if API call fails - we've already cleared local state
    } catch (error) {
      // Log error but don't throw - we've already cleared local state
      console.warn("[CustomerAuth] Logout API call failed:", error);
    }
  }

  /**
   * Make authenticated fetch request with session token
   * @param url - Request URL
   * @param options - Fetch options
   * @returns Fetch response
   * @throws Error with requiresLogin: true if 401 or no token
   */
  async authenticatedFetch(
    url: string | URL | Request,
    options: RequestInit = {}
  ): Promise<Response> {
    const token = this.getStoredSessionToken();

    if (!token) {
      const error = new Error("No session token available. Please log in.") as Error & {
        requiresLogin: boolean;
      };
      error.requiresLogin = true;
      throw error;
    }

    // Merge headers - ensure X-Session-Token is included
    const headers = new Headers(options.headers);
    headers.set("X-Session-Token", token);

    // Make fetch request with session token
    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 responses
    if (response.status === 401) {
      // Clear invalid token
      this.clearSessionToken();

      // Throw error with requiresLogin flag
      const error = new Error("Session expired. Please log in again.") as Error & {
        requiresLogin: boolean;
      };
      error.requiresLogin = true;
      throw error;
    }

    return response;
  }

  /**
   * Get current session token (from memory or localStorage)
   * @returns Current session token or null
   */
  getSessionToken(): string | null {
    if (!this.sessionToken) {
      this.sessionToken = this.getStoredSessionToken();
    }
    return this.sessionToken;
  }

  /**
   * Check if user is authenticated (has valid session token)
   * @returns true if session token exists
   */
  isAuthenticated(): boolean {
    return !!this.getSessionToken();
  }
}

/**
 * Get API base URL from environment variable
 * @returns API base URL
 * @throws Error if VITE_API_ENDPOINT is not set
 */
export const getApiBaseUrl = (): string => {
  const apiUrl = import.meta.env.VITE_API_ENDPOINT;

  if (!apiUrl) {
    throw new Error(
      "VITE_API_ENDPOINT environment variable is required. " +
        "Please set it in your .env file or environment configuration."
    );
  }

  // Remove trailing slash if present
  return apiUrl.replace(/\/$/, "");
};

/**
 * Create a singleton instance of CustomerAuthClient
 * @returns CustomerAuthClient instance
 */
export const createCustomerAuthClient = (): CustomerAuthClient => {
  const apiBaseUrl = getApiBaseUrl();
  return new CustomerAuthClient(apiBaseUrl);
};

