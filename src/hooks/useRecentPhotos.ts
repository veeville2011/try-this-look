import { useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchRecentPhotosThunk } from "@/store/slices/recentPhotosSlice";
import type { StoreInfo } from "@/utils/shopifyIntegration";

interface UseRecentPhotosParams {
  customerEmail?: string | null;
  storeInfo?: StoreInfo | null;
  forceRefresh?: boolean;
}

/**
 * Custom hook to manage recent photos with Redux
 * Automatically fetches recent photos when email or storeInfo changes
 * Uses caching to avoid unnecessary API calls
 */
export const useRecentPhotos = ({
  customerEmail,
  storeInfo,
  forceRefresh = false,
}: UseRecentPhotosParams) => {
  const dispatch = useAppDispatch();
  
  const photos = useAppSelector((state) => state.recentPhotos.photos);
  const loading = useAppSelector((state) => state.recentPhotos.loading);
  const error = useAppSelector((state) => state.recentPhotos.error);
  const loadingPhotoIdsArray = useAppSelector((state) => state.recentPhotos.loadingPhotoIds);
  
  // Convert array to Set for efficient lookups in components
  const loadingPhotoIds = useMemo(() => new Set(loadingPhotoIdsArray), [loadingPhotoIdsArray]);

  useEffect(() => {
    // Don't fetch if no email
    if (!customerEmail) {
      return;
    }

    const shopDomain = storeInfo?.shopDomain || storeInfo?.domain || null;

    // Dispatch fetch action
    dispatch(
      fetchRecentPhotosThunk({
        email: customerEmail,
        shopDomain,
        forceRefresh,
      })
    );
  }, [customerEmail, storeInfo?.shopDomain, storeInfo?.domain, forceRefresh, dispatch]);

  return {
    photos,
    loading,
    error,
    loadingPhotoIds,
  };
};

