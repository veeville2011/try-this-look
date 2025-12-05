import { ProductImage } from "./tryon";

/**
 * Mode for Cart/Outfit widget
 */
export type CartOutfitMode = "cart" | "outfit";

/**
 * Selected garment with metadata
 */
export interface SelectedGarment extends ProductImage {
  type?: string; // Garment type (shirt, pants, etc.) - for Outfit mode
}

/**
 * Cart API Response - Individual result for each garment
 */
export interface CartResult {
  index: number;
  garmentKey: string | null;
  status: "success" | "error";
  image?: string; // Base64 data URL
  imageUrl?: string; // S3 URL
  garmentImageUrl?: string | null;
  cached: boolean;
  creditsDeducted: number;
  processingTime: number;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Cart API Response - Complete response structure
 */
export interface CartResponse {
  success: boolean;
  results: CartResult[];
  summary: {
    totalGarments: number;
    successful: number;
    failed: number;
    cached: number;
    generated: number;
    totalCreditsDeducted: number;
    processingTime: number;
  };
  requestId: string;
}

/**
 * Outfit API Response
 */
export interface OutfitResponse {
  success: boolean;
  data: {
    image: string; // Base64 data URL
    imageUrl: string | null;
    personImageUrl: string | null;
    garmentImageUrls: string[];
    garmentTypes: string[] | null;
    cached: boolean;
    creditsDeducted: number;
    requestId: string;
    processingTime: number;
  };
}

/**
 * Error response structure
 */
export interface CartOutfitError {
  code: string;
  message: string;
  details?: {
    reason?: string;
    creditBalance?: number;
    creditBreakdown?: {
      trial: number;
      coupon: number;
      plan: number;
      purchased: number;
      total: number;
    };
    receivedCount?: number;
    minGarments?: number;
    maxGarments?: number;
  };
}

/**
 * Unified error response
 */
export interface CartOutfitErrorResponse {
  error: CartOutfitError;
}

/**
 * Progress state for batch operations
 */
export interface BatchProgress {
  total: number;
  completed: number;
  failed: number;
  currentIndex?: number;
  estimatedTimeRemaining?: number; // milliseconds
}

/**
 * Configuration for Cart/Outfit widget
 */
export interface CartOutfitConfig {
  buttonText?: string;
  buttonPosition?: "cart" | "product" | "custom";
  defaultMode?: CartOutfitMode;
  enableCartMode?: boolean;
  enableOutfitMode?: boolean;
  maxCartItems?: number;
  maxOutfitItems?: number;
  minOutfitItems?: number;
  autoDetectGarmentTypes?: boolean;
}

/**
 * Garment type options for Outfit mode
 */
export const GARMENT_TYPES = [
  "shirt",
  "pants",
  "shorts",
  "dress",
  "jacket",
  "sweater",
  "cap",
  "hat",
  "shoes",
  "boots",
  "accessories",
  "belt",
  "bag",
  "scarf",
] as const;

export type GarmentType = (typeof GARMENT_TYPES)[number];

/**
 * Garment type mapping for auto-detection
 */
export const GARMENT_TYPE_KEYWORDS: Record<GarmentType, string[]> = {
  shirt: ["shirt", "t-shirt", "tshirt", "blouse", "top", "tee"],
  pants: ["pants", "trousers", "jeans", "slacks"],
  shorts: ["shorts", "short"],
  dress: ["dress", "gown", "frock"],
  jacket: ["jacket", "coat", "blazer"],
  sweater: ["sweater", "pullover", "jumper", "cardigan"],
  cap: ["cap", "baseball cap"],
  hat: ["hat", "beanie", "beret"],
  shoes: ["shoes", "sneakers", "trainers", "footwear"],
  boots: ["boots", "boot"],
  accessories: ["accessories", "jewelry", "watch"],
  belt: ["belt", "waistband"],
  bag: ["bag", "handbag", "purse", "backpack"],
  scarf: ["scarf", "shawl"],
};

