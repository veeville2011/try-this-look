import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchCategorizedProductsThunk,
  clearCategorizedProducts,
  clearError,
} from "@/store/slices/categorizedProductsSlice";

export const useCategorizedProducts = () => {
  const dispatch = useAppDispatch();
  const categorizedProducts = useAppSelector(
    (state) => state.categorizedProducts
  );

  const fetchCategorizedProducts = useCallback(
    async (
      shop: string,
      options?: {
        categoryBy?: "collections" | "productType" | "vendor" | "tags" | "category";
        after?: string;
        limit?: number;
      }
    ) => {
      return dispatch(
        fetchCategorizedProductsThunk({
          shop,
          options,
        })
      );
    },
    [dispatch]
  );

  const clearProducts = useCallback(() => {
    dispatch(clearCategorizedProducts());
  }, [dispatch]);

  const clearErrorState = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  return {
    categories: categorizedProducts.categories,
    uncategorized: categorizedProducts.uncategorized,
    categoryMethod: categorizedProducts.categoryMethod,
    statistics: categorizedProducts.statistics,
    loading: categorizedProducts.loading,
    error: categorizedProducts.error,
    lastFetchedShop: categorizedProducts.lastFetchedShop,
    fetchCategorizedProducts,
    clearProducts,
    clearError: clearErrorState,
  };
};

