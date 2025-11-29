import { useState, useEffect, useCallback, useRef } from "react";
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
 */
export const useSubscription = (): UseSubscriptionReturn => {
  const shop = useShop();

  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isFetchingRef = useRef(false);
  const fetchedShopRef = useRef<string | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchTimeRef = useRef<number>(0);

  const fetchSubscription = useCallback(async () => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      console.log("[useSubscription] Already fetching, skipping...");
      return;
    }

    // Throttle fetches - don't fetch more than once per second
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    if (timeSinceLastFetch < 1000 && lastFetchTimeRef.current > 0) {
      console.log("[useSubscription] Throttling fetch, too soon since last fetch");
      return;
    }

    try {
      isFetchingRef.current = true;
      lastFetchTimeRef.current = now;
      setLoading(true);
      setError(null);

      const shopDomain = shop || new URLSearchParams(window.location.search).get("shop");
      
      if (!shopDomain) {
        setLoading(false);
        isFetchingRef.current = false;
        return;
      }

      const normalizedShop = shopDomain.includes(".myshopify.com")
        ? shopDomain.toLowerCase()
        : `${shopDomain.toLowerCase()}.myshopify.com`;

      const storageKey = `${STORAGE_KEY_PREFIX}${normalizedShop}`;
      const cachedData = localStorage.getItem(storageKey);

      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          setSubscription(parsed);
        } catch (parseError) {
          localStorage.removeItem(storageKey);
        }
      }

      const apiUrl = `/api/billing/subscription?shop=${encodeURIComponent(normalizedShop)}`;
      
      const appBridge = (window as any).__APP_BRIDGE;
      let fetchFn = fetch;
      let headers: HeadersInit = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      if (appBridge) {
        try {
          const { authenticatedFetch } = await import("@shopify/app-bridge-utils");
          fetchFn = authenticatedFetch(appBridge);
        } catch (error) {
          try {
            const { getSessionToken } = await import("@shopify/app-bridge-utils");
            const token = await getSessionToken(appBridge);
            if (token) {
              headers = {
                ...headers,
                Authorization: `Bearer ${token}`,
              };
            }
          } catch (tokenError) {
            // Ignore
          }
        }
      }

      const response = await fetchFn(apiUrl, {
        method: "GET",
        headers,
        credentials: "same-origin",
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          try {
            const errorText = await response.text();
            if (errorText) {
              errorMessage = errorText.substring(0, 200);
            }
          } catch {
            // Ignore
          }
        }
        throw new Error(errorMessage);
      }

      const subscriptionData = await response.json();

      if (!subscriptionData || typeof subscriptionData !== "object") {
        throw new Error("Invalid subscription data received");
      }

      // Only update if shop hasn't changed
      const currentShop = shop || new URLSearchParams(window.location.search).get("shop");
      const currentNormalizedShop = currentShop
        ? (currentShop.includes(".myshopify.com")
            ? currentShop.toLowerCase()
            : `${currentShop.toLowerCase()}.myshopify.com`)
        : null;
      
      if (currentNormalizedShop === normalizedShop) {
        setSubscription(subscriptionData);
        
        try {
          localStorage.setItem(storageKey, JSON.stringify(subscriptionData));
        } catch {
          // Ignore storage errors
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load subscription information";
      setError(errorMessage);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [shop]);

  useEffect(() => {
    const shopDomain = shop || new URLSearchParams(window.location.search).get("shop");
    
    if (!shopDomain) {
      setLoading(false);
      return;
    }

    const normalizedShop = shopDomain.includes(".myshopify.com")
      ? shopDomain.toLowerCase()
      : `${shopDomain.toLowerCase()}.myshopify.com`;

    // Check if we need to clear the fetched shop ref (e.g., when returning from payment success)
    const urlParams = new URLSearchParams(window.location.search);
    const subscriptionUpdated =
      urlParams.get("subscription_updated") === "true" ||
      urlParams.get("subscription_status") ||
      urlParams.get("plan_changed") === "true" ||
      urlParams.get("payment_success") === "true";

    // If subscription was updated, clear the fetched shop ref to force a fresh fetch
    if (subscriptionUpdated) {
      fetchedShopRef.current = null;
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("subscription_updated");
      newUrl.searchParams.delete("subscription_status");
      newUrl.searchParams.delete("plan_changed");
      newUrl.searchParams.delete("payment_success");
      window.history.replaceState({}, "", newUrl.toString());
    }

    // Only fetch if we haven't fetched for this shop yet and not currently fetching
    if (fetchedShopRef.current === normalizedShop || isFetchingRef.current) {
      console.log("[useSubscription] Skipping fetch - already fetched or fetching", {
        fetchedShop: fetchedShopRef.current,
        currentShop: normalizedShop,
        isFetching: isFetchingRef.current,
      });
      return;
    }

    // Clear any pending timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }

    fetchedShopRef.current = normalizedShop;

    const storageKey = `${STORAGE_KEY_PREFIX}${normalizedShop}`;
    const cachedData = localStorage.getItem(storageKey);

    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        setSubscription(parsed);
        setLoading(false);
      } catch {
        localStorage.removeItem(storageKey);
      }
    }

    // Debounce the fetch slightly to prevent rapid successive calls
    fetchTimeoutRef.current = setTimeout(() => {
      fetchSubscription();
      fetchTimeoutRef.current = null;
    }, 100);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop]); // Depend on shop, but fetchedShopRef prevents duplicate fetches

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      const shopDomain = shop || new URLSearchParams(window.location.search).get("shop");
      if (!shopDomain) return;

      const normalizedShop = shopDomain.includes(".myshopify.com")
        ? shopDomain.toLowerCase()
        : `${shopDomain.toLowerCase()}.myshopify.com`;

      const storageKey = `${STORAGE_KEY_PREFIX}${normalizedShop}`;
      
      if (e.key === storageKey && !isFetchingRef.current) {
        fetchSubscription();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop]); // Only depend on shop - fetchSubscription is stable

  const refresh = useCallback(async () => {
    // Clear the fetched shop ref to force a fresh fetch
    fetchedShopRef.current = null;
    lastFetchTimeRef.current = 0; // Reset throttle
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
