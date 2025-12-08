const API_BASE_URL = import.meta.env.VITE_API_ENDPOINT || "";

export interface NusceneVideoImage {
  id: string;
  originalImageUrl: string;
  original_url: string;
  altText: string | null;
  width: number | null;
  height: number | null;
  
  // Video Generation API Response Fields
  video_id: number;
  videoId: number;
  status: "processing" | "completed" | "failed";
  videoStatus: "processing" | "completed" | "failed";
  external_job_id: string | null;
  job_id: string | null;
  video_url: string | null;
  videoUrl: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  aspect_ratio: "16:9" | "9:16" | null;
  resolution: "720p" | "1080p" | null;
  prompt: string | null;
  created_at: string | null;
  completed_at: string | null;
  message: string | null;
  status_url: string | null;
  estimated_time: string | null;
  
  // Cache Information
  cached: boolean;
  
  // Approval Workflow
  approvalStatus: "pending" | "approved" | "rejected";
  approvedVideoUrl: string | null;
  
  // Metadata
  processedAt: string;
  error?: string;
}

export interface NusceneProduct {
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
  publishedAt: string | null;
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
  media: {
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
      media: {
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
      selectedOptions: Array<{
        name: string;
        value: string;
      }>;
      images: NusceneVideoImage[];
    }>;
  };
  options?: Array<{
    id: string;
    name: string;
    values: string[];
  }>;
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
  _cached?: boolean;
  _cachedAt?: string;
}

export interface NuscenePageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface NusceneFilters {
  createdToday: string;
  status: string;
  limit: number;
}

export interface NusceneResponse {
  success: boolean;
  message: string;
  data: {
    products: NusceneProduct[];
    total: number;
    pageInfo: NuscenePageInfo;
    filters: NusceneFilters;
  };
}

export interface FetchNusceneProductsParams {
  shop: string;
  after?: string;
}

export interface ApproveRejectVideoParams {
  shop: string;
  productId: string;
  variantId: string;
  imageId: string;
  videoId: number;
  action: "approve" | "reject";
  videoUrl?: string;
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
 * Fetch nuscene products (products created today with ACTIVE status)
 * This requires authentication via session token
 */
export const fetchNusceneProducts = async (
  params: FetchNusceneProductsParams
): Promise<NusceneResponse> => {
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

  const url = `${API_BASE_URL}/api/nuscene?${queryParams.toString()}`;

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
            errorData.message || `Failed to fetch nuscene products: ${response.statusText}`
          );
        }

        const data: NusceneResponse = await response.json();
        return data;
      } catch (error) {
        console.warn("[NusceneAPI] Failed to fetch with authenticated fetch:", error);
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
        errorData.message || `Failed to fetch nuscene products: ${response.statusText}`
      );
    }

    const data: NusceneResponse = await response.json();
    return data;
  } catch (error) {
    console.error("[NusceneAPI] Failed to fetch nuscene products:", error);
    throw error;
  }
};

/**
 * Approve or reject a specific video
 */
export const approveRejectVideo = async (
  params: ApproveRejectVideoParams
): Promise<{ success: boolean; message: string }> => {
  if (!params.shop) {
    throw new Error("Shop parameter is required");
  }

  const normalizedShop = params.shop.replace(".myshopify.com", "");
  const url = `${API_BASE_URL}/api/nuscene/videos/${params.action}`;

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
            videoId: params.videoId,
            videoUrl: params.videoUrl,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message || `Failed to ${params.action} video: ${response.statusText}`
          );
        }

        return await response.json();
      } catch (error) {
        console.warn("[NusceneAPI] Failed to approve/reject with authenticated fetch:", error);
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
        videoId: params.videoId,
        videoUrl: params.videoUrl,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || `Failed to ${params.action} video: ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`[NusceneAPI] Failed to ${params.action} video:`, error);
    throw error;
  }
};

/**
 * Approve or reject all videos for a product
 */
export const approveRejectProduct = async (
  params: ApproveRejectProductParams
): Promise<{ success: boolean; message: string }> => {
  if (!params.shop) {
    throw new Error("Shop parameter is required");
  }

  const normalizedShop = params.shop.replace(".myshopify.com", "");
  const url = `${API_BASE_URL}/api/nuscene/products/${params.action}`;

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
        console.warn("[NusceneAPI] Failed to approve/reject product with authenticated fetch:", error);
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
    console.error(`[NusceneAPI] Failed to ${params.action} product:`, error);
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
  const url = `${API_BASE_URL}/api/nuscene/bulk/${params.action}`;

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
        console.warn("[NusceneAPI] Failed to bulk approve/reject with authenticated fetch:", error);
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
    console.error(`[NusceneAPI] Failed to bulk ${params.action}:`, error);
    throw error;
  }
};

