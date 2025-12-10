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

    // Build Shopify customer login URL
    // The callback URL should be on the storefront domain so it can access customer session
    const protocol = normalizedDomain.includes("localhost") ? "http" : "https";
    
    // Use app proxy for callback (configured in shopify.app.toml)
    // App proxy format: /apps/{prefix}/{subpath}/{path}
    // With prefix="apps" and subpath="a", the URL becomes: /apps/apps/a/{path}
    // This will be handled by the backend and can access customer session via app proxy params
    const widgetOrigin = typeof window !== "undefined" ? window.location.origin : "";
    const callbackUrl = typeof window !== "undefined" 
      ? `${protocol}://${normalizedDomain}/apps/apps/a/customer-login-callback${widgetOrigin ? `?widget_origin=${encodeURIComponent(widgetOrigin)}` : ''}`
      : `/apps/apps/a/customer-login-callback`;
    
    const loginUrl = `${protocol}://${normalizedDomain}/customer_authentication/login?return_to=${encodeURIComponent(callbackUrl)}`;

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

