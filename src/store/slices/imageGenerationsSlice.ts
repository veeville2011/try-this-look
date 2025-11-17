import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { fetchImageGenerations } from "@/services/imageGenerationsApi";
import type {
  ImageGenerationRecord,
  PaginationInfo,
  FetchImageGenerationsParams,
} from "@/types/imageGenerations";

interface ImageGenerationsState {
  records: ImageGenerationRecord[];
  pagination: PaginationInfo | null;
  loading: boolean;
  error: string | null;
  lastFetchParams: FetchImageGenerationsParams | null;
}

const initialState: ImageGenerationsState = {
  records: [],
  pagination: null,
  loading: false,
  error: null,
  lastFetchParams: null,
};

export const fetchImageGenerationsThunk = createAsyncThunk(
  "imageGenerations/fetch",
  async (params: FetchImageGenerationsParams = {}, { rejectWithValue }) => {
    try {
      const response = await fetchImageGenerations(params);
      return response;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to fetch image generations"
      );
    }
  }
);

const imageGenerationsSlice = createSlice({
  name: "imageGenerations",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearRecords: (state) => {
      state.records = [];
      state.pagination = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchImageGenerationsThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchImageGenerationsThunk.fulfilled,
        (state, action: PayloadAction<ImageGenerationsResponse>) => {
          state.loading = false;
          state.error = null;
          state.records = action.payload.data.records;
          state.pagination = action.payload.data.pagination;
          state.lastFetchParams = {
            page: action.payload.data.pagination.page,
            limit: action.payload.data.pagination.limit,
            orderBy: "createdAt",
            orderDirection: "DESC",
          };
        }
      )
      .addCase(
        fetchImageGenerationsThunk.rejected,
        (state, action) => {
          state.loading = false;
          state.error =
            typeof action.payload === "string"
              ? action.payload
              : "Failed to fetch image generations";
        }
      );
  },
});

export const { clearError, clearRecords } = imageGenerationsSlice.actions;
export default imageGenerationsSlice.reducer;

