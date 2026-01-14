export interface AddToCartInfo {
  hasCartEvents: boolean;
  totalEvents?: number;
  firstEventAt?: string;
  lastEventAt?: string;
  actionTypes?: string[];
  actionTypeCounts?: Record<string, number>;
  events?: Array<{
    cartEventId: string;
    actionType: string;
    addedAt: string;
  }>;
  productId?: string;
  variantId?: string;
}

export interface ImageGenerationRecord {
  id: string;
  requestId: string;
  personImageUrl: string;
  clothingImageUrl: string;
  generatedImageUrl: string;
  generatedImageKey: string;
  status: "pending" | "processing" | "completed" | "failed";
  errorMessage: string | null;
  processingTime: string;
  fileSize: string;
  mimeType: string;
  userAgent: string;
  ipAddress: string;
  name: string;
  email: string;
  storeName: string;
  clothingKey: string;
  personKey: string;
  customerEmail: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  createdAt: string;
  updatedAt: string;
  addToCartInfo?: AddToCartInfo;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ImageGenerationsResponse {
  status: string;
  data: {
    records: ImageGenerationRecord[];
    pagination: PaginationInfo;
  };
}

export interface FetchImageGenerationsParams {
  page?: number;
  limit?: number;
  status?: "pending" | "processing" | "completed" | "failed";
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
  user?: string;
  storeName?: string;
  startDate?: string;
  endDate?: string;
}

