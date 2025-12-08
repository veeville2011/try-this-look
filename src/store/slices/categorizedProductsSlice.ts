import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import {
  fetchCategorizedProducts,
  CategorizedProductsResponse,
  Category,
  CategorizedProduct,
} from "@/services/productsApi";

interface CategorizedProductsState {
  categories: Category[];
  uncategorized: {
    categoryName: string;
    productCount: number;
    products: CategorizedProduct[];
  } | null;
  categoryMethod: string | null;
  statistics: {
    totalCategories: number;
    totalProducts: number;
    categorizedProducts: number;
    uncategorizedProducts: number;
  } | null;
  loading: boolean;
  error: string | null;
  lastFetchedShop: string | null;
}

const initialState: CategorizedProductsState = {
  categories: [],
  uncategorized: null,
  categoryMethod: null,
  statistics: null,
  loading: false,
  error: null,
  lastFetchedShop: null,
};

interface FetchCategorizedProductsParams {
  shop: string;
  options?: {
    categoryBy?: "collections" | "productType" | "vendor" | "tags" | "category" | "title";
    after?: string;
    limit?: number;
  };
}

export const fetchCategorizedProductsThunk = createAsyncThunk(
  "categorizedProducts/fetch",
  async (params: FetchCategorizedProductsParams, { rejectWithValue }) => {
    try {
      const response = await fetchCategorizedProducts(params.shop, params.options);
      if (!response.success) {
        return rejectWithValue(
          response.error || "Failed to fetch categorized products"
        );
      }
      return {
        ...response.data,
        shop: params.shop,
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to fetch categorized products"
      );
    }
  }
);

const categorizedProductsSlice = createSlice({
  name: "categorizedProducts",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearCategorizedProducts: (state) => {
      state.categories = [];
      state.uncategorized = null;
      state.categoryMethod = null;
      state.statistics = null;
      state.lastFetchedShop = null;
    },
    setCategorizedProducts: (
      state,
      action: PayloadAction<{
        categories: Category[];
        uncategorized: {
          categoryName: string;
          productCount: number;
          products: CategorizedProduct[];
        };
        categoryMethod: string;
        statistics: {
          totalCategories: number;
          totalProducts: number;
          categorizedProducts: number;
          uncategorizedProducts: number;
        };
      }>
    ) => {
      state.categories = action.payload.categories;
      state.uncategorized = action.payload.uncategorized;
      state.categoryMethod = action.payload.categoryMethod;
      state.statistics = action.payload.statistics;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategorizedProductsThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchCategorizedProductsThunk.fulfilled,
        (
          state,
          action: PayloadAction<
            | (CategorizedProductsResponse["data"] & { shop: string })
            | undefined
          >
        ) => {
          state.loading = false;
          state.error = null;
          if (action.payload) {
            state.categories = action.payload.categories ?? [];
            state.uncategorized = action.payload.uncategorized ?? null;
            state.categoryMethod = action.payload.categoryMethod ?? null;
            state.statistics = action.payload.statistics ?? null;
            state.lastFetchedShop = action.payload.shop ?? null;
          }
        }
      )
      .addCase(fetchCategorizedProductsThunk.rejected, (state, action) => {
        state.loading = false;
        state.error =
          typeof action.payload === "string"
            ? action.payload
            : "Failed to fetch categorized products";
      });
  },
});

export const {
  clearError,
  clearCategorizedProducts,
  setCategorizedProducts,
} = categorizedProductsSlice.actions;
export default categorizedProductsSlice.reducer;

