export interface VideoGenerationRecord {
  id: string;
  requestId: string;
  clothingImageUrl: string;
  generatedImageUrl: string;
  generatedVideoUrl: string;
  generatedVideoKey: string;
  status: "completed" | "failed" | "processing";
  errorMessage: string;
  processingTime: string;
  fileSize: string;
  mimeType: string;
  userAgent: string;
  ipAddress: string;
  name: string;
  email: string;
  storeName: string;
  clothingKey: string;
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

