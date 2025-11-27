import { useState, useEffect, useCallback } from "react";
import { useShop } from "@/providers/AppBridgeProvider";

interface SubscriptionStatus {
  hasActiveSubscription: boolean;
  isFree: boolean;
  plan: {
    handle: string;
    name: string;
    price: number;
    interval: string;
    features: string[];
    monthlyEquivalent?: number;
  };
  subscription: {
    id: string;
    status: string;
    currentPeriodEnd: string;
  } | null;
  setupProgress?: {
    stepsCompleted: number;
    totalSteps: number;
    completed: boolean;
  };
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
 * Fetches from API endpoint which queries Shopify GraphQL when needed
 * Uses localStorage as cache to reduce API calls
 */
export const useSubscription = (): UseSubscriptionReturn => {
  const shop = useShop();

  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      // Get shop from App Bridge hook or URL params (fallback)
      const shopDomain =
        shop || new URLSearchParams(window.location.search).get("shop");
      
      if (!shopDomain) {
        setLoading(false);
        return;
      }

      // Normalize shop domain
      const normalizedShop = shopDomain.includes(".myshopify.com")
        ? shopDomain.toLowerCase()
        : `${shopDomain.toLowerCase()}.myshopify.com`;

      // Check localStorage cache first
      const storageKey = `${STORAGE_KEY_PREFIX}${normalizedShop}`;
      const cachedData = localStorage.getItem(storageKey);

      // If cache exists and is recent (less than 5 minutes old), use it
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          const cacheAge = parsed.cachedAt 
            ? Date.now() - new Date(parsed.cachedAt).getTime()
            : Infinity;
          
          // Use cache if less than 5 minutes old
          if (cacheAge < 5 * 60 * 1000) {
            console.log("✅ [useSubscription] Using cached subscription", {
              shop: normalizedShop,
              planHandle: parsed.plan?.handle,
              cacheAge: `${Math.round(cacheAge / 1000)}s`,
            });
            setSubscription(parsed);
            setLoading(false);
            return;
          }
        } catch (parseError) {
          console.error("❌ [useSubscription] Failed to parse cached data", parseError);
          // Continue to fetch from API
        }
      }

      // Fetch from API endpoint
      console.log("🔄 [useSubscription] Fetching subscription from API", {
        shop: normalizedShop,
      });

      const response = await fetch(
        `/api/billing/subscription?shop=${encodeURIComponent(normalizedShop)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch subscription: ${response.statusText}`);
      }

      const data = await response.json();

      // If subscription data exists (has plan), cache it
      // If subscription is null, don't cache and set to null
      if (data && data.plan) {
        const subscriptionData = {
          ...data,
          cachedAt: new Date().toISOString(),
        };
        
        localStorage.setItem(storageKey, JSON.stringify(subscriptionData));
        
        console.log("✅ [useSubscription] Subscription fetched from API", {
          shop: normalizedShop,
          planHandle: data.plan?.handle,
          hasActiveSubscription: data.hasActiveSubscription,
        });
        
        setSubscription(data);
      } else {
        // No subscription found - this is valid (user hasn't selected a plan yet)
        console.log("ℹ️ [useSubscription] No subscription found - user needs to select a plan", {
          shop: normalizedShop,
        });
        
        // Clear cache if no subscription (so we don't show stale data)
        localStorage.removeItem(storageKey);
        setSubscription(null);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load subscription information";
      setError(errorMessage);
      console.error("❌ [useSubscription] Error fetching subscription:", err);
      
      // On error, try to use cached data as fallback
      const shopDomain =
        shop || new URLSearchParams(window.location.search).get("shop");
      
      if (shopDomain) {
        const normalizedShop = shopDomain.includes(".myshopify.com")
          ? shopDomain.toLowerCase()
          : `${shopDomain.toLowerCase()}.myshopify.com`;
        const storageKey = `${STORAGE_KEY_PREFIX}${normalizedShop}`;
        const cachedData = localStorage.getItem(storageKey);
        
        if (cachedData) {
          try {
            const parsed = JSON.parse(cachedData);
            console.log("⚠️ [useSubscription] Using stale cache due to API error", {
              shop: normalizedShop,
            });
            setSubscription(parsed);
          } catch {
            // Ignore parse errors
          }
        }
      }
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
      // Reload from API
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
