import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { apiRequest, fetchCsrfCookie } from "../../api/client";

const initialState = {
  user: null,
  status: "idle",
  action: null,
  initialized: false,
  error: null,
  fieldErrors: {},
};

function normalizeErrorValue(value) {
  if (Array.isArray(value)) {
    return value.join(" ");
  }

  if (typeof value === "string") {
    return value;
  }

  return "Некорректное значение.";
}

function serializeApiError(error) {
  const fieldErrors = {};

  if (error.payload && typeof error.payload === "object" && !Array.isArray(error.payload)) {
    Object.entries(error.payload).forEach(([field, value]) => {
      if (field !== "detail" && field !== "non_field_errors") {
        fieldErrors[field] = normalizeErrorValue(value);
      }
    });
  }

  return {
    message: error.message || "Не удалось выполнить запрос.",
    status: error.status,
    fieldErrors,
  };
}

export const fetchCurrentUser = createAsyncThunk(
  "auth/fetchCurrentUser",
  async (_, { rejectWithValue }) => {
    try {
      return await apiRequest("/api/me/");
    } catch (error) {
      const serializedError = serializeApiError(error);

      if (serializedError.status === 401 || serializedError.status === 403) {
        return rejectWithValue({ ...serializedError, message: null });
      }

      return rejectWithValue(serializedError);
    }
  },
);

export const registerUser = createAsyncThunk(
  "auth/registerUser",
  async (credentials, { rejectWithValue }) => {
    try {
      await fetchCsrfCookie();
      return await apiRequest("/api/register/", {
        method: "POST",
        body: credentials,
      });
    } catch (error) {
      return rejectWithValue(serializeApiError(error));
    }
  },
);

export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async (credentials, { rejectWithValue }) => {
    try {
      await fetchCsrfCookie();
      return await apiRequest("/api/login/", {
        method: "POST",
        body: credentials,
      });
    } catch (error) {
      return rejectWithValue(serializeApiError(error));
    }
  },
);

export const logoutUser = createAsyncThunk(
  "auth/logoutUser",
  async (_, { rejectWithValue }) => {
    try {
      await fetchCsrfCookie();
      await apiRequest("/api/logout/", {
        method: "POST",
      });
    } catch (error) {
      return rejectWithValue(serializeApiError(error));
    }
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    clearAuthError(state) {
      state.error = null;
      state.fieldErrors = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.status = "loading";
        state.action = "session";
        state.error = null;
        state.fieldErrors = {};
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = "idle";
        state.action = null;
        state.initialized = true;
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.user = null;
        state.status = "idle";
        state.action = null;
        state.initialized = true;
        state.error = action.payload?.message || null;
      })
      .addCase(registerUser.pending, (state) => {
        state.status = "loading";
        state.action = "register";
        state.error = null;
        state.fieldErrors = {};
      })
      .addCase(registerUser.fulfilled, (state) => {
        state.status = "idle";
        state.action = null;
        state.error = null;
        state.fieldErrors = {};
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.status = "idle";
        state.action = null;
        state.error = action.payload?.message || "Не удалось зарегистрироваться.";
        state.fieldErrors = action.payload?.fieldErrors || {};
      })
      .addCase(loginUser.pending, (state) => {
        state.status = "loading";
        state.action = "login";
        state.error = null;
        state.fieldErrors = {};
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.status = "idle";
        state.action = null;
        state.error = null;
        state.fieldErrors = {};
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.user = null;
        state.status = "idle";
        state.action = null;
        state.error = action.payload?.message || "Не удалось войти.";
        state.fieldErrors = action.payload?.fieldErrors || {};
      })
      .addCase(logoutUser.pending, (state) => {
        state.status = "loading";
        state.action = "logout";
        state.error = null;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.status = "idle";
        state.action = null;
        state.error = null;
        state.fieldErrors = {};
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.status = "idle";
        state.action = null;
        state.error = action.payload?.message || "Не удалось выйти.";
      });
  },
});

export const { clearAuthError } = authSlice.actions;
export default authSlice.reducer;
