import { useEffect, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchVideoGenerationsThunk,
  clearError,
  clearRecords,
} from "@/store/slices/videoGenerationsSlice";
import type { FetchVideoGenerationsParams } from "@/types/videoGenerations";

export const useVideoGenerations = (autoFetch = false, params?: FetchVideoGenerationsParams) => {
  const dispatch = useAppDispatch();
  const { records, pagination, loading, error, lastFetchParams } = useAppSelector(
    (state) => state.videoGenerations
  );

  useEffect(() => {
    if (autoFetch) {
      dispatch(fetchVideoGenerationsThunk(params));
    }
  }, [autoFetch, dispatch, params]);

  const fetchGenerations = useCallback(
    (fetchParams?: FetchVideoGenerationsParams) => {
      return dispatch(fetchVideoGenerationsThunk(fetchParams || params));
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

