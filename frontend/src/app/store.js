import { configureStore } from "@reduxjs/toolkit";

import authReducer from "../features/auth/authSlice";
import filesReducer from "../features/files/filesSlice";
import usersReducer from "../features/users/usersSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    files: filesReducer,
    users: usersReducer,
  },
});
