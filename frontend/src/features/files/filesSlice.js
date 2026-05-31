import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  items: [],
  status: "idle",
  error: null,
};

const filesSlice = createSlice({
  name: "files",
  initialState,
  reducers: {
    clearFilesError(state) {
      state.error = null;
    },
  },
});

export const { clearFilesError } = filesSlice.actions;
export default filesSlice.reducer;
