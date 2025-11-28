import { useState, useEffect, useCallback } from "react";
import { useShop } from "@/providers/AppBridgeProvider";

interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  isFree: boolean;
  plan: {
    name: string;
    price: number;
    currencyCode: string;
    interval: string;
  } | null;
  subscription: {
    id: string;
    status: string;
    currentPeriodEnd: string;
    createdAt: string;
    name: string;
  } | null;
  requestId?: string;
}

interface UseSubscriptionReturn {
  subscription: SubscriptionStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const STORAGE_KEY_PREFIX = "nusense_subscription_";

/**
 * Custom hook to manage subscription status
 * Uses localStorage cache only (API calls removed)
 * Subscription data should be updated via webhooks or other means
 */
export const useSubscription = (): UseSubscriptionReturn => {
  const shop = useShop();

  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get shop from App Bridge hook or URL params (fallback)
      const shopDomain =
        shop || new URLSearchParams(window.location.search).get("shop");
      
      if (!shopDomain) {
        console.warn("⚠️ [useSubscription] No shop domain available", {
          shopFromHook: shop,
          urlParams: window.location.search,
        });
        setLoading(false);
        return;
      }

      // Normalize shop domain
      const normalizedShop = shopDomain.includes(".myshopify.com")
        ? shopDomain.toLowerCase()
        : `${shopDomain.toLowerCase()}.myshopify.com`;

      // Check localStorage cache first for quick initial render
      const storageKey = `${STORAGE_KEY_PREFIX}${normalizedShop}`;
      const cachedData = localStorage.getItem(storageKey);

      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          console.log("✅ [useSubscription] Using cached subscription", {
            shop: normalizedShop,
            planName: parsed.plan?.name,
          });
          setSubscription(parsed);
          // Continue to fetch fresh data in background
        } catch (parseError) {
          console.error("❌ [useSubscription] Failed to parse cached data", parseError);
          localStorage.removeItem(storageKey);
        }
      }

      // Fetch fresh subscription data from API
      const apiUrl = `/api/billing/subscription?shop=${encodeURIComponent(normalizedShop)}`;
      
      console.log("🔄 [useSubscription] Fetching subscription from API", {
        shop: normalizedShop,
        apiUrl,
      });

      // Get App Bridge instance and use authenticatedFetch to include JWT token
      const appBridge = (window as any).__APP_BRIDGE;
      let fetchFn = fetch;
      let headers: HeadersInit = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      // Try to use authenticatedFetch if App Bridge is available
      if (appBridge) {
        try {
          // Use authenticatedFetch from app-bridge-utils (automatically includes JWT)
          const { authenticatedFetch } = await import("@shopify/app-bridge-utils");
          fetchFn = authenticatedFetch(appBridge);
          console.log("✅ [useSubscription] Using authenticatedFetch with App Bridge");
        } catch (error) {
          console.warn("⚠️ [useSubscription] authenticatedFetch failed, trying manual session token", error);
          
          // Fallback: try to get session token manually
          try {
            const { getSessionToken } = await import("@shopify/app-bridge-utils");
            const token = await getSessionToken(appBridge);
            if (token) {
              headers = {
                ...headers,
                Authorization: `Bearer ${token}`,
              };
              console.log("✅ [useSubscription] Using manual session token");
            }
          } catch (tokenError) {
            console.warn("⚠️ [useSubscription] Failed to get session token", tokenError);
          }
        }
      } else {
        console.warn("⚠️ [useSubscription] App Bridge not available, request may fail without JWT");
      }

      const response = await fetchFn(apiUrl, {
        method: "GET",
        headers,
        credentials: "same-origin",
      });

      // Handle non-OK responses
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
          
          console.error("❌ [useSubscription] API error response", {
            shop: normalizedShop,
            status: response.status,
            statusText: response.statusText,
            error: errorData,
          });
        } catch (parseError) {
          // If JSON parsing fails, try to get text
          try {
            const errorText = await response.text();
            if (errorText) {
              errorMessage = errorText.substring(0, 200); // Limit error text length
            }
          } catch (textError) {
            // Ignore text parsing errors
          }
          
          console.error("❌ [useSubscription] Failed to parse error response", {
            shop: normalizedShop,
            status: response.status,
            parseError,
          });
        }

        throw new Error(errorMessage);
      }

      // Parse successful response
      let subscriptionData: SubscriptionStatus;
      try {
        subscriptionData = await response.json();
      } catch (parseError) {
        console.error("❌ [useSubscription] Failed to parse API response", {
          shop: normalizedShop,
          parseError,
        });
        throw new Error("Invalid response format from server");
      }

      // Validate response structure
      if (!subscriptionData || typeof subscriptionData !== "object") {
        console.error("❌ [useSubscription] Invalid response structure", {
          shop: normalizedShop,
          data: subscriptionData,
        });
        throw new Error("Invalid subscription data received");
      }
      
      console.log("✅ [useSubscription] Successfully fetched subscription from API", {
        shop: normalizedShop,
        planName: subscriptionData.plan?.name,
        hasActiveSubscription: subscriptionData.hasActiveSubscription,
        isFree: subscriptionData.isFree,
        subscriptionStatus: subscriptionData.subscription?.status,
      });

      // Update state with fresh data
      setSubscription(subscriptionData);
      
      // Update localStorage cache
      try {
        localStorage.setItem(storageKey, JSON.stringify(subscriptionData));
        console.log("💾 [useSubscription] Updated localStorage cache", {
          shop: normalizedShop,
        });
      } catch (storageError) {
        console.warn("⚠️ [useSubscription] Failed to update cache", {
          shop: normalizedShop,
          error: storageError,
        });
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load subscription information";
      setError(errorMessage);
      console.error("❌ [useSubscription] Error loading subscription:", err);
      
      // If we have cached data, keep using it even if API call failed
      // (subscription state will remain from cache if it was set earlier)
    } finally {
      setLoading(false);
    }
  }, [shop]);

  // Initial load on mount
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Listen for storage events (when webhook updates cache via server)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      const shopDomain =
        shop || new URLSearchParams(window.location.search).get("shop");
      
      if (!shopDomain) return;

      const normalizedShop = shopDomain.includes(".myshopify.com")
        ? shopDomain.toLowerCase()
        : `${shopDomain.toLowerCase()}.myshopify.com`;

      const storageKey = `${STORAGE_KEY_PREFIX}${normalizedShop}`;
      
      if (e.key === storageKey) {
        fetchSubscription();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [shop, fetchSubscription]);

  // Check for subscription update in URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const subscriptionUpdated =
      urlParams.get("subscription_updated") === "true" ||
      urlParams.get("subscription_status") ||
      urlParams.get("plan_changed") === "true";

    if (subscriptionUpdated) {
      // Reload from cache (API calls removed)
      fetchSubscription();

      // Clean up URL parameters
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("subscription_updated");
      newUrl.searchParams.delete("subscription_status");
      newUrl.searchParams.delete("plan_changed");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, [fetchSubscription]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchSubscription();
  }, [fetchSubscription]);

  return {
    subscription,
    loading,
    error,
    refresh,
  };
};
