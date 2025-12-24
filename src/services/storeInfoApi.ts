const API_BASE_URL = "https://try-on-server-v1.onrender.com/api";

export interface StoreInfoParams {
  shop: string;
}

export interface StoreInfoData {
  shop: string;
  name?: string | null; // Shopify store name (business name)
  shopName?: string | null; // Shopify store name (business name)
  accessToken: string | null;
  scope: string;
  isOnline: boolean;
  expires: string | null;
  sessionId: string | null;
  state: string | null;
  apiKey: string | null;
  appUrl: string | null;
  installedAt: string;
  uninstalledAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoreInfoResponse {
  success: boolean;
  message: string;
  data?: StoreInfoData;
  error?: string;
}

export const fetchStoreInfo = async (
  params: StoreInfoParams
): Promise<StoreInfoResponse> => {
  const { shop } = params;

  if (!shop) {
    return {
      success: false,
      message: "Shop parameter is required",
      error: "Validation Error",
    };
  }

  // Normalize shop domain (accepts both "example" and "example.myshopify.com")
  const normalizedShop = shop.includes(".myshopify.com")
    ? shop.toLowerCase()
    : `${shop.toLowerCase()}.myshopify.com`;

  const queryParams = new URLSearchParams({
    shop: normalizedShop,
  });

  const url = `${API_BASE_URL}/stores?${queryParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        message:
          errorData.message ||
          `HTTP ${response.status}: ${response.statusText}`,
        error: errorData.error || "Request Failed",
      };
    }

    const data: StoreInfoResponse = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch store info",
      error: "Network Error",
    };
  }
};

