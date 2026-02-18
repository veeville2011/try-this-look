/**
 * Try-On API V1 Service
 * 
 * Implements the Storefront Widget API as per:
 * https://dev.karthikramesh.com/api/docs/tryon
 * 
 * This service is used ONLY by V1 components in testComponents folder.
 * Original components continue to use the existing tryonApi.ts service.
 */

// API Base URL from documentation
const API_BASE_URL = 'https://dev.karthikramesh.com';

// Session management
let sessionId: string | null = null;
let vendorApiKey: string | null = null;

/**
 * Get or generate session ID
 */
export const getSessionId = async (): Promise<string> => {
  if (sessionId) {
    return sessionId;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/session/generate-id`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to generate session ID: HTTP ${response.status}`);
    }

    const data = await response.json();
    sessionId = data.session_id;
    
    // Store in sessionStorage for persistence
    if (typeof window !== 'undefined' && sessionId) {
      sessionStorage.setItem('nusense_v1_session_id', sessionId);
    }

    return sessionId;
  } catch (error) {
    console.error('[TryOnApiV1] Failed to generate session ID:', error);
    throw error;
  }
};

/**
 * Initialize session ID from storage if available
 */
export const initializeSessionId = (): void => {
  if (typeof window !== 'undefined' && !sessionId) {
    const stored = sessionStorage.getItem('nusense_v1_session_id');
    if (stored) {
      sessionId = stored;
    }
  }
};

/**
 * Set vendor API key (should be set from server-side or config)
 */
export const setVendorApiKey = (key: string): void => {
  vendorApiKey = key;
};

/**
 * Get vendor API key (from config or environment)
 */
const getVendorApiKey = (): string => {
  if (vendorApiKey) {
    return vendorApiKey;
  }

  // Try to get from window config (set by parent page or server)
  if (typeof window !== 'undefined' && (window as any).NUSENSE_CONFIG?.vendorApiKey) {
    return (window as any).NUSENSE_CONFIG.vendorApiKey;
  }

  // Try environment variable
  const envKey = import.meta.env.VITE_VENDOR_API_KEY;
  if (envKey) {
    return envKey;
  }

  throw new Error('Vendor API key not found. Please set it via setVendorApiKey() or NUSENSE_CONFIG.vendorApiKey');
};

/**
 * Authenticated fetch with required headers
 */
const authenticatedFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const apiKey = getVendorApiKey();
  const currentSessionId = await getSessionId();

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${apiKey}`);
  headers.set('X-Session-ID', currentSessionId);
  headers.set('Accept', 'application/json');

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...options,
    headers,
    mode: 'cors',
    credentials: 'omit',
  });
};

// ============================================================================
// Session Management
// ============================================================================

export interface SessionStartParams {
  session_id: string;
  referrer?: string;
  landing_page?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

export interface SessionStartResponse {
  customer_id: number;
  session_id: string;
  is_authenticated: boolean;
  is_new_customer: boolean;
  message: string;
}

/**
 * Start a customer session (creates guest customer if needed)
 */
export const startSession = async (params: SessionStartParams): Promise<SessionStartResponse> => {
  const response = await authenticatedFetch(`${API_BASE_URL}/session/start`, {
    method: 'POST',
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to start session' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
};

export interface SessionIdentifyParams {
  session_id: string;
  email: string;
  auth_provider: 'google' | 'facebook' | 'apple' | 'shop_pay' | 'shopify_email' | 'multipass' | 'oidc';
  first_name?: string;
  last_name?: string;
}

export interface SessionIdentifyResponse {
  customer_id: number;
  session_id: string;
  message: string;
}

/**
 * Link session to an authenticated customer (after Shopify OAuth)
 */
export const identifySession = async (params: SessionIdentifyParams): Promise<SessionIdentifyResponse> => {
  const response = await authenticatedFetch(`${API_BASE_URL}/session/identify`, {
    method: 'POST',
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to identify session' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
};

export interface CustomerMeResponse {
  customer_id: number;
  email?: string;
  display_name?: string;
  is_guest: boolean;
  total_sessions: number;
  total_interactions: number;
}

/**
 * Get current customer profile
 */
export const getCustomerMe = async (): Promise<CustomerMeResponse> => {
  const response = await authenticatedFetch(`${API_BASE_URL}/customer/me`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to get customer info' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
};

/**
 * End session (on page unload or logout)
 */
export const endSession = async (): Promise<void> => {
  try {
    await authenticatedFetch(`${API_BASE_URL}/session/end`, {
      method: 'POST',
    });
  } catch (error) {
    console.warn('[TryOnApiV1] Failed to end session:', error);
    // Don't throw - session end is best effort
  } finally {
    sessionId = null;
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('nusense_v1_session_id');
    }
  }
};

// ============================================================================
// Virtual Try-On
// ============================================================================

export interface TryOnSubmitParams {
  person_image?: File | Blob;
  saved_photo_id?: string;
  garment_image?: File | Blob;
  product_image_url?: string;
  product_id?: string;
  product_title?: string;
  product_variant_id?: string;
  product_price?: string;
  product_url?: string;
  person_bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface TryOnSubmitResponse {
  image_id: string;
  tryon_id: string;
  status: 'pending';
}

/**
 * Submit a virtual try-on job
 * Returns immediately; poll status to get result
 */
export const submitTryOn = async (params: TryOnSubmitParams): Promise<TryOnSubmitResponse> => {
  const formData = new FormData();

  // Person image (either person_image or saved_photo_id required)
  if (params.person_image) {
    formData.append('person_image', params.person_image);
  } else if (params.saved_photo_id) {
    formData.append('saved_photo_id', params.saved_photo_id);
  } else {
    throw new Error('Either person_image or saved_photo_id is required');
  }

  // Garment image (either garment_image or product_image_url required)
  if (params.garment_image) {
    formData.append('garment_image', params.garment_image);
  } else if (params.product_image_url) {
    formData.append('product_image_url', params.product_image_url);
  } else {
    throw new Error('Either garment_image or product_image_url is required');
  }

  // Optional product information
  if (params.product_id) formData.append('product_id', params.product_id);
  if (params.product_title) formData.append('product_title', params.product_title);
  if (params.product_variant_id) formData.append('product_variant_id', params.product_variant_id);
  if (params.product_price) formData.append('product_price', params.product_price);
  if (params.product_url) formData.append('product_url', params.product_url);

  // Person bounding box (for group photo selection)
  if (params.person_bbox) {
    formData.append('person_bbox', JSON.stringify(params.person_bbox));
  }

  const response = await authenticatedFetch(`${API_BASE_URL}/tryon_webhook`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to submit try-on' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
};

export interface TryOnStatusResponse {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  image_id: string;
  tryon_id?: string;
  result_url?: string;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Poll try-on status until completion
 */
export const getTryOnStatus = async (imageId: string): Promise<TryOnStatusResponse> => {
  const response = await authenticatedFetch(`${API_BASE_URL}/tryon/status/${imageId}`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to get try-on status' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
};

/**
 * Poll try-on status until completion or failure
 */
export const pollTryOnStatus = async (
  imageId: string,
  maxAttempts: number = 200,
  pollInterval: number = 3000,
  onStatusUpdate?: (status: string) => void
): Promise<TryOnStatusResponse> => {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const status = await getTryOnStatus(imageId);

    if (onStatusUpdate && status.status) {
      onStatusUpdate(status.status);
    }

    if (status.status === 'completed') {
      return status;
    } else if (status.status === 'failed') {
      return status;
    } else if (status.status === 'pending' || status.status === 'processing') {
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } else {
        throw new Error('Try-on processing timeout');
      }
    } else {
      throw new Error(`Unknown status: ${status.status}`);
    }
  }

  throw new Error('Try-on processing timeout');
};

// ============================================================================
// Customer Photos
// ============================================================================

export interface UploadPhotoResponse {
  photo_id: string;
  url: string;
  created_at: string;
}

/**
 * Upload and save customer photo
 */
export const uploadCustomerPhoto = async (photo: File | Blob): Promise<UploadPhotoResponse> => {
  const formData = new FormData();
  formData.append('photo', photo);

  const response = await authenticatedFetch(`${API_BASE_URL}/customer/photos/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to upload photo' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
};

export interface CustomerPhoto {
  photo_id: string;
  url: string;
  created_at: string;
}

export interface CustomerPhotosResponse {
  photos: CustomerPhoto[];
}

/**
 * Get customer's saved photos
 */
export const getCustomerPhotos = async (): Promise<CustomerPhotosResponse> => {
  const response = await authenticatedFetch(`${API_BASE_URL}/customer/photos`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to get customer photos' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
};

// ============================================================================
// Try-On History
// ============================================================================

export interface TryOnHistoryItem {
  tryon_id: string;
  product_id?: string;
  product_title?: string;
  result_url: string;
  created_at: string;
}

export interface TryOnHistoryResponse {
  items: TryOnHistoryItem[];
}

/**
 * Get customer's try-on history
 */
export const getTryOnHistory = async (): Promise<TryOnHistoryResponse> => {
  const response = await authenticatedFetch(`${API_BASE_URL}/tryon/history`, {
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to get try-on history' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
};

// ============================================================================
// Activity Tracking
// ============================================================================

export interface ActivityTrackParams {
  activity_type: string;
  activity_data?: Record<string, any>;
}

/**
 * Track custom activity events
 */
export const trackActivity = async (params: ActivityTrackParams): Promise<void> => {
  const response = await authenticatedFetch(`${API_BASE_URL}/activity/track`, {
    method: 'POST',
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to track activity' }));
    console.warn('[TryOnApiV1] Failed to track activity:', error);
    // Don't throw - activity tracking is best effort
  }
};

// ============================================================================
// Shopify Pixel Integration
// ============================================================================

export interface PixelTrackParams {
  event_name: string;
  event_data?: Record<string, any>;
}

/**
 * Send events to Shopify Pixel
 */
export const trackPixel = async (params: PixelTrackParams): Promise<void> => {
  const response = await authenticatedFetch(`${API_BASE_URL}/tracking/pixel`, {
    method: 'POST',
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to track pixel event' }));
    console.warn('[TryOnApiV1] Failed to track pixel event:', error);
    // Don't throw - pixel tracking is best effort
  }
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert data URL to Blob
 */
export const dataURLToBlob = async (dataURL: string): Promise<Blob> => {
  const response = await fetch(dataURL);
  return response.blob();
};

/**
 * Convert Blob to data URL
 */
export const blobToDataURL = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Initialize session ID on module load
if (typeof window !== 'undefined') {
  initializeSessionId();
  
  // End session on page unload
  window.addEventListener('beforeunload', () => {
    endSession().catch(() => {
      // Ignore errors on unload
    });
  });
}

