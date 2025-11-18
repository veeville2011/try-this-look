import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { fetchVideoGenerations } from "@/services/videoGenerationsApi";
import type {
  VideoGenerationRecord,
  PaginationInfo,
  FetchVideoGenerationsParams,
  VideoGenerationsResponse,
} from "@/types/videoGenerations";

interface VideoGenerationsState {
  records: VideoGenerationRecord[];
  pagination: PaginationInfo | null;
  loading: boolean;
  error: string | null;
  lastFetchParams: FetchVideoGenerationsParams | null;
}

const initialState: VideoGenerationsState = {
  records: [],
  pagination: null,
  loading: false,
  error: null,
  lastFetchParams: null,
};

export const fetchVideoGenerationsThunk = createAsyncThunk(
  "videoGenerations/fetch",
  async (params: FetchVideoGenerationsParams = {}, { rejectWithValue }) => {
    try {
      const response = await fetchVideoGenerations(params);
      return response;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to fetch video generations"
      );
    }
  }
);

const videoGenerationsSlice = createSlice({
  name: "videoGenerations",
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
      .addCase(fetchVideoGenerationsThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchVideoGenerationsThunk.fulfilled,
        (state, action: PayloadAction<VideoGenerationsResponse>) => {
          state.loading = false;
          state.error = null;
          state.records = action.payload.data.records;
          state.pagination = action.payload.data.pagination;
          state.lastFetchParams = {
            page: action.payload.data.pagination.page,
            limit: action.payload.data.pagination.limit,
            orderBy: "created_at",
            orderDirection: "DESC",
          };
        }
      )
      .addCase(
        fetchVideoGenerationsThunk.rejected,
        (state, action) => {
          state.loading = false;
          state.error =
            typeof action.payload === "string"
              ? action.payload
              : "Failed to fetch video generations";
        }
      );
  },
});

export const { clearError, clearRecords } = videoGenerationsSlice.actions;
export default videoGenerationsSlice.reducer;

