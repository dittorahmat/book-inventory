import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./index.css";

// Cegah perubahan nilai tak disengaja pada input number saat mouse wheel diputar (tanpa menghilangkan fokus pengetikan)
if (typeof window !== "undefined") {
  window.addEventListener(
    "wheel",
    (e: WheelEvent) => {
      const target = e.target;
      if (target instanceof HTMLInputElement && target.type === "number") {
        e.preventDefault();
      }
    },
    { passive: false }
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
