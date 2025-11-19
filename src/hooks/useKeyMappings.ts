import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchKeyMappingsThunk,
  setSelectedClothingKey,
  setSelectedPersonKey,
  clearError,
  clearMappings,
  resetSelections,
} from "@/store/slices/keyMappingsSlice";
import type { KeyMappingsParams } from "@/services/keyMappingsApi";

export const useKeyMappings = () => {
  const dispatch = useAppDispatch();
  const {
    selectedClothingKey,
    selectedPersonKey,
    clothingKeys,
    personKeys,
    loading,
    error,
  } = useAppSelector((state) => state.keyMappings);

  // Fetch mappings when clothing key is selected
  useEffect(() => {
    if (selectedClothingKey) {
      dispatch(
        fetchKeyMappingsThunk({
          clothingKey: selectedClothingKey,
        })
      );
    }
  }, [selectedClothingKey, dispatch]);

  // Fetch mappings when person key is selected
  useEffect(() => {
    if (selectedPersonKey) {
      dispatch(
        fetchKeyMappingsThunk({
          personKey: selectedPersonKey,
        })
      );
    }
  }, [selectedPersonKey, dispatch]);

  const handleSetSelectedClothingKey = useCallback(
    (key: string | null) => {
      dispatch(setSelectedClothingKey(key));
    },
    [dispatch]
  );

  const handleSetSelectedPersonKey = useCallback(
    (key: string | null) => {
      dispatch(setSelectedPersonKey(key));
    },
    [dispatch]
  );

  const fetchMappings = useCallback(
    (params: KeyMappingsParams) => {
      return dispatch(fetchKeyMappingsThunk(params));
    },
    [dispatch]
  );

  const handleClearError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  const handleClearMappings = useCallback(() => {
    dispatch(clearMappings());
  }, [dispatch]);

  const handleResetSelections = useCallback(() => {
    dispatch(resetSelections());
  }, [dispatch]);

  return {
    selectedClothingKey,
    selectedPersonKey,
    clothingKeys,
    personKeys,
    loading,
    error,
    setSelectedClothingKey: handleSetSelectedClothingKey,
    setSelectedPersonKey: handleSetSelectedPersonKey,
    fetchMappings,
    clearError: handleClearError,
    clearMappings: handleClearMappings,
    resetSelections: handleResetSelections,
  };
};

