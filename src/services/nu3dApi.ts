const API_BASE_URL = import.meta.env.VITE_API_ENDPOINT || "";

export interface Nu3dProduct {
  id: string;
  title: string;
  handle: string;
  description: string;
  vendor: string;
  productType: string;
  status: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
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
      price: string;
      availableForSale: boolean;
      inventoryQuantity: number | null;
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
        // Nu3D API Response Fields
        image_id: number;
        status: "completed" | "processing" | "failed";
        job_id: string;
        gaussian_splat_url: string | null;
        model_glb_url: string | null;
        original_url: string | null;
        metadata: Array<{
          scale: number[][];
          rotation: number[][];
          translation: number[][];
          camera_pose: any;
          object_index: number;
        }>;
        message: string | null;
        // Backward compatibility fields
        model3dUrl: string | null;
        model3dStatus: "completed" | "processing" | "failed";
        model3dImageId: number;
        // Additional fields
        cached: boolean;
        approvalStatus: "pending" | "approved" | "rejected";
        approvedModel3dUrl: string | null;
        processedAt: string;
      }>;
    }>;
  };
}

export interface Nu3dPageInfo {
  hasNextPage: boolean;
  endCursor: string | null;
}

export interface Nu3dFilters {
  createdToday: string;
  status: string;
  limit: number;
}

export interface Nu3dResponse {
  success: boolean;
  message: string;
  data: {
    products: Nu3dProduct[];
    total: number;
    pageInfo: Nu3dPageInfo;
    filters: Nu3dFilters;
  };
}

export interface FetchNu3dProductsParams {
  shop: string;
  after?: string;
}

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
 * Fetch nu3d products (products created today with ACTIVE status)
 * This requires authentication via session token
 */
export const fetchNu3dProducts = async (
  params: FetchNu3dProductsParams
): Promise<Nu3dResponse> => {
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

  const url = `${API_BASE_URL}/api/nu3d?${queryParams.toString()}`;

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
            errorData.message || `Failed to fetch nu3d products: ${response.statusText}`
          );
        }

        const data: Nu3dResponse = await response.json();
        return data;
      } catch (error) {
        console.warn("[Nu3dAPI] Failed to fetch with authenticated fetch:", error);
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
        errorData.message || `Failed to fetch nu3d products: ${response.statusText}`
      );
    }

    const data: Nu3dResponse = await response.json();
    return data;
  } catch (error) {
    console.error("[Nu3dAPI] Failed to fetch nu3d products:", error);
    throw error;
  }
};

/**
 * Approve or reject a specific 3D model image
 */
export const approveRejectImage = async (
  params: ApproveRejectImageParams
): Promise<{ success: boolean; message: string }> => {
  if (!params.shop) {
    throw new Error("Shop parameter is required");
  }

  const normalizedShop = params.shop.replace(".myshopify.com", "");
  const url = `${API_BASE_URL}/api/nu3d/images/${params.action}`;

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
        console.warn("[Nu3dAPI] Failed to approve/reject with authenticated fetch:", error);
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
    console.error(`[Nu3dAPI] Failed to ${params.action} image:`, error);
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
  const url = `${API_BASE_URL}/api/nu3d/products/${params.action}`;

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
        console.warn("[Nu3dAPI] Failed to approve/reject product with authenticated fetch:", error);
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
    console.error(`[Nu3dAPI] Failed to ${params.action} product:`, error);
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
  const url = `${API_BASE_URL}/api/nu3d/bulk/${params.action}`;

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
        console.warn("[Nu3dAPI] Failed to bulk approve/reject with authenticated fetch:", error);
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
    console.error(`[Nu3dAPI] Failed to bulk ${params.action}:`, error);
    throw error;
  }
};

