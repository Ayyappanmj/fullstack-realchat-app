import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const getSocketUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL.replace(/\/api\/?$/, "");
  }
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "");
  }
  return import.meta.env.MODE === "development"
    ? "http://localhost:5001"
    : "https://realchat-backend-toqe.onrender.com";
};

const BASE_URL = getSocketUrl();

let keepAliveTimer = null;
let lifecycleBound = false;

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      if (res.data?.token) {
        localStorage.setItem("chat_jwt", res.data.token);
      }
      set({ authUser: res.data });
      get().connectSocket();
      get().startKeepAlive();
    } catch (error) {
      console.log("Error in checkAuth:", error);
      localStorage.removeItem("chat_jwt");
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      if (res.data?.token) {
        localStorage.setItem("chat_jwt", res.data.token);
      }
      set({ authUser: res.data });
      toast.success("Account created successfully");
      get().connectSocket();
      get().startKeepAlive();
    } catch (error) {
      const msg = error.response?.data?.message || "Failed to create account";
      toast.error(msg);
      throw error;
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      if (res.data?.token) {
        localStorage.setItem("chat_jwt", res.data.token);
      }
      set({ authUser: res.data });
      toast.success("Logged in successfully");
      get().connectSocket();
      get().startKeepAlive();
      return res.data;
    } catch (error) {
      const msg = error.response?.data?.message || "Invalid email or password";
      toast.error(msg);
      throw error;
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
    } catch (error) {
      console.warn("Logout error:", error);
    } finally {
      localStorage.removeItem("chat_jwt");
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().stopKeepAlive();
      get().disconnectSocket();
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("Error in update profile:", error);
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  // Keep Render container warm and prevent sleep during active user sessions
  startKeepAlive: () => {
    if (keepAliveTimer) return;
    keepAliveTimer = setInterval(() => {
      if (get().authUser) {
        axiosInstance.get("/health").catch(() => {});
      }
    }, 4 * 60 * 1000); // every 4 minutes

    if (!lifecycleBound && typeof window !== "undefined") {
      lifecycleBound = true;

      // When tab wakes up from background sleep or network restores, immediately ensure socket is connected
      const wakeHandler = () => {
        const { authUser, socket } = get();
        if (authUser) {
          if (!socket || !socket.connected) {
            get().connectSocket();
          }
        }
      };

      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") wakeHandler();
      });
      window.addEventListener("focus", wakeHandler);
      window.addEventListener("online", wakeHandler);
    }
  },

  stopKeepAlive: () => {
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
  },

  connectSocket: () => {
    const { authUser, socket } = get();
    if (!authUser) return;
    if (socket?.connected) return;

    // Disconnect stale socket instance if any
    if (socket) {
      socket.disconnect();
    }

    const token = localStorage.getItem("chat_jwt") || authUser.token;

    const newSocket = io(BASE_URL, {
      query: {
        userId: authUser._id,
      },
      auth: {
        token,
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity, // never abandon reconnection
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    newSocket.connect();
    set({ socket: newSocket });

    newSocket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds || [] });
    });

    // Re-verify online users upon socket reconnect
    newSocket.on("reconnect", () => {
      newSocket.emit("refreshPresence");
    });
  },

  disconnectSocket: () => {
    const { socket } = get();
    if (socket?.connected) {
      socket.disconnect();
    }
    set({ socket: null });
  },
}));
