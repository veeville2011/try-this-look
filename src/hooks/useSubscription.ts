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

  const fetchSubscription = useCallback(async (force = false) => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) {
      console.log("[useSubscription] Already fetching, skipping...");
      return;
    }

    // Throttle fetches - don't fetch more than once per second
    // But allow forced fetches (e.g., for payment success)
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    if (!force && timeSinceLastFetch < 1000 && lastFetchTimeRef.current > 0) {
      console.log("[useSubscription] Throttling fetch, too soon since last fetch", {
        timeSinceLastFetch,
        force,
      });
      return;
    }

    // Declare normalizedShop outside try block so it's accessible in catch/finally
    let normalizedShop: string | null = null;
    
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

      normalizedShop = shopDomain.includes(".myshopify.com")
        ? shopDomain.toLowerCase()
        : `${shopDomain.toLowerCase()}.myshopify.com`;

      const storageKey = `${STORAGE_KEY_PREFIX}${normalizedShop}`;
      
      // Don't use cache during fetch - we want fresh data from API
      // Cache is only used in the useEffect before fetch starts

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

      console.log("[useSubscription] Subscription data received", {
        shop: normalizedShop,
        hasSubscription: !!subscriptionData.subscription,
        subscriptionId: subscriptionData.subscription?.id,
        status: subscriptionData.subscription?.status,
      });

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
          // Store in localStorage for persistence and cross-tab sync
          localStorage.setItem(storageKey, JSON.stringify(subscriptionData));
          
          // Broadcast to other tabs that subscription was updated
          // This helps sync state across multiple tabs
          const updateEvent = new CustomEvent('subscriptionUpdated', {
            detail: { shop: normalizedShop, subscription: subscriptionData }
          });
          window.dispatchEvent(updateEvent);
          
          // Also use storage event for cross-tab communication
          // Note: storage event only fires in OTHER tabs, not the current one
          // So we dispatch a custom event for the current tab
          localStorage.setItem(`${storageKey}_updated`, Date.now().toString());
          
          console.log("[useSubscription] Subscription state updated and broadcasted", {
            shop: normalizedShop,
            hasSubscription: !!subscriptionData.subscription,
          });
        } catch {
          // Ignore storage errors
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load subscription information";
      console.error("[useSubscription] Error fetching subscription", {
        error: errorMessage,
        shop: normalizedShop || "unknown",
      });
      setError(errorMessage);
      // Even on error, set subscription to null to indicate no subscription
      // This prevents infinite loading
      setSubscription({ subscription: null, plan: null, hasActiveSubscription: false, isFree: false });
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
      console.log("[useSubscription] Fetch completed, loading set to false", {
        shop: normalizedShop || "unknown",
      });
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
      urlParams.get("plan_changed") === "true";
    const isPaymentSuccess = urlParams.get("payment_success") === "true";

    // If subscription was updated, clear the fetched shop ref to force a fresh fetch
    if (subscriptionUpdated) {
      fetchedShopRef.current = null;
      lastFetchTimeRef.current = 0; // Reset throttle
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete("subscription_updated");
      newUrl.searchParams.delete("subscription_status");
      newUrl.searchParams.delete("plan_changed");
      window.history.replaceState({}, "", newUrl.toString());
    }

    const storageKey = `${STORAGE_KEY_PREFIX}${normalizedShop}`;

    // If payment success, clear cache and force fresh fetch
    if (isPaymentSuccess) {
      fetchedShopRef.current = null; // Clear to force fresh fetch
      lastFetchTimeRef.current = 0; // Reset throttle to allow immediate fetch
      // Clear localStorage cache for this shop to force fresh API call
      try {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(`${storageKey}_updated`); // Also clear update marker
        console.log("[useSubscription] Cleared cache for payment success", { shop: normalizedShop });
      } catch {
        // Ignore storage errors
      }
      // Set loading immediately for payment success
      setLoading(true);
    }

    // Only fetch if we haven't fetched for this shop yet and not currently fetching
    // BUT: if payment_success, always fetch (fetchedShopRef was cleared above)
    const shouldSkipFetch = !isPaymentSuccess && 
      (fetchedShopRef.current === normalizedShop || isFetchingRef.current);
    
    if (shouldSkipFetch) {
      console.log("[useSubscription] Skipping fetch - already fetched or fetching", {
        fetchedShop: fetchedShopRef.current,
        currentShop: normalizedShop,
        isFetching: isFetchingRef.current,
        isPaymentSuccess,
      });
      
      // If skipping fetch, try to use cache (only if not payment success)
      if (!isPaymentSuccess) {
        const cachedData = localStorage.getItem(storageKey);
        if (cachedData) {
          try {
            const parsed = JSON.parse(cachedData);
            // Use cache regardless of subscription status (null or not)
            // This prevents infinite loading when subscription is cancelled
            if (parsed && typeof parsed === "object") {
              setSubscription(parsed);
              setLoading(false);
              console.log("[useSubscription] Using cached subscription data", {
                shop: normalizedShop,
                hasSubscription: !!parsed.subscription,
                subscriptionId: parsed.subscription?.id,
              });
            } else {
              // Invalid cache data, remove it
              localStorage.removeItem(storageKey);
              setLoading(false);
            }
          } catch {
            localStorage.removeItem(storageKey);
            setLoading(false);
          }
        } else {
          // No cache available, but we're skipping fetch
          // Set loading to false to prevent infinite loading
          setLoading(false);
        }
      } else {
        // Payment success - don't use cache, but still set loading to false
        // The fetch will happen and set loading to true
        setLoading(false);
      }
      return;
    }

    // Clear any pending timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }

    // Mark that we're about to fetch for this shop (but don't set until fetch starts)
    // This prevents race conditions if component re-renders before fetch completes
    
    // Don't use cache if payment_success is detected - always fetch fresh
    // But if we have cached data, use it temporarily while we fetch fresh data (optimistic update)
    // This includes null subscriptions to prevent infinite loading
    if (!isPaymentSuccess) {
      const cachedData = localStorage.getItem(storageKey);
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          // Use cache regardless of subscription status (null or not)
          // This provides immediate UI feedback while fetching fresh data
          if (parsed && typeof parsed === "object") {
            setSubscription(parsed);
            setLoading(false);
            console.log("[useSubscription] Using cached subscription data while fetching fresh", {
              shop: normalizedShop,
              hasSubscription: !!parsed.subscription,
              subscriptionId: parsed.subscription?.id,
            });
          } else {
            // Invalid cache data, remove it
            localStorage.removeItem(storageKey);
          }
        } catch {
          localStorage.removeItem(storageKey);
        }
      }
    }

    // Set fetchedShopRef AFTER we've decided to fetch, but BEFORE the timeout
    // This prevents duplicate fetches if component re-renders
    fetchedShopRef.current = normalizedShop;

    // Debounce the fetch slightly to prevent rapid successive calls
    // For payment success, use shorter delay to fetch faster and force the fetch
    const debounceDelay = isPaymentSuccess ? 50 : 100;
    fetchTimeoutRef.current = setTimeout(() => {
      fetchSubscription(isPaymentSuccess); // Force fetch for payment success
      fetchTimeoutRef.current = null;
    }, debounceDelay);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop]); // Depend on shop, but fetchedShopRef prevents duplicate fetches

  useEffect(() => {
    const shopDomain = shop || new URLSearchParams(window.location.search).get("shop");
    if (!shopDomain) return;

    const normalizedShop = shopDomain.includes(".myshopify.com")
      ? shopDomain.toLowerCase()
      : `${shopDomain.toLowerCase()}.myshopify.com`;

    const storageKey = `${STORAGE_KEY_PREFIX}${normalizedShop}`;

    // Handle cross-tab synchronization via storage events
    const handleStorageChange = (e: StorageEvent) => {
      // Listen for subscription data updates from other tabs
      if (e.key === storageKey && e.newValue && !isFetchingRef.current) {
        try {
          const updatedSubscription = JSON.parse(e.newValue);
          console.log("[useSubscription] Subscription updated from another tab", {
            shop: normalizedShop,
            hasSubscription: !!updatedSubscription.subscription,
          });
          setSubscription(updatedSubscription);
          setLoading(false);
        } catch (parseError) {
          // If parse fails, fetch fresh data
          if (!isFetchingRef.current) {
            fetchSubscription();
          }
        }
      }
      
      // Listen for update notifications
      if (e.key === `${storageKey}_updated` && e.newValue) {
        // Another tab updated subscription, refresh from localStorage
        const cachedData = localStorage.getItem(storageKey);
        if (cachedData && !isFetchingRef.current) {
          try {
            const parsed = JSON.parse(cachedData);
            setSubscription(parsed);
            setLoading(false);
          } catch {
            // If parse fails, fetch fresh
            fetchSubscription();
          }
        }
      }
    };

    // Handle custom events for same-tab updates
    const handleSubscriptionUpdate = (e: CustomEvent) => {
      if (e.detail?.shop === normalizedShop && e.detail?.subscription) {
        console.log("[useSubscription] Subscription updated via custom event", {
          shop: normalizedShop,
          hasSubscription: !!e.detail.subscription.subscription,
          subscriptionId: e.detail.subscription.subscription?.id,
        });
        setSubscription(e.detail.subscription);
        setLoading(false);
        
        // Also update localStorage to keep it in sync
        try {
          localStorage.setItem(storageKey, JSON.stringify(e.detail.subscription));
        } catch {
          // Ignore storage errors
        }
      }
    };

    // Set up listeners immediately
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("subscriptionUpdated", handleSubscriptionUpdate as EventListener);
    
    // Check if there's a recent update marker (from another tab or same tab)
    // This handles the case where an update happened before the listener was set up
    const updateMarker = localStorage.getItem(`${storageKey}_updated`);
    if (updateMarker) {
      const updateTime = parseInt(updateMarker, 10);
      const timeSinceUpdate = Date.now() - updateTime;
      // If update happened in last 5 seconds, refresh from localStorage
      if (timeSinceUpdate < 5000) {
        const cachedData = localStorage.getItem(storageKey);
        if (cachedData && !isFetchingRef.current) {
          try {
            const parsed = JSON.parse(cachedData);
            setSubscription(parsed);
            setLoading(false);
            console.log("[useSubscription] Found recent update marker, synced from localStorage", {
              shop: normalizedShop,
              timeSinceUpdate: `${Math.round(timeSinceUpdate / 1000)}s`,
            });
          } catch {
            // If parse fails, ignore
          }
        }
      }
    }
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("subscriptionUpdated", handleSubscriptionUpdate as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop]); // Only depend on shop - fetchSubscription is stable

  const refresh = useCallback(async () => {
    // Clear the fetched shop ref to force a fresh fetch
    fetchedShopRef.current = null;
    lastFetchTimeRef.current = 0; // Reset throttle
    setLoading(true);
    await fetchSubscription(true); // Force fetch
  }, [fetchSubscription]);

  return {
    subscription,
    loading,
    error,
    refresh,
  };
};
