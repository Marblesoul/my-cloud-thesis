import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";

import { apiRequest, fetchCsrfCookie } from "../../api/client";

const initialState = {
  items: [],
  currentUserId: null,
  status: "idle",
  action: null,
  error: null,
  fieldErrors: {},
  sharedUrls: {},
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

function filesPath(userId) {
  return userId ? `/api/files/?user_id=${encodeURIComponent(userId)}` : "/api/files/";
}

export const fetchFiles = createAsyncThunk(
  "files/fetchFiles",
  async ({ userId } = {}, { rejectWithValue }) => {
    try {
      const items = await apiRequest(filesPath(userId));
      return {
        items,
        userId: userId ? Number(userId) : null,
      };
    } catch (error) {
      return rejectWithValue(serializeApiError(error));
    }
  },
);

export const uploadFile = createAsyncThunk(
  "files/uploadFile",
  async ({ comment = "", file, userId } = {}, { rejectWithValue }) => {
    try {
      await fetchCsrfCookie();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("comment", comment);
      return await apiRequest(filesPath(userId), {
        method: "POST",
        body: formData,
      });
    } catch (error) {
      return rejectWithValue(serializeApiError(error));
    }
  },
);

export const updateFile = createAsyncThunk(
  "files/updateFile",
  async ({ comment, fileId, originalName }, { rejectWithValue }) => {
    try {
      await fetchCsrfCookie();
      return await apiRequest(`/api/files/${fileId}/`, {
        method: "PATCH",
        body: {
          comment,
          original_name: originalName,
        },
      });
    } catch (error) {
      return rejectWithValue(serializeApiError(error));
    }
  },
);

export const deleteFile = createAsyncThunk(
  "files/deleteFile",
  async (fileId, { rejectWithValue }) => {
    try {
      await fetchCsrfCookie();
      await apiRequest(`/api/files/${fileId}/`, {
        method: "DELETE",
      });
      return fileId;
    } catch (error) {
      return rejectWithValue(serializeApiError(error));
    }
  },
);

export const shareFile = createAsyncThunk(
  "files/shareFile",
  async (fileId, { rejectWithValue }) => {
    try {
      await fetchCsrfCookie();
      const share = await apiRequest(`/api/files/${fileId}/share/`, {
        method: "POST",
      });
      return {
        fileId,
        share,
      };
    } catch (error) {
      return rejectWithValue(serializeApiError(error));
    }
  },
);

const filesSlice = createSlice({
  name: "files",
  initialState,
  reducers: {
    clearFilesError(state) {
      state.error = null;
      state.fieldErrors = {};
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFiles.pending, (state) => {
        state.status = "loading";
        state.action = "list";
        state.error = null;
        state.fieldErrors = {};
      })
      .addCase(fetchFiles.fulfilled, (state, action) => {
        state.items = action.payload.items;
        state.currentUserId = action.payload.userId;
        state.status = "idle";
        state.action = null;
        state.error = null;
      })
      .addCase(fetchFiles.rejected, (state, action) => {
        state.status = "idle";
        state.action = null;
        state.error = action.payload?.message || "Не удалось загрузить список файлов.";
        state.fieldErrors = action.payload?.fieldErrors || {};
      })
      .addCase(uploadFile.pending, (state) => {
        state.status = "loading";
        state.action = "upload";
        state.error = null;
        state.fieldErrors = {};
      })
      .addCase(uploadFile.fulfilled, (state, action) => {
        state.items.unshift(action.payload);
        state.status = "idle";
        state.action = null;
        state.error = null;
      })
      .addCase(uploadFile.rejected, (state, action) => {
        state.status = "idle";
        state.action = null;
        state.error = action.payload?.message || "Не удалось загрузить файл.";
        state.fieldErrors = action.payload?.fieldErrors || {};
      })
      .addCase(updateFile.pending, (state) => {
        state.status = "loading";
        state.action = "update";
        state.error = null;
        state.fieldErrors = {};
      })
      .addCase(updateFile.fulfilled, (state, action) => {
        const index = state.items.findIndex((item) => item.id === action.payload.id);
        if (index !== -1) {
          state.items[index] = action.payload;
        }
        state.status = "idle";
        state.action = null;
        state.error = null;
      })
      .addCase(updateFile.rejected, (state, action) => {
        state.status = "idle";
        state.action = null;
        state.error = action.payload?.message || "Не удалось обновить файл.";
        state.fieldErrors = action.payload?.fieldErrors || {};
      })
      .addCase(deleteFile.pending, (state) => {
        state.status = "loading";
        state.action = "delete";
        state.error = null;
      })
      .addCase(deleteFile.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item.id !== action.payload);
        delete state.sharedUrls[action.payload];
        state.status = "idle";
        state.action = null;
        state.error = null;
      })
      .addCase(deleteFile.rejected, (state, action) => {
        state.status = "idle";
        state.action = null;
        state.error = action.payload?.message || "Не удалось удалить файл.";
      })
      .addCase(shareFile.pending, (state) => {
        state.status = "loading";
        state.action = "share";
        state.error = null;
      })
      .addCase(shareFile.fulfilled, (state, action) => {
        state.sharedUrls[action.payload.fileId] = action.payload.share.shared_url;
        state.status = "idle";
        state.action = null;
        state.error = null;
      })
      .addCase(shareFile.rejected, (state, action) => {
        state.status = "idle";
        state.action = null;
        state.error = action.payload?.message || "Не удалось получить публичную ссылку.";
      });
  },
});

export const { clearFilesError } = filesSlice.actions;
export default filesSlice.reducer;
