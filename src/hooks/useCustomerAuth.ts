import { useState, useEffect } from "react";
import {
  createCustomerAuthClient,
  CustomerInfo,
} from "@/services/customerAuth";

/**
 * Custom hook for Shopify customer authentication via app proxy
 * 
 * Provides easy access to authentication methods for Shopify customer login
 * Customer data is stored in localStorage and read from there
 * 
 * @example
 * ```tsx
 * const { loginWithShopifyCustomerPopup, isAuthenticated, customer } = useCustomerAuth();
 * 
 * <button onClick={() => loginWithShopifyCustomerPopup(shopDomain)}>
 *   Sign In
 * </button>
 * ```
 */
export const useCustomerAuth = () => {
  const [customer, setCustomer] = useState<CustomerInfo | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Read customer data from localStorage on mount and when it changes
  useEffect(() => {
    const loadCustomerData = () => {
      try {
        if (typeof window !== "undefined" && window.localStorage) {
          const storedData = localStorage.getItem("shopify_customer_data");
          if (storedData) {
            const parsed = JSON.parse(storedData);
            if (parsed.authenticated && parsed.id) {
              setCustomer({
                id: parsed.id,
                email: parsed.email || "",
                firstName: parsed.firstName,
                lastName: parsed.lastName,
              });
              setIsAuthenticated(true);
              return;
            }
          }
        }
      } catch (error) {
        console.warn("[useCustomerAuth] Failed to load customer data:", error);
      }
      setCustomer(null);
      setIsAuthenticated(false);
    };

    // Load on mount
    loadCustomerData();

    // Listen for storage changes (when customer data is updated)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "shopify_customer_data") {
        loadCustomerData();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Also listen for custom event (for same-window updates)
    const handleCustomStorageChange = () => {
      loadCustomerData();
    };
    window.addEventListener("shopify_customer_data_updated", handleCustomStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("shopify_customer_data_updated", handleCustomStorageChange);
    };
  }, []);

  /**
   * Initiate Shopify customer login using popup window (native storefront login)
   * Opens a popup to Shopify's customer login page, keeping the main page visible
   * @param shopDomain - Storefront domain (e.g., store.myshopify.com or custom-domain.com)
   * @param returnTo - Optional URL to redirect to after successful login (for callback page)
   * @returns Promise that resolves when popup is opened
   */
  const loginWithShopifyCustomerPopup = async (shopDomain: string, returnTo?: string): Promise<Window | null> => {
    try {
      const authClient = createCustomerAuthClient();
      
      // If returnTo not provided, use current URL
      const redirectUrl = returnTo || (typeof window !== "undefined" ? window.location.pathname + window.location.search : undefined);
      
      const popup = await authClient.loginWithShopifyCustomerPopup(shopDomain, redirectUrl);
      return popup;
    } catch (error) {
      console.error("[useCustomerAuth] Shopify customer popup login failed:", error);
      throw error;
    }
  };

  return {
    // State (from localStorage - customer data stored after app proxy login)
    isAuthenticated,
    customer,

    // Methods
    loginWithShopifyCustomerPopup,
  };
};

