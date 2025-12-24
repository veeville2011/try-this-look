import { useState, useEffect, useCallback, useRef } from "react";
import { useShop } from "@/providers/AppBridgeProvider";
import { getSubscriptionStatus } from "@/services/billingApi";

interface PlanLimits {
  includedCredits: number;
  processingPriority: string;
  imageQuality: string;
  supportLevel: string;
  analyticsLevel: string;
  apiAccess: boolean;
  costPerGeneration: number;
}

interface SubscriptionPlan {
  name: string;
  handle: string;
  price: number;
  currencyCode: string;
  interval: string;
  trialDays?: number;
  description?: string;
  features?: string[];
  limits?: PlanLimits;
}

interface SubscriptionDetails {
  id: string;
  status: string;
  currentPeriodEnd: string;
  approvedAt?: string;
  planStartDate?: string;
  currentPeriodStart: string;
  createdAt: string;
  name: string;
  trialDays: number;
  trialDaysRemaining: number;
  isInTrial: boolean;
}

interface SubscriptionStatus {
  requestId?: string;
  hasActiveSubscription: boolean;
  isFree: boolean;
  plan: SubscriptionPlan | null;
  subscription: SubscriptionDetails | null;
}

interface UseSubscriptionReturn {
  subscription: SubscriptionStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const STORAGE_KEY_PREFIX = "nusense_subscription_";
const CACHE_VERSION = "1.0.0"; // Increment when cache schema changes
const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes

/**
 * Check if localStorage is available
 */
const isLocalStorageAvailable = (): boolean => {
  try {
    const test = "__localStorage_test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
};

/**
 * Safe cache operations with error handling
 */
const safeCacheOperations = {
  /**
   * Safely get cache data from localStorage
   */
  get: (storageKey: string): SubscriptionStatus | null => {
    if (!isLocalStorageAvailable()) {
      return null;
    }
    try {
      const cachedData = localStorage.getItem(storageKey);
      if (!cachedData) return null;

      const parsed = JSON.parse(cachedData);
      
      // Validate cache structure
      if (!parsed || typeof parsed !== "object") {
        console.warn("[useSubscription] Invalid cache structure, removing", { storageKey });
        localStorage.removeItem(storageKey);
        return null;
      }

      // Check cache version - if version mismatch, invalidate cache
      if (parsed._cacheVersion !== CACHE_VERSION) {
        console.log("[useSubscription] Cache version mismatch, invalidating", {
          cachedVersion: parsed._cacheVersion,
          currentVersion: CACHE_VERSION,
        });
        localStorage.removeItem(storageKey);
        return null;
      }

      // Check cache age
      const cacheAge = parsed._cachedAt ? Date.now() - parsed._cachedAt : Infinity;
      if (cacheAge > CACHE_MAX_AGE) {
        console.log("[useSubscription] Cache expired", {
          cacheAge: `${Math.round(cacheAge / 1000)}s`,
          maxAge: `${CACHE_MAX_AGE / 1000}s`,
        });
        localStorage.removeItem(storageKey);
        return null;
      }

      // Remove internal cache metadata before returning
      const { _cachedAt, _cacheVersion, ...cleanData } = parsed;
      
      // Validate subscription data structure
      if (
        typeof cleanData.hasActiveSubscription !== "boolean" ||
        typeof cleanData.isFree !== "boolean" ||
        (cleanData.plan !== null && typeof cleanData.plan !== "object") ||
        (cleanData.subscription !== null && typeof cleanData.subscription !== "object")
      ) {
        console.warn("[useSubscription] Invalid subscription data structure, removing cache", { storageKey });
        localStorage.removeItem(storageKey);
        return null;
      }

      return cleanData as SubscriptionStatus;
    } catch (error) {
      console.error("[useSubscription] Error reading cache", { storageKey, error });
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Ignore removal errors
      }
      return null;
    }
  },

  /**
   * Safely set cache data to localStorage
   */
  set: (storageKey: string, subscriptionData: SubscriptionStatus): boolean => {
    if (!isLocalStorageAvailable()) {
      return false;
    }
    try {
      const cacheData = {
        ...subscriptionData,
        _cachedAt: Date.now(),
        _cacheVersion: CACHE_VERSION,
      };
      localStorage.setItem(storageKey, JSON.stringify(cacheData));
      return true;
    } catch (error) {
      // Handle quota exceeded or other storage errors gracefully
      console.warn("[useSubscription] Failed to save cache", { storageKey, error });
      try {
        // Try to clear old cache entries if quota exceeded
        if (error instanceof DOMException && error.name === "QuotaExceededError") {
          // Clear oldest cache entries (simple cleanup)
          const keys = Object.keys(localStorage);
          const subscriptionKeys = keys.filter((k) => k.startsWith(STORAGE_KEY_PREFIX));
          if (subscriptionKeys.length > 0) {
            localStorage.removeItem(subscriptionKeys[0]);
            console.log("[useSubscription] Cleared old cache entry due to quota", { key: subscriptionKeys[0] });
          }
        }
      } catch {
        // Ignore cleanup errors
      }
      return false;
    }
  },

  /**
   * Safely remove cache data from localStorage
   */
  remove: (storageKey: string): void => {
    if (!isLocalStorageAvailable()) {
      return;
    }
    try {
      localStorage.removeItem(storageKey);
      localStorage.removeItem(`${storageKey}_updated`);
    } catch (error) {
      console.warn("[useSubscription] Failed to remove cache", { storageKey, error });
    }
  },

  /**
   * Safely set update marker
   */
  setUpdateMarker: (storageKey: string): void => {
    if (!isLocalStorageAvailable()) {
      return;
    }
    try {
      localStorage.setItem(`${storageKey}_updated`, Date.now().toString());
    } catch {
      // Ignore storage errors for update marker
    }
  },
};

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

      // Use remote API service
      const subscriptionData = await getSubscriptionStatus(normalizedShop);

      if (!subscriptionData || typeof subscriptionData !== "object") {
        throw new Error("Invalid subscription data received");
      }

      console.log("[useSubscription] Subscription data received", {
        shop: normalizedShop,
        hasSubscription: !!subscriptionData.subscription,
        subscriptionId: subscriptionData.subscription?.id,
        status: subscriptionData.subscription?.status,
      });

      // Only update if shop hasn't changed during fetch
      const currentShop = shop || new URLSearchParams(window.location.search).get("shop");
      const currentNormalizedShop = currentShop
        ? (currentShop.includes(".myshopify.com")
            ? currentShop.toLowerCase()
            : `${currentShop.toLowerCase()}.myshopify.com`)
        : null;
      
      // Verify shop hasn't changed before updating state
      if (currentNormalizedShop === normalizedShop) {
        setSubscription(subscriptionData);
        
        // Safely store in cache
        safeCacheOperations.set(storageKey, subscriptionData);
        
        // Broadcast to other tabs that subscription was updated
        try {
          const updateEvent = new CustomEvent('subscriptionUpdated', {
            detail: { shop: normalizedShop, subscription: subscriptionData }
          });
          window.dispatchEvent(updateEvent);
          
          // Set update marker for cross-tab sync
          safeCacheOperations.setUpdateMarker(storageKey);
          
          console.log("[useSubscription] Subscription state updated and broadcasted", {
            shop: normalizedShop,
            hasSubscription: !!subscriptionData.subscription,
          });
        } catch (error) {
          console.warn("[useSubscription] Failed to broadcast subscription update", { error });
        }
        
        // Mark fetch as complete - set fetchedShopRef AFTER successful fetch and state update
        // Only set if shop still matches (prevents race condition if shop changed)
        if (currentNormalizedShop === normalizedShop) {
          fetchedShopRef.current = normalizedShop;
        }
      } else {
        console.log("[useSubscription] Shop changed during fetch, ignoring response", {
          originalShop: normalizedShop,
          currentShop: currentNormalizedShop,
        });
        // Don't set fetchedShopRef if shop changed - allow fresh fetch for new shop
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load subscription information";
      console.error("[useSubscription] Error fetching subscription", {
        error: errorMessage,
        shop: normalizedShop || "unknown",
      });
      setError(errorMessage);
      
      // Only update state if shop hasn't changed during error
      const currentShop = shop || new URLSearchParams(window.location.search).get("shop");
      const currentNormalizedShop = currentShop
        ? (currentShop.includes(".myshopify.com")
            ? currentShop.toLowerCase()
            : `${currentShop.toLowerCase()}.myshopify.com`)
        : null;
      
      if (currentNormalizedShop === normalizedShop) {
        // Even on error, set subscription to null to indicate no subscription
        // This prevents infinite loading
        setSubscription({ subscription: null, plan: null, hasActiveSubscription: false, isFree: false });
      }
      // Don't set fetchedShopRef on error - allow retry on next render
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
      // Safely clear cache for this shop to force fresh API call
      safeCacheOperations.remove(storageKey);
      console.log("[useSubscription] Cleared cache for payment success", { shop: normalizedShop });
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
        const cachedData = safeCacheOperations.get(storageKey);
        if (cachedData) {
          // Valid cache found - use it
          setSubscription(cachedData);
          setLoading(false);
          console.log("[useSubscription] Using cached subscription data", {
            shop: normalizedShop,
            hasSubscription: !!cachedData.subscription,
            subscriptionId: cachedData.subscription?.id,
          });
          return; // Use cache, skip API call
        } else {
          // No valid cache available, but we're skipping fetch
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
    // This provides immediate UI feedback while fetching fresh data
    if (!isPaymentSuccess) {
      const cachedData = safeCacheOperations.get(storageKey);
      if (cachedData) {
        setSubscription(cachedData);
        setLoading(false);
        console.log("[useSubscription] Using cached subscription data while fetching fresh", {
          shop: normalizedShop,
          hasSubscription: !!cachedData.subscription,
          subscriptionId: cachedData.subscription?.id,
        });
      }
    }

    // DON'T set fetchedShopRef here - wait until fetch actually starts
    // Setting it here causes issues where re-renders skip the fetch before it happens

    // Debounce the fetch slightly to prevent rapid successive calls
    // For payment success, use shorter delay to fetch faster and force the fetch
    const debounceDelay = isPaymentSuccess ? 50 : 100;
    fetchTimeoutRef.current = setTimeout(() => {
      // Set fetchedShopRef ONLY when fetch actually starts
      fetchedShopRef.current = normalizedShop;
      fetchSubscription(isPaymentSuccess); // Force fetch for payment success
      fetchTimeoutRef.current = null;
    }, debounceDelay);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
        // If timeout was cleared before fetch started, reset fetchedShopRef
        // This allows fetch to happen on next render
        // Only reset if shop matches (to avoid resetting for different shop)
        if (fetchedShopRef.current === normalizedShop && !isFetchingRef.current) {
          fetchedShopRef.current = null;
        }
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
      // Only process events for the current shop
      const currentShopDomain = shop || new URLSearchParams(window.location.search).get("shop");
      if (!currentShopDomain) return;
      
      const currentNormalizedShop = currentShopDomain.includes(".myshopify.com")
        ? currentShopDomain.toLowerCase()
        : `${currentShopDomain.toLowerCase()}.myshopify.com`;
      
      // Ignore events if shop changed
      if (currentNormalizedShop !== normalizedShop) return;
      
      // Listen for subscription data updates from other tabs
      if (e.key === storageKey && e.newValue && !isFetchingRef.current) {
        const updatedSubscription = safeCacheOperations.get(storageKey);
        if (updatedSubscription) {
          console.log("[useSubscription] Subscription updated from another tab", {
            shop: normalizedShop,
            hasSubscription: !!updatedSubscription.subscription,
          });
          setSubscription(updatedSubscription);
          setLoading(false);
          // Update fetchedShopRef to prevent duplicate fetch
          fetchedShopRef.current = normalizedShop;
        } else {
          // Cache invalid or expired, fetch fresh data
          if (!isFetchingRef.current) {
            fetchedShopRef.current = null; // Clear to allow fetch
            fetchSubscription();
          }
        }
      }
      
      // Listen for update notifications
      if (e.key === `${storageKey}_updated` && e.newValue) {
        // Another tab updated subscription, refresh from cache
        const cachedData = safeCacheOperations.get(storageKey);
        if (cachedData && !isFetchingRef.current) {
          setSubscription(cachedData);
          setLoading(false);
          // Update fetchedShopRef to prevent duplicate fetch
          fetchedShopRef.current = normalizedShop;
        } else if (!isFetchingRef.current) {
          // Cache invalid or expired, fetch fresh
          fetchedShopRef.current = null; // Clear to allow fetch
          fetchSubscription();
        }
      }
    };

    // Handle custom events for same-tab updates
    const handleSubscriptionUpdate = (e: CustomEvent) => {
      // Verify shop matches before processing
      const currentShopDomain = shop || new URLSearchParams(window.location.search).get("shop");
      if (!currentShopDomain) return;
      
      const currentNormalizedShop = currentShopDomain.includes(".myshopify.com")
        ? currentShopDomain.toLowerCase()
        : `${currentShopDomain.toLowerCase()}.myshopify.com`;
      
      if (e.detail?.shop === normalizedShop && 
          e.detail?.shop === currentNormalizedShop && 
          e.detail?.subscription) {
        const subscriptionData = e.detail.subscription;
        console.log("[useSubscription] Subscription updated via custom event", {
          shop: normalizedShop,
          hasSubscription: !!subscriptionData.subscription,
          subscriptionId: subscriptionData.subscription?.id,
        });
        setSubscription(subscriptionData);
        setLoading(false);
        
        // Safely update cache to keep it in sync
        safeCacheOperations.set(storageKey, subscriptionData);
        safeCacheOperations.setUpdateMarker(storageKey);
        
        // Update fetchedShopRef to prevent duplicate fetch
        fetchedShopRef.current = normalizedShop;
      }
    };

    // Set up listeners immediately
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("subscriptionUpdated", handleSubscriptionUpdate as EventListener);
    
    // Check if there's a recent update marker (from another tab or same tab)
    // This handles the case where an update happened before the listener was set up
    // Only check if localStorage is available
    if (isLocalStorageAvailable()) {
      try {
        const updateMarker = localStorage.getItem(`${storageKey}_updated`);
        if (updateMarker) {
          const updateTime = parseInt(updateMarker, 10);
          if (!isNaN(updateTime)) {
            const timeSinceUpdate = Date.now() - updateTime;
            // If update happened in last 5 seconds, refresh from cache
            if (timeSinceUpdate < 5000 && !isFetchingRef.current) {
              const cachedData = safeCacheOperations.get(storageKey);
              if (cachedData) {
                setSubscription(cachedData);
                setLoading(false);
                console.log("[useSubscription] Found recent update marker, synced from cache", {
                  shop: normalizedShop,
                  timeSinceUpdate: `${Math.round(timeSinceUpdate / 1000)}s`,
                });
              }
            }
          }
        }
      } catch (error) {
        console.warn("[useSubscription] Error checking update marker", { error });
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
