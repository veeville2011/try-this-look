import { useState, useEffect, useCallback } from "react";
import { useShop, useSessionToken } from "@/providers/AppBridgeProvider";

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

/**
 * Custom hook to manage subscription status
 * Fetches subscription data from the server and provides refresh functionality
 * Updates automatically on window focus and visibility changes (no polling)
 */
export const useSubscription = (): UseSubscriptionReturn => {
  const shop = useShop();
  const { token: sessionToken } = useSessionToken();

  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      setError(null);

      // Get shop from App Bridge hook or URL params (fallback)
      const shopDomain =
        shop || new URLSearchParams(window.location.search).get("shop");
      
      if (!shopDomain) {
        setLoading(false);
        return;
      }

      // Prepare headers with session token if available
      const headers: HeadersInit = {};
      if (sessionToken) {
        headers["Authorization"] = `Bearer ${sessionToken}`;
      }

      const response = await fetch(
        `/api/billing/subscription?shop=${shopDomain}`,
        { headers }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch subscription: ${response.statusText}`);
      }

      const data = await response.json();
      setSubscription(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load subscription information";
      setError(errorMessage);
      
      if (import.meta.env.DEV) {
        console.error("[useSubscription] Failed to fetch subscription:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [shop, sessionToken]);

  // Initial fetch on mount
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Refresh on window focus (user returns to tab)
  useEffect(() => {
    const handleFocus = () => {
      fetchSubscription();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [fetchSubscription]);

  // Refresh when tab becomes visible (handles switching between tabs)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchSubscription();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [fetchSubscription]);

  // Check for subscription update in URL parameters
  // Shopify may redirect back with query params indicating subscription changes
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const subscriptionUpdated =
      urlParams.get("subscription_updated") === "true" ||
      urlParams.get("subscription_status") ||
      urlParams.get("plan_changed") === "true";

    if (subscriptionUpdated) {
      // Refresh subscription status
      fetchSubscription();

      // Clean up URL parameters after refreshing
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("subscription_updated");
      newUrl.searchParams.delete("subscription_status");
      newUrl.searchParams.delete("plan_changed");
      window.history.replaceState({}, "", newUrl.toString());
    }
  }, [fetchSubscription]);

  return {
    subscription,
    loading,
    error,
    refresh: fetchSubscription,
  };
};

