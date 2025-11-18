export interface VideoGenerationRecord {
  id: string;
  requestId: string;
  clothingImageUrl: string;
  generatedImageUrl: string;
  generatedVideoUrl: string;
  generatedVideoKey: string;
  status: "completed" | "failed" | "processing";
  errorMessage: string | null;
  processingTime: string | null;
  fileSize: string | null;
  mimeType: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  name: string | null;
  email: string | null;
  storeName: string | null;
  clothingKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationInfo {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface VideoGenerationsResponse {
  status: string;
  data: {
    records: VideoGenerationRecord[];
    pagination: PaginationInfo;
  };
}

export interface FetchVideoGenerationsParams {
  page?: number;
  limit?: number;
  status?: "completed" | "failed" | "processing";
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
  user?: string;
}

