import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { apiRequest, fetchCsrfCookie } from "../../api/client";

const initialState = {
  items: [],
  status: "idle",
  action: null,
  error: null,
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
  if (error.payload && typeof error.payload === "object" && !Array.isArray(error.payload)) {
    return {
      message:
        error.payload.detail ||
        error.payload.non_field_errors ||
        "Проверьте данные и повторите попытку.",
      status: error.status,
    };
  }

  return {
    message: error.message || normalizeErrorValue(error.payload),
    status: error.status,
  };
}

export const fetchUsers = createAsyncThunk(
  "users/fetchUsers",
  async (_, { rejectWithValue }) => {
    try {
      return await apiRequest("/api/users/");
    } catch (error) {
      return rejectWithValue(serializeApiError(error));
    }
  },
);

export const updateUserAdmin = createAsyncThunk(
  "users/updateUserAdmin",
  async ({ isAdmin, userId }, { rejectWithValue }) => {
    try {
      await fetchCsrfCookie();
      return await apiRequest(`/api/users/${userId}/`, {
        method: "PATCH",
        body: {
          is_admin: isAdmin,
        },
      });
    } catch (error) {
      return rejectWithValue(serializeApiError(error));
    }
  },
);

export const deleteUser = createAsyncThunk(
  "users/deleteUser",
  async (userId, { rejectWithValue }) => {
    try {
      await fetchCsrfCookie();
      await apiRequest(`/api/users/${userId}/`, {
        method: "DELETE",
      });
      return userId;
    } catch (error) {
      return rejectWithValue(serializeApiError(error));
    }
  },
);

const usersSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    clearUsersError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.status = "loading";
        state.action = "list";
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.items = action.payload;
        state.status = "idle";
        state.action = null;
        state.error = null;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.status = "idle";
        state.action = null;
        state.error = action.payload?.message || "Не удалось загрузить пользователей.";
      })
      .addCase(updateUserAdmin.pending, (state) => {
        state.status = "loading";
        state.action = "update";
        state.error = null;
      })
      .addCase(updateUserAdmin.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        state.status = "idle";
        state.action = null;
        state.error = null;
      })
      .addCase(updateUserAdmin.rejected, (state, action) => {
        state.status = "idle";
        state.action = null;
        state.error = action.payload?.message || "Не удалось изменить роль пользователя.";
      })
      .addCase(deleteUser.pending, (state) => {
        state.status = "loading";
        state.action = "delete";
        state.error = null;
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item.id !== action.payload);
        state.status = "idle";
        state.action = null;
        state.error = null;
      })
      .addCase(deleteUser.rejected, (state, action) => {
        state.status = "idle";
        state.action = null;
        state.error = action.payload?.message || "Не удалось удалить пользователя.";
      });
  },
});

export const { clearUsersError } = usersSlice.actions;
export default usersSlice.reducer;
