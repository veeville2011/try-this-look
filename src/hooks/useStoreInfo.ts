import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchStoreInfoThunk,
  clearError,
  clearStoreInfo,
  setStoreInfo,
} from "@/store/slices/storeInfoSlice";
import type { StoreInfoParams, StoreInfoData } from "@/services/storeInfoApi";

export const useStoreInfo = () => {
  const dispatch = useAppDispatch();
  const { data, loading, error, lastFetchedShop } = useAppSelector(
    (state) => state.storeInfo
  );

  const fetchStoreInfo = useCallback(
    (params: StoreInfoParams) => {
      return dispatch(fetchStoreInfoThunk(params));
    },
    [dispatch]
  );

  const handleClearError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  const handleClearStoreInfo = useCallback(() => {
    dispatch(clearStoreInfo());
  }, [dispatch]);

  const handleSetStoreInfo = useCallback(
    (storeInfo: StoreInfoData) => {
      dispatch(setStoreInfo(storeInfo));
    },
    [dispatch]
  );

  return {
    storeInfo: data,
    loading,
    error,
    lastFetchedShop,
    fetchStoreInfo,
    clearError: handleClearError,
    clearStoreInfo: handleClearStoreInfo,
    setStoreInfo: handleSetStoreInfo,
  };
};

