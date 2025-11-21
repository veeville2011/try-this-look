import { useState, useEffect, useCallback } from "react";
import { useShop } from "@/providers/AppBridgeProvider";

// Free plan configuration (matches server billing.js)
const FREE_PLAN = {
  handle: "free",
  name: "Plan Gratuit",
  price: 0,
  currencyCode: "EUR",
  interval: "EVERY_30_DAYS",
  features: ["Essayage virtuel par IA", "Widget intégré facilement"],
};

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
 * Reads from localStorage cache (populated by webhooks via server)
 * No API calls - uses cache only, defaults to free plan if cache is empty
 */
export const useSubscription = (): UseSubscriptionReturn => {
  const shop = useShop();

  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFromCache = useCallback(() => {
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

      // Read from localStorage cache
      const storageKey = `${STORAGE_KEY_PREFIX}${normalizedShop}`;
      const cachedData = localStorage.getItem(storageKey);

      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          setSubscription(parsed);
          
          if (import.meta.env.DEV) {
            console.log("[useSubscription] Loaded from cache", {
              shop: normalizedShop,
              planHandle: parsed.plan?.handle,
            });
          }
        } catch (parseError) {
          console.error("[useSubscription] Failed to parse cached data", parseError);
          // Fall through to default free plan
        }
      } else {
        // Cache miss - default to free plan
        setSubscription({
          hasActiveSubscription: false,
          isFree: true,
          plan: FREE_PLAN,
          subscription: null,
        });

        if (import.meta.env.DEV) {
          console.log("[useSubscription] Cache miss - using default free plan", {
            shop: normalizedShop,
          });
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load subscription information";
      setError(errorMessage);
      
      if (import.meta.env.DEV) {
        console.error("[useSubscription] Failed to load from cache:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [shop]);

  // Initial load on mount
  useEffect(() => {
    loadFromCache();
  }, [loadFromCache]);

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
        loadFromCache();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [shop, loadFromCache]);

  // Check for subscription update in URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const subscriptionUpdated =
      urlParams.get("subscription_updated") === "true" ||
      urlParams.get("subscription_status") ||
      urlParams.get("plan_changed") === "true";

    if (subscriptionUpdated) {
      // Reload from cache
      loadFromCache();

      // Clean up URL parameters
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("subscription_updated");
      newUrl.searchParams.delete("subscription_status");
      newUrl.searchParams.delete("plan_changed");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, [loadFromCache]);

  return {
    subscription,
    loading,
    error,
    refresh: loadFromCache,
  };
};

