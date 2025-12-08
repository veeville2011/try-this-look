import { useState, useCallback } from "react";
import {
  fetchNu3dProducts,
  Nu3dProduct,
  Nu3dResponse,
  FetchNu3dProductsParams,
} from "@/services/nu3dApi";

interface UseNu3dProductsReturn {
  products: Nu3dProduct[];
  loading: boolean;
  error: string | null;
  hasNextPage: boolean;
  endCursor: string | null;
  total: number;
  fetchProducts: (params: FetchNu3dProductsParams) => Promise<Nu3dResponse>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useNu3dProducts = (
  shop: string | null
): UseNu3dProductsReturn => {
  const [products, setProducts] = useState<Nu3dProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchProducts = useCallback(
    async (params: FetchNu3dProductsParams): Promise<Nu3dResponse> => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetchNu3dProducts(params);

        if (!response.success) {
          throw new Error(response.message || "Failed to fetch products");
        }

        // Replace products (not append) for initial fetch or refresh
        setProducts(response.data.products);
        setNextCursor(response.data.pageInfo.endCursor);
        setHasNextPage(response.data.pageInfo.hasNextPage);
        setTotal(response.data.total);

        return response;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An error occurred";
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadMore = useCallback(async () => {
    if (!shop || !nextCursor || !hasNextPage) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetchNu3dProducts({
        shop,
        after: nextCursor,
      });

      if (!response.success) {
        throw new Error(response.message || "Failed to load more products");
      }

      // Append new products
      setProducts((prev) => [...prev, ...response.data.products]);
      setNextCursor(response.data.pageInfo.endCursor);
      setHasNextPage(response.data.pageInfo.hasNextPage);
      setTotal(response.data.total);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [shop, nextCursor, hasNextPage]);

  const refresh = useCallback(async () => {
    if (!shop) {
      return;
    }

    await fetchProducts({ shop });
  }, [shop, fetchProducts]);

  return {
    products,
    loading,
    error,
    hasNextPage,
    endCursor: nextCursor,
    total,
    fetchProducts,
    loadMore,
    refresh,
  };
};

