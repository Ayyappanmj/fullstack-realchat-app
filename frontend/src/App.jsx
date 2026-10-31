import Navbar from "./components/Navbar";

import HomePage from "./pages/HomePage";
import SignUpPage from "./pages/SignUpPage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import VideoCallModal from "./components/VideoCallModal";

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import { useThemeStore } from "./store/useThemeStore";
import { useCallStore } from "./store/useCallStore";
import { useEffect } from "react";

import { Loader } from "lucide-react";
import { Toaster } from "react-hot-toast";
import { requestNotificationPermission } from "./lib/sound";

const App = () => {
  const { authUser, checkAuth, isCheckingAuth, socket } = useAuthStore();
  const { theme } = useThemeStore();
  const { bindCallSocketListeners, unbindCallSocketListeners } = useCallStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (authUser) {
      requestNotificationPermission();
    }
  }, [authUser]);

  // Bind WebRTC call socket signaling
  useEffect(() => {
    if (socket) {
      bindCallSocketListeners();
    }
    return () => unbindCallSocketListeners();
  }, [socket, bindCallSocketListeners, unbindCallSocketListeners]);

  if (isCheckingAuth && !authUser) {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] bg-base-100 gap-3">
        <Loader className="size-9 animate-spin text-primary" />
        <p className="text-xs text-base-content/60 font-medium">Loading Chatty...</p>
      </div>
    );
  }

  return (
    <div
      data-theme={theme}
      className="min-h-[100dvh] bg-base-100 text-base-content selection:bg-primary selection:text-primary-content"
    >
      <Navbar />

      <Routes>
        <Route path="/" element={authUser ? <HomePage /> : <Navigate to="/login" />} />
        <Route path="/signup" element={!authUser ? <SignUpPage /> : <Navigate to="/" />} />
        <Route path="/login" element={!authUser ? <LoginPage /> : <Navigate to="/" />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/profile" element={authUser ? <ProfilePage /> : <Navigate to="/login" />} />
      </Routes>

      {/* Global P2P Video/Audio Call Modal */}
      <VideoCallModal />

      <Toaster position="top-right" />
    </div>
  );
};

export default App;
