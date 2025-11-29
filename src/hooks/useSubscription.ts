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

  const fetchSubscription = useCallback(async () => {
    if (isFetchingRef.current) {
      return;
    }

    try {
      isFetchingRef.current = true;
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

    // Only fetch if we haven't fetched for this shop yet
    if (fetchedShopRef.current === normalizedShop || isFetchingRef.current) {
      return;
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

    const urlParams = new URLSearchParams(window.location.search);
    const subscriptionUpdated =
      urlParams.get("subscription_updated") === "true" ||
      urlParams.get("subscription_status") ||
      urlParams.get("plan_changed") === "true";

    if (subscriptionUpdated) {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("subscription_updated");
      newUrl.searchParams.delete("subscription_status");
      newUrl.searchParams.delete("plan_changed");
      window.history.replaceState({}, "", newUrl.toString());
    }

    fetchSubscription();
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
    fetchedShopRef.current = null;
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
