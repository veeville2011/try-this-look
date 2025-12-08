const API_BASE_URL = import.meta.env.VITE_API_ENDPOINT || "";

export interface NulightProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  status: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
  onlineStoreUrl: string;
  onlineStorePreviewUrl: string;
  totalInventory: number;
  hasOnlyDefaultVariant: boolean;
  hasOutOfStockVariants: boolean;
  priceRangeV2: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
    maxVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  compareAtPriceRange?: {
    minVariantCompareAtPrice: {
      amount: string;
      currencyCode: string;
    };
    maxVariantCompareAtPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  images: {
    nodes: Array<{
      id: string;
      url: string;
      altText: string | null;
      width: number;
      height: number;
    }>;
  };
  variants: {
    nodes: Array<{
      id: string;
      title: string;
      sku: string | null;
      barcode: string | null;
      price: string;
      compareAtPrice: string | null;
      availableForSale: boolean;
      inventoryQuantity: number | null;
      inventoryPolicy: string;
      image: {
        id: string;
        url: string;
        altText: string | null;
      } | null;
      selectedOptions: Array<{
        name: string;
        value: string;
      }>;
    }>;
  };
  options?: {
    id: string;
    name: string;
    values: string[];
  };
  media?: {
    nodes: Array<{
      id: string;
      image: {
        id: string;
        url: string;
        altText: string | null;
        width: number;
        height: number;
      };
    }>;
  };
  seo?: {
    title: string | null;
    description: string | null;
  };
  collections?: {
    nodes: Array<{
      id: string;
      title: string;
      handle: string;
    }>;
  };
}

export interface NulightPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface NulightFilters {
  createdToday: string;
  status: string;
  limit: number;
}

export interface NulightResponse {
  success: boolean;
  message: string;
  data: {
    products: NulightProduct[];
    total: number;
    pageInfo: NulightPageInfo;
    filters: NulightFilters;
  };
}

export interface FetchNulightProductsParams {
  shop: string;
  after?: string;
}

/**
 * Fetch nulight products (products created today with ACTIVE status)
 * This requires authentication via session token
 */
export const fetchNulightProducts = async (
  params: FetchNulightProductsParams
): Promise<NulightResponse> => {
  if (!params.shop) {
    throw new Error("Shop parameter is required");
  }

  // Normalize shop domain (can accept full domain or handle)
  const normalizedShop = params.shop.replace(".myshopify.com", "");

  const queryParams = new URLSearchParams({
    shop: normalizedShop,
  });

  // Add pagination cursor if provided
  if (params.after) {
    queryParams.append("after", params.after);
  }

  const url = `${API_BASE_URL}/api/nulight?${queryParams.toString()}`;

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
          throw new Error(
            errorData.message || `Failed to fetch nulight products: ${response.statusText}`
          );
        }

        const data: NulightResponse = await response.json();
        return data;
      } catch (error) {
        console.warn("[NulightAPI] Failed to fetch with authenticated fetch:", error);
        throw error;
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
      throw new Error(
        errorData.message || `Failed to fetch nulight products: ${response.statusText}`
      );
    }

    const data: NulightResponse = await response.json();
    return data;
  } catch (error) {
    console.error("[NulightAPI] Failed to fetch nulight products:", error);
    throw error;
  }
};

