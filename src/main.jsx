import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

import { registerSW } from "virtual:pwa-register";

registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent("pwa:need-refresh"));
  },
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent("pwa:offline-ready"));
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
