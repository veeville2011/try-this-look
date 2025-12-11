/**
 * Shopify Customer Authentication Client
 * 
 * Handles Shopify customer login via app proxy (native storefront login).
 * This approach uses Shopify's native customer login page and app proxy to authenticate customers
 * without requiring Customer Account API configuration.
 * 
 * No remote backend API calls are made - authentication is handled entirely through
 * Shopify's native customer login and app proxy callback.
 */

export interface CustomerInfo {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
}


class CustomerAuthClient {
  constructor() {
    // No API base URL needed - we use Shopify's app proxy approach
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
   * Initiate Shopify customer login using popup window (native storefront login)
   * Opens a popup window to Shopify's customer login page, keeping the main page visible
   * @param shopDomain - Storefront domain (public-facing domain where customers shop)
   * @param returnTo - Optional URL to redirect to after successful login (for callback page)
   * @returns Promise that resolves when popup is opened (popup will communicate via postMessage)
   * @throws Error if shopDomain is invalid or popup is blocked
   */
  loginWithShopifyCustomerPopup(shopDomain: string, returnTo?: string): Promise<Window | null> {
    if (!this.validateShopDomain(shopDomain)) {
      throw new Error(
        "Invalid shop domain. Must be a storefront domain (e.g., store.myshopify.com or your-custom-domain.com), not an admin domain."
      );
    }

    // Normalize shop domain (remove protocol, ensure proper format)
    let normalizedDomain = shopDomain.trim().toLowerCase().replace(/^https?:\/\//, "");

    // Build Shopify native customer login URL
    // Use /customer_authentication/login for redirecting customers back to the online store
    // This endpoint properly respects the return_to parameter (unlike /account/login)
    const protocol = normalizedDomain.includes("localhost") ? "http" : "https";
    
    // Use app proxy for callback (configured in shopify.app.toml)
    // App proxy configuration: prefix="apps", subpath="a"
    // Storefront URL format: /apps/{prefix}/{subpath}/{path} = /apps/apps/a/{path}
    // BUT: return_to must use the STOREFRONT URL format, not the backend format
    // Storefront URL: /apps/a/{path} (Shopify will proxy this to backend: /apps/apps/a/{path})
    // IMPORTANT: return_to must be a relative URL (not absolute) for /customer_authentication/login
    const widgetOrigin = typeof window !== "undefined" ? window.location.origin : "";
    // Use storefront URL format: /apps/a/... (Shopify will proxy to /apps/apps/a/... on backend)
    const callbackPath = `/apps/a/customer-login-callback${widgetOrigin ? `?widget_origin=${encodeURIComponent(widgetOrigin)}` : ''}`;
    
    // Use /customer_authentication/login for redirecting customers back to the online store
    // The return_to parameter must be a relative URL (path only, not full URL)
    // This endpoint properly redirects to return_to after successful login
    const loginUrl = `${protocol}://${normalizedDomain}/customer_authentication/login?return_to=${encodeURIComponent(callbackPath)}`;

    // Store shop domain and return URL for potential retry
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem("last_shop_domain", normalizedDomain);
        if (returnTo) {
          localStorage.setItem("shopify_customer_return_to", returnTo);
        }
        // Store widget origin for postMessage validation
        localStorage.setItem("widget_origin", window.location.origin);
      }
    } catch (error) {
      // Ignore localStorage errors
    }

    // Open popup window
    const popupWidth = 500;
    const popupHeight = 600;
    const left = window.screen.width / 2 - popupWidth / 2;
    const top = window.screen.height / 2 - popupHeight / 2;

    const popup = window.open(
      loginUrl,
      "shopify_customer_login",
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    );

    if (!popup) {
      throw new Error(
        "Popup window was blocked. Please allow popups for this site and try again."
      );
    }

    // Store popup reference for potential cleanup
    if (typeof window !== "undefined") {
      (window as any).__shopifyCustomerLoginPopup = popup;
    }

    return Promise.resolve(popup);
  }

}

/**
 * Create a CustomerAuthClient instance
 * @returns CustomerAuthClient instance
 */
export const createCustomerAuthClient = (): CustomerAuthClient => {
  return new CustomerAuthClient();
};

