import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import {
  CustomerAuthClient,
  CustomerInfo,
  SessionValidationResult,
  createCustomerAuthClient,
} from "@/services/customerAuth";

interface CustomerAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  customer: CustomerInfo | null;
  sessionToken: string | null;
  error: string | null;
  isValidating: boolean;
}

const initialState: CustomerAuthState = {
  isAuthenticated: false,
  isLoading: false,
  isValidating: false,
  customer: null,
  sessionToken: null,
  error: null,
};

// Create auth client instance
let authClientInstance: CustomerAuthClient | null = null;

const getAuthClient = (): CustomerAuthClient => {
  if (!authClientInstance) {
    try {
      authClientInstance = createCustomerAuthClient();
    } catch (error) {
      // API base URL not configured - create with fallback
      console.warn("[CustomerAuth] API base URL not configured, using fallback");
      authClientInstance = new CustomerAuthClient(
        import.meta.env.VITE_API_ENDPOINT || "https://try-on-server-v1.onrender.com"
      );
    }
  }
  return authClientInstance;
};

/**
 * Validate current session
 */
export const validateSessionThunk = createAsyncThunk(
  "customerAuth/validateSession",
  async (_, { rejectWithValue }) => {
    try {
      const authClient = getAuthClient();
      const result: SessionValidationResult = await authClient.validateSession();

      if (!result.valid) {
        return rejectWithValue(result.error || "Session validation failed");
      }

      return {
        customer: result.customer!,
        sessionToken: authClient.getSessionToken(),
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to validate session"
      );
    }
  }
);

/**
 * Handle OAuth callback
 */
export const handleCallbackThunk = createAsyncThunk(
  "customerAuth/handleCallback",
  async (_, { rejectWithValue }) => {
    try {
      const authClient = getAuthClient();
      const result = await authClient.handleCallback();

      return {
        sessionToken: result.sessionToken,
        customer: result.customer,
        expiresAt: result.expiresAt,
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Failed to handle callback"
      );
    }
  }
);

/**
 * Logout current session
 */
export const logoutThunk = createAsyncThunk(
  "customerAuth/logout",
  async (_, { rejectWithValue }) => {
    try {
      const authClient = getAuthClient();
      await authClient.logout();
      return true;
    } catch (error) {
      // Logout should succeed even if API call fails
      // We've already cleared local state
      return true;
    }
  }
);

/**
 * Initialize authentication state from localStorage
 */
export const initializeAuthThunk = createAsyncThunk(
  "customerAuth/initialize",
  async (_, { dispatch }) => {
    try {
      const authClient = getAuthClient();
      const token = authClient.getSessionToken();

      if (token) {
        // Validate existing token
        await dispatch(validateSessionThunk());
      }

      return {
        sessionToken: token,
        isAuthenticated: !!token,
      };
    } catch (error) {
      // If initialization fails, just return unauthenticated state
      return {
        sessionToken: null,
        isAuthenticated: false,
      };
    }
  }
);

const customerAuthSlice = createSlice({
  name: "customerAuth",
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setCustomer: (state, action: PayloadAction<CustomerInfo>) => {
      state.customer = action.payload;
      state.isAuthenticated = true;
    },
    setSessionToken: (state, action: PayloadAction<string>) => {
      state.sessionToken = action.payload;
      state.isAuthenticated = true;
    },
    clearAuth: (state) => {
      state.isAuthenticated = false;
      state.customer = null;
      state.sessionToken = null;
      state.error = null;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Initialize auth
      .addCase(initializeAuthThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(initializeAuthThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.sessionToken = action.payload.sessionToken;
        state.isAuthenticated = action.payload.isAuthenticated;
      })
      .addCase(initializeAuthThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.sessionToken = null;
        state.error = typeof action.payload === "string" ? action.payload : "Initialization failed";
      })
      // Validate session
      .addCase(validateSessionThunk.pending, (state) => {
        state.isValidating = true;
        state.error = null;
      })
      .addCase(validateSessionThunk.fulfilled, (state, action) => {
        state.isValidating = false;
        state.isAuthenticated = true;
        state.customer = action.payload.customer;
        state.sessionToken = action.payload.sessionToken;
        state.error = null;
      })
      .addCase(validateSessionThunk.rejected, (state, action) => {
        state.isValidating = false;
        state.isAuthenticated = false;
        state.customer = null;
        state.sessionToken = null;
        state.error =
          typeof action.payload === "string" ? action.payload : "Session validation failed";
      })
      // Handle callback
      .addCase(handleCallbackThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(handleCallbackThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.customer = action.payload.customer;
        state.sessionToken = action.payload.sessionToken;
        state.error = null;
      })
      .addCase(handleCallbackThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.customer = null;
        state.sessionToken = null;
        state.error =
          typeof action.payload === "string" ? action.payload : "Callback handling failed";
      })
      // Logout
      .addCase(logoutThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logoutThunk.fulfilled, (state) => {
        state.isLoading = false;
        state.isAuthenticated = false;
        state.customer = null;
        state.sessionToken = null;
        state.error = null;
      })
      .addCase(logoutThunk.rejected, (state) => {
        // Logout should always succeed (we clear local state even if API fails)
        state.isLoading = false;
        state.isAuthenticated = false;
        state.customer = null;
        state.sessionToken = null;
        state.error = null;
      });
  },
});

export const { clearError, setCustomer, setSessionToken, clearAuth, setLoading } =
  customerAuthSlice.actions;

export default customerAuthSlice.reducer;

