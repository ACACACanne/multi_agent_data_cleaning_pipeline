// frontend/src/main.jsx
import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css"; // keep if you have global styles; safe to import even if empty

function Root() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div style={{ padding: 20, color: "#cbd5e1" }}>
            Loading application…
          </div>
        }
      >
        <App />
      </Suspense>
    </BrowserRouter>
  );
}

const container = document.getElementById("root");
if (!container) {
  // If index.html is missing a root div, show a clear console error
  // This prevents a silent white screen when root element is missing.
  // Create a fallback DOM node so the app can still render an error message.
  const fallback = document.createElement("div");
  fallback.id = "root";
  document.body.appendChild(fallback);
}

const root = createRoot(document.getElementById("root"));
root.render(<Root />);
