import axios from "axios";

// ✅ Make sure baseURL ends with /api
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: true,
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(
      `📡 ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
    );
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor - FIXED
api.interceptors.response.use(
  (response) => {
    console.log(`✅ ${response.config.url} - ${response.status}`);
    return response;
  },
  (error) => {
    console.error(
      `❌ ${error.config?.url} -`,
      error.response?.status,
      error.response?.data,
    );

    // ✅ FIX: Don't redirect for OAuth calls
    if (error.response?.status === 401) {
      const url = error.config?.url || "";

      // ✅ Skip redirect for OAuth endpoints
      if (url.includes("/oauth/")) {
        console.log("🔑 OAuth authentication failed - token may be expired");
        // Just reject the promise, let the component handle it
        return Promise.reject(error);
      }

      // ✅ Only redirect for non-OAuth endpoints
      console.error("Authentication error - redirecting to login");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export default api;
