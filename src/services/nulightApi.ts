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
  onlineStoreUrl: string | null;
  onlineStorePreviewUrl: string | null;
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
      images: Array<{
        id: string;
        originalImageUrl: string;
        altText: string | null;
        width: number | null;
        height: number | null;
        transformedImageUrls: string[];
        relightingStatus: "completed" | "pending" | "failed";
        relightingImageId: number;
        approvalStatus: "pending" | "approved" | "rejected";
        approvedTransformedImageUrl: string | null;
        processedAt: string;
      }>;
    }>;
  };
  options?: Array<{
    id: string;
    name: string;
    values: string[];
  }>;
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
export interface ApproveRejectImageParams {
  shop: string;
  productId: string;
  variantId: string;
  imageId: string;
  relightingImageId: number;
  action: "approve" | "reject";
  transformedImageUrl?: string;
}

export interface ApproveRejectProductParams {
  shop: string;
  productId: string;
  action: "approve" | "reject";
}

export interface ApproveRejectBulkParams {
  shop: string;
  productIds: string[];
  action: "approve" | "reject";
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

/**
 * Approve or reject a specific relighted image
 */
export const approveRejectImage = async (
  params: ApproveRejectImageParams
): Promise<{ success: boolean; message: string }> => {
  if (!params.shop) {
    throw new Error("Shop parameter is required");
  }

  const normalizedShop = params.shop.replace(".myshopify.com", "");
  const url = `${API_BASE_URL}/api/nulight/images/${params.action}`;

  try {
    let headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (typeof window !== "undefined" && (window as any).__APP_BRIDGE) {
      try {
        const { authenticatedFetch } = await import(
          "@shopify/app-bridge-utils"
        );
        const appBridge = (window as any).__APP_BRIDGE;
        const fetchFn = authenticatedFetch(appBridge);

        const response = await fetchFn(url, {
          method: "POST",
          headers,
          credentials: "same-origin",
          body: JSON.stringify({
            shop: normalizedShop,
            productId: params.productId,
            variantId: params.variantId,
            imageId: params.imageId,
            relightingImageId: params.relightingImageId,
            transformedImageUrl: params.transformedImageUrl,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message || `Failed to ${params.action} image: ${response.statusText}`
          );
        }

        return await response.json();
      } catch (error) {
        console.warn("[NulightAPI] Failed to approve/reject with authenticated fetch:", error);
        throw error;
      }
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      credentials: "same-origin",
      body: JSON.stringify({
        shop: normalizedShop,
        productId: params.productId,
        variantId: params.variantId,
        imageId: params.imageId,
        relightingImageId: params.relightingImageId,
        transformedImageUrl: params.transformedImageUrl,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to ${params.action} image: ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`[NulightAPI] Failed to ${params.action} image:`, error);
    throw error;
  }
};

/**
 * Approve or reject all images for a product
 */
export const approveRejectProduct = async (
  params: ApproveRejectProductParams
): Promise<{ success: boolean; message: string }> => {
  if (!params.shop) {
    throw new Error("Shop parameter is required");
  }

  const normalizedShop = params.shop.replace(".myshopify.com", "");
  const url = `${API_BASE_URL}/api/nulight/products/${params.action}`;

  try {
    let headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (typeof window !== "undefined" && (window as any).__APP_BRIDGE) {
      try {
        const { authenticatedFetch } = await import(
          "@shopify/app-bridge-utils"
        );
        const appBridge = (window as any).__APP_BRIDGE;
        const fetchFn = authenticatedFetch(appBridge);

        const response = await fetchFn(url, {
          method: "POST",
          headers,
          credentials: "same-origin",
          body: JSON.stringify({
            shop: normalizedShop,
            productId: params.productId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message || `Failed to ${params.action} product: ${response.statusText}`
          );
        }

        return await response.json();
      } catch (error) {
        console.warn("[NulightAPI] Failed to approve/reject product with authenticated fetch:", error);
        throw error;
      }
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      credentials: "same-origin",
      body: JSON.stringify({
        shop: normalizedShop,
        productId: params.productId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to ${params.action} product: ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`[NulightAPI] Failed to ${params.action} product:`, error);
    throw error;
  }
};

/**
 * Approve or reject all products (bulk action)
 */
export const approveRejectBulk = async (
  params: ApproveRejectBulkParams
): Promise<{ success: boolean; message: string; processed: number }> => {
  if (!params.shop) {
    throw new Error("Shop parameter is required");
  }

  const normalizedShop = params.shop.replace(".myshopify.com", "");
  const url = `${API_BASE_URL}/api/nulight/bulk/${params.action}`;

  try {
    let headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (typeof window !== "undefined" && (window as any).__APP_BRIDGE) {
      try {
        const { authenticatedFetch } = await import(
          "@shopify/app-bridge-utils"
        );
        const appBridge = (window as any).__APP_BRIDGE;
        const fetchFn = authenticatedFetch(appBridge);

        const response = await fetchFn(url, {
          method: "POST",
          headers,
          credentials: "same-origin",
          body: JSON.stringify({
            shop: normalizedShop,
            productIds: params.productIds,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message || `Failed to ${params.action} products: ${response.statusText}`
          );
        }

        return await response.json();
      } catch (error) {
        console.warn("[NulightAPI] Failed to bulk approve/reject with authenticated fetch:", error);
        throw error;
      }
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      credentials: "same-origin",
      body: JSON.stringify({
        shop: normalizedShop,
        productIds: params.productIds,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to ${params.action} products: ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`[NulightAPI] Failed to bulk ${params.action}:`, error);
    throw error;
  }
};

