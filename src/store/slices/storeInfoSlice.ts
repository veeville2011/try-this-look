import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import {
  fetchStoreInfo,
  StoreInfoParams,
  StoreInfoResponse,
  StoreInfoData,
} from "@/services/storeInfoApi";

interface StoreInfoState {
  data: StoreInfoData | null;
  loading: boolean;
  error: string | null;
  lastFetchedShop: string | null;
}

const initialState: StoreInfoState = {
  data: null,
  loading: false,
  error: null,
  lastFetchedShop: null,
};

export const fetchStoreInfoThunk = createAsyncThunk(
  "storeInfo/fetch",
  async (params: StoreInfoParams, { rejectWithValue }) => {
    try {
      const response = await fetchStoreInfo(params);
      if (!response.success || !response.data) {
        return rejectWithValue(
          response.message || "Failed to fetch store info"
        );
      }
      return response;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to fetch store info"
      );
    }
  }
);

const storeInfoSlice = createSlice({
  name: "storeInfo",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearStoreInfo: (state) => {
      state.data = null;
      state.lastFetchedShop = null;
    },
    setStoreInfo: (state, action: PayloadAction<StoreInfoData>) => {
      state.data = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStoreInfoThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchStoreInfoThunk.fulfilled,
        (state, action: PayloadAction<StoreInfoResponse>) => {
          state.loading = false;
          state.error = null;
          if (action.payload.data) {
            state.data = action.payload.data;
            state.lastFetchedShop = action.payload.data.shop;
          }
        }
      )
      .addCase(fetchStoreInfoThunk.rejected, (state, action) => {
        state.loading = false;
        state.error =
          typeof action.payload === "string"
            ? action.payload
            : "Failed to fetch store info";
      });
  },
});

export const { clearError, clearStoreInfo, setStoreInfo } =
  storeInfoSlice.actions;
export default storeInfoSlice.reducer;

