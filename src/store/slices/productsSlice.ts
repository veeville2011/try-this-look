import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import {
  fetchAllStoreProducts,
  ProductsResponse,
  ProductImage,
} from "@/services/productsApi";

interface ProductsState {
  products: ProductImage[];
  loading: boolean;
  error: string | null;
  lastFetchedShop: string | null;
  count: number;
}

const initialState: ProductsState = {
  products: [],
  loading: false,
  error: null,
  lastFetchedShop: null,
  count: 0,
};

interface FetchProductsParams {
  shop: string;
  options?: {
    status?: string;
    productType?: string;
    limit?: number;
  };
}

export const fetchProductsThunk = createAsyncThunk(
  "products/fetch",
  async (params: FetchProductsParams, { rejectWithValue }) => {
    try {
      const response = await fetchAllStoreProducts(params.shop, params.options);
      if (!response.success) {
        return rejectWithValue(
          "Failed to fetch products"
        );
      }
      return {
        ...response,
        shop: params.shop,
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to fetch products"
      );
    }
  }
);

const productsSlice = createSlice({
  name: "products",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearProducts: (state) => {
      state.products = [];
      state.count = 0;
      state.lastFetchedShop = null;
    },
    setProducts: (state, action: PayloadAction<ProductImage[]>) => {
      state.products = action.payload;
      state.count = action.payload.length;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProductsThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchProductsThunk.fulfilled,
        (state, action: PayloadAction<ProductsResponse & { shop: string }>) => {
          state.loading = false;
          state.error = null;
          // Safely access products with optional chaining and nullish coalescing
          state.products = action.payload?.products ?? [];
          state.count = action.payload?.count ?? action.payload?.products?.length ?? 0;
          state.lastFetchedShop = action.payload?.shop ?? null;
        }
      )
      .addCase(fetchProductsThunk.rejected, (state, action) => {
        state.loading = false;
        state.error =
          typeof action.payload === "string"
            ? action.payload
            : "Failed to fetch products";
      });
  },
});

export const { clearError, clearProducts, setProducts } =
  productsSlice.actions;
export default productsSlice.reducer;

