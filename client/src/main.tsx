import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.tsx";

const originalFetch = window.fetch;
window.fetch = function (...args) {
  console.log("🌐 FETCH:", args[0]);
  return originalFetch.apply(this, args);
};

// ✅ Also monitor console errors
const originalError = console.error;
console.error = function (...args) {
  console.log("🔴 CONSOLE ERROR:", args);
  originalError.apply(console, args);
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
