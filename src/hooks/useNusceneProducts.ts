import { useState, useCallback } from "react";
import {
  fetchNusceneProducts,
  NusceneProduct,
  NusceneResponse,
  FetchNusceneProductsParams,
} from "@/services/nusceneApi";

interface UseNusceneProductsReturn {
  products: NusceneProduct[];
  loading: boolean;
  error: string | null;
  hasNextPage: boolean;
  endCursor: string | null;
  total: number;
  fetchProducts: (params: FetchNusceneProductsParams) => Promise<NusceneResponse>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useNusceneProducts = (
  shop: string | null
): UseNusceneProductsReturn => {
  const [products, setProducts] = useState<NusceneProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchProducts = useCallback(
    async (params: FetchNusceneProductsParams): Promise<NusceneResponse> => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetchNusceneProducts(params);

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

      const response = await fetchNusceneProducts({
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

