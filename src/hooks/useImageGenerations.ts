import { useEffect, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchImageGenerationsThunk,
  clearError,
  clearRecords,
} from "@/store/slices/imageGenerationsSlice";
import type { FetchImageGenerationsParams } from "@/types/imageGenerations";

export const useImageGenerations = (autoFetch = false, params?: FetchImageGenerationsParams) => {
  const dispatch = useAppDispatch();
  const { records, pagination, loading, error, lastFetchParams } = useAppSelector(
    (state) => state.imageGenerations
  );

  useEffect(() => {
    if (autoFetch) {
      dispatch(fetchImageGenerationsThunk(params));
    }
  }, [autoFetch, dispatch, params]);

  const fetchGenerations = useCallback(
    (fetchParams?: FetchImageGenerationsParams) => {
      return dispatch(fetchImageGenerationsThunk(fetchParams || params));
    },
    [dispatch, params]
  );

  const handleClearError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  const handleClearRecords = useCallback(() => {
    dispatch(clearRecords());
  }, [dispatch]);

  return {
    records,
    pagination,
    loading,
    error,
    lastFetchParams,
    fetchGenerations,
    clearError: handleClearError,
    clearRecords: handleClearRecords,
  };
};

