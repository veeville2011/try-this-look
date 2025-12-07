import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchProductsThunk,
  clearError,
  clearProducts,
  setProducts,
} from "@/store/slices/productsSlice";
import type { ProductImage } from "@/services/productsApi";

interface FetchProductsParams {
  shop: string;
  options?: {
    status?: string;
    productType?: string;
  };
}

export const useProducts = () => {
  const dispatch = useAppDispatch();
  const { products, loading, error, lastFetchedShop, count } = useAppSelector(
    (state) => state.products
  );

  const fetchProducts = useCallback(
    (params: FetchProductsParams) => {
      return dispatch(fetchProductsThunk(params));
    },
    [dispatch]
  );

  const handleClearError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  const handleClearProducts = useCallback(() => {
    dispatch(clearProducts());
  }, [dispatch]);

  const handleSetProducts = useCallback(
    (products: ProductImage[]) => {
      dispatch(setProducts(products));
    },
    [dispatch]
  );

  return {
    products,
    loading,
    error,
    lastFetchedShop,
    count,
    fetchProducts,
    clearError: handleClearError,
    clearProducts: handleClearProducts,
    setProducts: handleSetProducts,
  };
};

