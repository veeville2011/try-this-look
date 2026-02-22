import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import {
  fetchCustomerImageHistory,
  type ImageGenerationHistoryItem,
} from "@/services/tryonApi";

export interface RecentPhoto {
  id: string;
  src: string;
  personBbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
    imageWidth: number;
    imageHeight: number;
  } | null;
}

interface RecentPhotosState {
  photos: RecentPhoto[];
  loading: boolean;
  error: string | null;
  // Cache key: email + shopDomain combination
  cacheKey: string | null;
  // Timestamp when data was last fetched
  lastFetched: number | null;
  // Loading state for individual photos (array for Redux compatibility)
  loadingPhotoIds: string[];
}

const initialState: RecentPhotosState = {
  photos: [],
  loading: false,
  error: null,
  cacheKey: null,
  lastFetched: null,
  loadingPhotoIds: [],
};

// Cache duration: 5 minutes (300000 ms)
const CACHE_DURATION_MS = 5 * 60 * 1000;

/**
 * Generate cache key from email and shopDomain
 */
const generateCacheKey = (email: string, shopDomain: string | null): string => {
  return `${email}:${shopDomain || 'no-shop'}`;
};

/**
 * Check if cached data is still valid
 */
const isCacheValid = (
  cacheKey: string | null,
  currentCacheKey: string,
  lastFetched: number | null
): boolean => {
  if (cacheKey !== currentCacheKey) {
    return false; // Different cache key, invalid
  }
  if (!lastFetched) {
    return false; // Never fetched, invalid
  }
  const now = Date.now();
  return (now - lastFetched) < CACHE_DURATION_MS; // Check if within cache duration
};

interface FetchRecentPhotosParams {
  email: string;
  shopDomain?: string | null;
  forceRefresh?: boolean; // Force refresh even if cache is valid
}

export const fetchRecentPhotosThunk = createAsyncThunk(
  "recentPhotos/fetch",
  async (
    params: FetchRecentPhotosParams,
    { getState, rejectWithValue }
  ) => {
    try {
      const state = getState() as { recentPhotos: RecentPhotosState };
      const { recentPhotos } = state;

      const currentCacheKey = generateCacheKey(params.email, params.shopDomain || null);

      // Check if we should skip API call (cache is valid and not forcing refresh)
      if (!params.forceRefresh && isCacheValid(recentPhotos.cacheKey, currentCacheKey, recentPhotos.lastFetched)) {
        // Return cached data without making API call
        return {
          photos: recentPhotos.photos,
          cacheKey: currentCacheKey,
          fromCache: true,
        };
      }

      // Make API call
      const response = await fetchCustomerImageHistory(
        params.email,
        1,
        20, // Fetch more to ensure we get 5 unique person images
        params.shopDomain || undefined
      );

      if (!response.success || !Array.isArray(response.data)) {
        return rejectWithValue(
          response.message || "Failed to fetch recent photos"
        );
      }

      // Extract unique person images from history
      const seenUrls = new Set<string>();
      const photos: RecentPhoto[] = response.data
        .map((item: ImageGenerationHistoryItem) => {
          if (!item || !item.id || !item.personImageUrl) {
            return null;
          }
          return {
            id: item.id,
            src: item.personImageUrl,
            personBbox: item.personBbox || null,
          };
        })
        .filter((item): item is RecentPhoto => {
          if (!item) return false;
          // Check if we've already seen this image URL
          if (seenUrls.has(item.src)) {
            return false; // Skip duplicate
          }
          seenUrls.add(item.src); // Mark as seen
          return true;
        })
        .slice(0, 5); // Limit to 5 unique recent photos

      return {
        photos,
        cacheKey: currentCacheKey,
        fromCache: false,
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error
          ? error.message
          : "Failed to fetch recent photos"
      );
    }
  }
);

const recentPhotosSlice = createSlice({
  name: "recentPhotos",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearRecentPhotos: (state) => {
      state.photos = [];
      state.cacheKey = null;
      state.lastFetched = null;
      state.loadingPhotoIds = new Set();
    },
    setLoadingPhotoId: (state, action: PayloadAction<{ id: string; loading: boolean }>) => {
      if (action.payload.loading) {
        if (!state.loadingPhotoIds.includes(action.payload.id)) {
          state.loadingPhotoIds.push(action.payload.id);
        }
      } else {
        state.loadingPhotoIds = state.loadingPhotoIds.filter(id => id !== action.payload.id);
      }
    },
    setLoadingPhotoIds: (state, action: PayloadAction<string[]>) => {
      state.loadingPhotoIds = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRecentPhotosThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchRecentPhotosThunk.fulfilled,
        (state, action) => {
          state.loading = false;
          state.error = null;
          
          // Only update if not from cache (to avoid unnecessary re-renders)
          if (!action.payload.fromCache) {
            state.photos = action.payload.photos;
            state.cacheKey = action.payload.cacheKey;
            state.lastFetched = Date.now();
            
            // Initialize loading state for all photos
            state.loadingPhotoIds = action.payload.photos.map(p => p.id);
          }
        }
      )
      .addCase(fetchRecentPhotosThunk.rejected, (state, action) => {
        state.loading = false;
        state.error =
          typeof action.payload === "string"
            ? action.payload
            : "Failed to fetch recent photos";
      });
  },
});

export const {
  clearError,
  clearRecentPhotos,
  setLoadingPhotoId,
  setLoadingPhotoIds,
} = recentPhotosSlice.actions;

export default recentPhotosSlice.reducer;

