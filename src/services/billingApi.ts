/**
 * Billing API Service
 * 
 * Centralized service for all billing and credit API calls
 * Uses remote server as per API_DOCUMENTATION.md
 */

/**
 * Get the API base URL from environment variable
 * @throws Error if VITE_API_ENDPOINT is not set
 */
const getApiBaseUrl = (): string => {
  const apiUrl = import.meta.env.VITE_API_ENDPOINT;
  
  if (!apiUrl) {
    throw new Error(
      "VITE_API_ENDPOINT environment variable is required. " +
      "Please set it in your .env file or environment configuration."
    );
  }
  
  // Remove trailing slash if present
  return apiUrl.replace(/\/$/, "");
};

/**
 * Get authenticated fetch function
 */
const getAuthenticatedFetch = async (): Promise<typeof fetch> => {
  const appBridge = (window as any).__APP_BRIDGE;
  
  if (appBridge) {
    try {
      // Dynamic import - module exists at runtime
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Dynamic import type checking
      const appBridgeUtils = await import("@shopify/app-bridge-utils");
      const { authenticatedFetch } = appBridgeUtils as any;
      if (authenticatedFetch) {
        return authenticatedFetch(appBridge);
      }
    } catch (error) {
      // Fallback to regular fetch with token
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - Dynamic import type checking
        const appBridgeUtils = await import("@shopify/app-bridge-utils");
        const { getSessionToken } = appBridgeUtils as any;
        if (getSessionToken) {
          const token = await getSessionToken(appBridge);
          if (token) {
            return async (url: string | Request | URL, init?: RequestInit) => {
              return fetch(url, {
                ...init,
                headers: {
                  ...init?.headers,
                  Authorization: `Bearer ${token}`,
                },
              });
            };
          }
        }
      } catch (tokenError) {
        // Ignore
      }
    }
  }
  
  return fetch;
};

/**
 * Normalize shop domain
 */
const normalizeShopDomain = (shop: string): string => {
  if (shop.includes(".myshopify.com")) {
    return shop.toLowerCase();
  }
  return `${shop.toLowerCase()}.myshopify.com`;
};

/**
 * Get Available Plans
 * GET /api/billing/plans
 */
export const getAvailablePlans = async (shop?: string): Promise<any> => {
  const baseUrl = getApiBaseUrl();
  const shopParam = shop ? `?shop=${encodeURIComponent(normalizeShopDomain(shop))}` : "";
  const url = `${baseUrl}/api/billing/plans${shopParam}`;
  
  const fetchFn = await getAuthenticatedFetch();
  
  const response = await fetchFn(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "same-origin",
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * Get Subscription Status
 * GET /api/billing/subscription?shop={shop}
 */
export const getSubscriptionStatus = async (shop: string): Promise<any> => {
  const baseUrl = getApiBaseUrl();
  const normalizedShop = normalizeShopDomain(shop);
  const url = `${baseUrl}/api/billing/subscription?shop=${encodeURIComponent(normalizedShop)}`;
  
  const fetchFn = await getAuthenticatedFetch();
  
  const response = await fetchFn(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    credentials: "same-origin",
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * Get Credits Balance
 * GET https://try-on-server-v1-aqjt.onrender.com/api/credits/balance?shop={shop}
 */
export const getCreditsBalance = async (shop: string): Promise<any> => {
  const normalizedShop = normalizeShopDomain(shop);
  const url = `https://try-on-server-v1-aqjt.onrender.com/api/credits/balance?shop=${encodeURIComponent(normalizedShop)}`;
  
  // Use regular fetch for external API (not authenticated)
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * Subscribe to Plan
 * POST /api/billing/subscribe?shop={shop}
 */
export const subscribeToPlan = async (
  shop: string,
  planHandle: string,
  promoCode: string | null = null
): Promise<any> => {
  const baseUrl = getApiBaseUrl();
  const normalizedShop = normalizeShopDomain(shop);
  const url = `${baseUrl}/api/billing/subscribe?shop=${encodeURIComponent(normalizedShop)}`;
  
  const fetchFn = await getAuthenticatedFetch();
  
  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      planHandle,
      promoCode,
    }),
    credentials: "same-origin",
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * Cancel Subscription
 * POST /api/billing/cancel?shop={shop}
 */
export const cancelSubscription = async (
  shop: string,
  subscriptionId: string,
  prorate: boolean = false
): Promise<any> => {
  const baseUrl = getApiBaseUrl();
  const normalizedShop = normalizeShopDomain(shop);
  const url = `${baseUrl}/api/billing/cancel?shop=${encodeURIComponent(normalizedShop)}`;
  
  const fetchFn = await getAuthenticatedFetch();
  
  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      subscriptionId,
      prorate,
    }),
    credentials: "same-origin",
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * Redeem Coupon Code
 * POST /api/credits/redeem-coupon?shop={shop}
 */
export const redeemCouponCode = async (
  shop: string,
  couponCode: string
): Promise<any> => {
  const baseUrl = getApiBaseUrl();
  const normalizedShop = normalizeShopDomain(shop);
  const url = `${baseUrl}/api/credits/redeem-coupon?shop=${encodeURIComponent(normalizedShop)}`;
  
  const fetchFn = await getAuthenticatedFetch();
  
  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      couponCode: couponCode,
    }),
    credentials: "same-origin",
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
};

