import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";

import { App } from "./app/App";
import { store } from "./app/store";
import "./styles/app.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>,
);
