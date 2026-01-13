export interface CartTrackingEvent {
  id?: string;
  storeName: string;
  actionType: "add_to_cart" | "buy_now";
  productId?: number | string | null;
  productTitle?: string | null;
  productUrl?: string | null;
  variantId?: number | string | null;
  customerEmail?: string | null;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  generatedImageUrl?: string | null;
  personImageUrl?: string | null;
  clothingImageUrl?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  sessionId?: string | null;
  createdAt?: string;
}

export interface TrackCartEventParams {
  storeName: string;
  actionType: "add_to_cart" | "buy_now";
  productId?: number | string | null;
  productTitle?: string | null;
  productUrl?: string | null;
  variantId?: number | string | null;
  customerId: string | number;
}

export interface TrackCartEventResponse {
  status: "success" | "error";
  message?: string;
  data?: {
    id: string;
    createdAt: string;
  };
  error?: string;
}

