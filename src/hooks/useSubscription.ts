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

      // Check localStorage cache only (API calls removed)
      const storageKey = `${STORAGE_KEY_PREFIX}${normalizedShop}`;
      const cachedData = localStorage.getItem(storageKey);

      // If cache exists, use it
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          console.log("✅ [useSubscription] Using cached subscription", {
            shop: normalizedShop,
            planHandle: parsed.plan?.handle,
          });
          setSubscription(parsed);
          setLoading(false);
          return;
        } catch (parseError) {
          console.error("❌ [useSubscription] Failed to parse cached data", parseError);
          // Clear invalid cache
          localStorage.removeItem(storageKey);
        }
      }

      // No cache available - return null (no subscription)
      console.log("ℹ️ [useSubscription] No cached subscription found", {
        shop: normalizedShop,
      });
      setSubscription(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load subscription information";
      setError(errorMessage);
      console.error("❌ [useSubscription] Error loading subscription:", err);
      setSubscription(null);
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
