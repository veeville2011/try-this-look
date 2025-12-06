const API_BASE_URL = import.meta.env.VITE_API_ENDPOINT || "";

export interface ProductImage {
  productId: string;
  productTitle: string;
  productHandle: string;
  imageUrl: string;
  imageId: string;
  altText: string;
}

export interface ProductsResponse {
  success: boolean;
  products: ProductImage[];
  count: number;
}

/**
 * Fetch all products with images from the store
 * This requires authentication via session token
 */
export const fetchAllStoreProducts = async (
  shop: string
): Promise<ProductsResponse> => {
  if (!shop) {
    return {
      success: false,
      products: [],
      count: 0,
    };
  }

  // Normalize shop domain
  const normalizedShop = shop.includes(".myshopify.com")
    ? shop.toLowerCase()
    : `${shop.toLowerCase()}.myshopify.com`;

  const queryParams = new URLSearchParams({
    shop: normalizedShop,
  });

  const url = `${API_BASE_URL}/api/products?${queryParams.toString()}`;

  try {
    // Get session token from App Bridge if available
    let headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Try to get session token from App Bridge
    if (typeof window !== "undefined" && (window as any).__APP_BRIDGE) {
      try {
        const { authenticatedFetch } = await import(
          "@shopify/app-bridge-utils"
        );
        const appBridge = (window as any).__APP_BRIDGE;
        const fetchFn = authenticatedFetch(appBridge);

        const response = await fetchFn(url, {
          method: "GET",
          headers,
          credentials: "same-origin",
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return {
            success: false,
            products: [],
            count: 0,
          };
        }

        const data: ProductsResponse = await response.json();
        return data;
      } catch (error) {
        console.warn("[ProductsAPI] Failed to fetch with authenticated fetch:", error);
      }
    }

    // Fallback: regular fetch (may not work without authentication)
    const response = await fetch(url, {
      method: "GET",
      headers,
      credentials: "same-origin",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        products: [],
        count: 0,
      };
    }

    const data: ProductsResponse = await response.json();
    return data;
  } catch (error) {
    console.error("[ProductsAPI] Failed to fetch products:", error);
    return {
      success: false,
      products: [],
      count: 0,
    };
  }
};

