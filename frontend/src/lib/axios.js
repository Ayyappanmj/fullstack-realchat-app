import axios from "axios";

const getBaseUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) {
    const raw = import.meta.env.VITE_BACKEND_URL.replace(/\/+$/, "");
    return raw.endsWith("/api") ? raw : `${raw}/api`;
  }
  if (import.meta.env.VITE_API_URL) {
    const raw = import.meta.env.VITE_API_URL.replace(/\/+$/, "");
    return raw.endsWith("/api") ? raw : `${raw}/api`;
  }
  return import.meta.env.MODE === "development"
    ? "http://localhost:5001/api"
    : "https://realchat-backend-toqe.onrender.com/api";
};

export const axiosInstance = axios.create({
  baseURL: getBaseUrl(),
  withCredentials: true,
});

// Interceptor to attach JWT token from localStorage (ensures cross-site & Incognito mode compatibility)
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("chat_jwt");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
