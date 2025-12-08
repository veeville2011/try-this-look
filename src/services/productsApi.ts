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
  message?: string;
  data?: {
    products?: ProductImage[];
    total?: number;
    pagesFetched?: number;
    filters?: {
      query?: string;
      limitPerPage?: number;
    };
  };
  // Legacy format support
  products?: ProductImage[];
  count?: number;
}

/**
 * Fetch all products with images from the store
 * This requires authentication via session token
 */
export const fetchAllStoreProducts = async (
  shop: string,
  options?: {
    status?: string;
    productType?: string;
    limit?: number;
  }
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

  // Add optional query parameters
  if (options?.status) {
    queryParams.append("status", options.status);
  }
  if (options?.productType) {
    queryParams.append("productType", options.productType);
  }
  if (options?.limit) {
    queryParams.append("limit", String(options.limit));
  }

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
        // Handle nested response structure with optional chaining
        const products = data?.data?.products ?? data?.products ?? [];
        const count = data?.data?.total ?? data?.count ?? products.length;
        
        return {
          success: data?.success ?? false,
          message: data?.message,
          data: data?.data,
          products,
          count,
        };
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
    // Handle nested response structure with optional chaining
    const products = data?.data?.products ?? data?.products ?? [];
    const count = data?.data?.total ?? data?.count ?? products.length;
    
    return {
      success: data?.success ?? false,
      message: data?.message,
      data: data?.data,
      products,
      count,
    };
  } catch (error) {
    console.error("[ProductsAPI] Failed to fetch products:", error);
    return {
      success: false,
      products: [],
      count: 0,
    };
  }
};

// Types for Categorized Products API
export interface CategorizedProduct {
  id: string;
  title: string;
  handle: string;
  vendor: string;
  productType: string;
  tags: string[];
  status: string;
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
  media: {
    nodes: Array<{
      image?: {
        url: string;
        altText?: string | null;
      };
    }>;
  };
  onlineStoreUrl: string | null;
  collections: {
    nodes: Array<{
      id: string;
      title: string;
      handle: string;
    }>;
  };
  category: {
    id: string;
    fullName: string;
    name: string;
  } | null;
}

export interface Category {
  categoryId: string | null;
  categoryName: string;
  categoryHandle: string | null;
  productCount: number;
  products: CategorizedProduct[];
}

export interface UncategorizedProducts {
  categoryName: string;
  productCount: number;
  products: CategorizedProduct[];
}

export interface CategorizedProductsResponse {
  success: boolean;
  message?: string;
  data?: {
    categoryMethod: string;
    categories: Category[];
    uncategorized: UncategorizedProducts;
    pagination: {
      hasNextPage: boolean;
      endCursor: string | null;
      totalProducts: number;
    };
    statistics: {
      totalCategories: number;
      totalProducts: number;
      categorizedProducts: number;
      uncategorizedProducts: number;
    };
  };
  error?: string;
}

/**
 * Fetch categorized products from the store
 * Groups products by collections, productType, vendor, tags, or category
 */
export const fetchCategorizedProducts = async (
  shop: string,
  options?: {
    categoryBy?: "collections" | "productType" | "vendor" | "tags" | "category" | "title";
    after?: string;
    limit?: number;
  }
): Promise<CategorizedProductsResponse> => {
  if (!shop) {
    return {
      success: false,
      error: "Missing shop parameter",
    };
  }

  // Normalize shop domain (remove .myshopify.com if present, API will handle it)
  const normalizedShop = shop.replace(".myshopify.com", "").toLowerCase();

  const queryParams = new URLSearchParams({
    shop: normalizedShop,
  });

  // Add optional query parameters
  if (options?.categoryBy) {
    queryParams.append("categoryBy", options.categoryBy);
  }
  if (options?.after) {
    queryParams.append("after", options.after);
  }
  if (options?.limit) {
    queryParams.append("limit", String(options.limit));
  }

  const url = `${API_BASE_URL}/api/categorized-products?${queryParams.toString()}`;

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
            error: errorData.message || "Failed to fetch categorized products",
          };
        }

        const data: CategorizedProductsResponse = await response.json();
        return data;
      } catch (error) {
        console.warn("[ProductsAPI] Failed to fetch categorized products with authenticated fetch:", error);
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
        error: errorData.message || "Failed to fetch categorized products",
      };
    }

    const data: CategorizedProductsResponse = await response.json();
    return data;
  } catch (error) {
    console.error("[ProductsAPI] Failed to fetch categorized products:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

