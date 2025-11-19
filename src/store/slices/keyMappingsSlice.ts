import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import { fetchKeyMappings, KeyMappingsParams, KeyMappingsResponse } from "@/services/keyMappingsApi";

interface KeyMappingsState {
  selectedClothingKey: string | null;
  selectedPersonKey: string | null;
  clothingKeys: string[];
  personKeys: string[];
  loading: boolean;
  error: string | null;
}

const initialState: KeyMappingsState = {
  selectedClothingKey: null,
  selectedPersonKey: null,
  clothingKeys: [],
  personKeys: [],
  loading: false,
  error: null,
};

export const fetchKeyMappingsThunk = createAsyncThunk(
  "keyMappings/fetch",
  async (params: KeyMappingsParams, { rejectWithValue }) => {
    try {
      const response = await fetchKeyMappings(params);
      if (response.status === "error") {
        return rejectWithValue(
          response.error_message?.message || "Failed to fetch key mappings"
        );
      }
      return response;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to fetch key mappings"
      );
    }
  }
);

const keyMappingsSlice = createSlice({
  name: "keyMappings",
  initialState,
  reducers: {
    setSelectedClothingKey: (state, action: PayloadAction<string | null>) => {
      state.selectedClothingKey = action.payload;
      // Clear personKeys when clothing selection changes
      state.personKeys = [];
    },
    setSelectedPersonKey: (state, action: PayloadAction<string | null>) => {
      state.selectedPersonKey = action.payload;
      // Clear clothingKeys when person selection changes
      state.clothingKeys = [];
    },
    clearError: (state) => {
      state.error = null;
    },
    clearMappings: (state) => {
      state.clothingKeys = [];
      state.personKeys = [];
    },
    resetSelections: (state) => {
      state.selectedClothingKey = null;
      state.selectedPersonKey = null;
      state.clothingKeys = [];
      state.personKeys = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchKeyMappingsThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchKeyMappingsThunk.fulfilled,
        (state, action: PayloadAction<KeyMappingsResponse>) => {
          state.loading = false;
          state.error = null;

          const { data } = action.payload;

          if (data) {
            // If clothingKey was requested, store personKeys
            if (data.clothingKey && data.personKeys) {
              state.personKeys = data.personKeys;
            }

            // If personKey was requested, store clothingKeys
            if (data.personKey && data.clothingKeys) {
              state.clothingKeys = data.clothingKeys;
            }
          }
        }
      )
      .addCase(fetchKeyMappingsThunk.rejected, (state, action) => {
        state.loading = false;
        state.error =
          typeof action.payload === "string"
            ? action.payload
            : "Failed to fetch key mappings";
      });
  },
});

export const {
  setSelectedClothingKey,
  setSelectedPersonKey,
  clearError,
  clearMappings,
  resetSelections,
} = keyMappingsSlice.actions;

export default keyMappingsSlice.reducer;

