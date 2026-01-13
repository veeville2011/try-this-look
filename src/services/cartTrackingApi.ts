import type {
  TrackCartEventParams,
  TrackCartEventResponse,
} from "@/types/cartTracking";
import { authenticatedFetch } from "@/utils/authenticatedFetch";
import { logError, logApiError } from "@/utils/errorHandler";

/**
 * Get the API base URL from environment variable
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
 * Normalize shop domain - same way as billingApi
 * Ensures consistent store name format across all API calls
 */
const normalizeShopDomain = (shop: string): string => {
  if (shop.includes(".myshopify.com")) {
    return shop.toLowerCase();
  }
  return `${shop.toLowerCase()}.myshopify.com`;
};

/**
 * Track an add to cart event
 * This function sends tracking data to the backend API
 */
export const trackAddToCartEvent = async (
  params: TrackCartEventParams
): Promise<TrackCartEventResponse> => {
  const {
    storeName,
    productId,
    productTitle,
    productUrl,
    variantId,
    customerEmail,
    customerFirstName,
    customerLastName,
    generatedImageUrl,
    personImageUrl,
    clothingImageUrl,
  } = params;

  if (!storeName) {
    return {
      status: "error",
      error: "Store name is required",
      message: "Store name is required to track cart events",
    };
  }

  // Normalize store name
  const normalizedStoreName = normalizeShopDomain(storeName);

  // Get user agent and IP if available
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : null;
  
  // Get session ID from sessionStorage if available
  let sessionId: string | null = null;
  try {
    if (typeof window !== "undefined" && window.sessionStorage) {
      sessionId = sessionStorage.getItem("sessionId") || 
                  `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem("sessionId", sessionId);
    }
  } catch (error) {
    // SessionStorage might not be available, that's okay
  }

  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/cart-tracking/track`;

  const payload = {
    storeName: normalizedStoreName,
    actionType: params.actionType,
    productId: productId || null,
    productTitle: productTitle || null,
    productUrl: productUrl || null,
    variantId: variantId || null,
    customerEmail: customerEmail || null,
    customerFirstName: customerFirstName || null,
    customerLastName: customerLastName || null,
    generatedImageUrl: generatedImageUrl || null,
    personImageUrl: personImageUrl || null,
    clothingImageUrl: clothingImageUrl || null,
    userAgent,
    sessionId,
  };

  try {
    const response = await authenticatedFetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Don't throw error for tracking failures - just log them
      await logApiError("[CART_TRACKING] Failed to track add to cart event", response, { url, payload });
      return {
        status: "error",
        error: `HTTP ${response.status}: ${response.statusText}`,
        message: "Failed to track cart event",
      };
    }

    const data: TrackCartEventResponse = await response.json();
    return data;
  } catch (error) {
    // Don't throw error for tracking failures - just log them
    logError("[CART_TRACKING] Failed to track add to cart event", error, { url, payload });
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Failed to track cart event",
    };
  }
};

