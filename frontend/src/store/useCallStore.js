import { create } from "zustand";
import { useAuthStore } from "./useAuthStore";
import toast from "react-hot-toast";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

// Web Audio API Ringtone generator
let ringtoneInterval = null;
let ringAudioCtx = null;

const startRingtone = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!ringAudioCtx) ringAudioCtx = new AudioContext();

    const playTone = () => {
      if (ringAudioCtx.state === "suspended") ringAudioCtx.resume();
      const now = ringAudioCtx.currentTime;
      const osc = ringAudioCtx.createOscillator();
      const gain = ringAudioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.setValueAtTime(480, now + 0.15); // B4

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(ringAudioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.6);
    };

    playTone();
    ringtoneInterval = setInterval(playTone, 2200);
  } catch {
    // ignore audio block
  }
};

const stopRingtone = () => {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
};

export const useCallStore = create((set, get) => ({
  callState: "idle", // 'idle' | 'outgoing' | 'incoming' | 'connected'
  callType: "video", // 'video' | 'audio'
  remoteUser: null, // { userId, fullName, profilePic }
  incomingSignal: null,
  localStream: null,
  remoteStream: null,
  isMicMuted: false,
  isCameraOff: false,
  callDuration: 0,
  peerConnection: null,

  startCall: async (targetUser, type = "video") => {
    const authUser = useAuthStore.getState().authUser;
    const socket = useAuthStore.getState().socket;

    if (!authUser || !socket?.connected) {
      toast.error("Network connection required for calling");
      return;
    }

    try {
      const constraints = {
        audio: true,
        video: type === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      set({
        callState: "outgoing",
        callType: type,
        remoteUser: targetUser,
        localStream: stream,
        callDuration: 0,
        isMicMuted: false,
        isCameraOff: false,
      });

      const pc = new RTCPeerConnection(ICE_SERVERS);
      set({ peerConnection: pc });

      // Add local tracks
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Handle remote stream
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          set({ remoteStream: event.streams[0] });
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice:candidate", {
            to: targetUser._id,
            candidate: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          set({ callState: "connected" });
        } else if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          get().endCall();
        }
      };

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("call:user", {
        userToCall: targetUser._id,
        signalData: offer,
        from: authUser._id,
        callerName: authUser.fullName,
        callerPic: authUser.profilePic,
        callType: type,
      });
    } catch (err) {
      console.error("Failed to start call:", err);
      toast.error("Could not access camera/microphone");
      get().resetCall();
    }
  },

  answerCall: async () => {
    stopRingtone();
    const { incomingSignal, remoteUser, callType } = get();
    const socket = useAuthStore.getState().socket;

    if (!incomingSignal || !remoteUser || !socket?.connected) return;

    try {
      const constraints = {
        audio: true,
        video: callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      set({
        localStream: stream,
        callState: "connected",
        callDuration: 0,
      });

      const pc = new RTCPeerConnection(ICE_SERVERS);
      set({ peerConnection: pc });

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          set({ remoteStream: event.streams[0] });
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice:candidate", {
            to: remoteUser.userId,
            candidate: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          get().endCall();
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call:accepted", {
        to: remoteUser.userId,
        signal: answer,
      });
    } catch (err) {
      console.error("Failed to answer call:", err);
      toast.error("Could not answer call: media error");
      get().endCall();
    }
  },

  rejectCall: () => {
    stopRingtone();
    const { remoteUser } = get();
    const socket = useAuthStore.getState().socket;

    if (remoteUser && socket?.connected) {
      socket.emit("call:rejected", { to: remoteUser.userId });
    }
    get().resetCall();
  },

  endCall: () => {
    stopRingtone();
    const { remoteUser, peerConnection, localStream } = get();
    const socket = useAuthStore.getState().socket;

    if (remoteUser && socket?.connected) {
      const targetId = remoteUser._id || remoteUser.userId;
      if (targetId) {
        socket.emit("call:ended", { to: targetId });
      }
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    if (peerConnection) {
      peerConnection.close();
    }

    get().resetCall();
  },

  toggleMic: () => {
    const { localStream, isMicMuted } = get();
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = isMicMuted; // Toggle enabled state
      set({ isMicMuted: !isMicMuted });
    }
  },

  toggleCamera: () => {
    const { localStream, isCameraOff } = get();
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = isCameraOff;
      set({ isCameraOff: !isCameraOff });
    }
  },

  incrementDuration: () => {
    set((state) => ({ callDuration: state.callDuration + 1 }));
  },

  resetCall: () => {
    stopRingtone();
    set({
      callState: "idle",
      callType: "video",
      remoteUser: null,
      incomingSignal: null,
      localStream: null,
      remoteStream: null,
      isMicMuted: false,
      isCameraOff: false,
      callDuration: 0,
      peerConnection: null,
    });
  },

  bindCallSocketListeners: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("call:incoming");
    socket.off("call:accepted");
    socket.off("call:rejected");
    socket.off("call:ended");
    socket.off("call:unavailable");
    socket.off("ice:candidate");

    socket.on(
      "call:incoming",
      ({ signal, from, callerName, callerPic, callType }) => {
        // If already in a call, reject automatically
        if (get().callState !== "idle") {
          socket.emit("call:rejected", { to: from });
          return;
        }

        startRingtone();
        set({
          callState: "incoming",
          callType: callType || "video",
          incomingSignal: signal,
          remoteUser: {
            userId: from,
            fullName: callerName || "Unknown Caller",
            profilePic: callerPic,
          },
        });
      }
    );

    socket.on("call:accepted", async ({ signal }) => {
      const { peerConnection } = get();
      if (peerConnection) {
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
          set({ callState: "connected" });
        } catch (err) {
          console.error("Failed to set remote description on call:accepted:", err);
        }
      }
    });

    socket.on("call:rejected", () => {
      toast.error("Call was declined", { id: "call-declined" });
      get().endCall();
    });

    socket.on("call:ended", () => {
      toast("Call ended", { icon: "📞", id: "call-ended" });
      const { localStream, peerConnection } = get();
      if (localStream) localStream.getTracks().forEach((track) => track.stop());
      if (peerConnection) peerConnection.close();
      get().resetCall();
    });

    socket.on("call:unavailable", () => {
      toast.error("User is currently offline or unavailable", { id: "call-unavailable" });
      get().endCall();
    });

    socket.on("ice:candidate", async ({ candidate }) => {
      const { peerConnection } = get();
      if (peerConnection && candidate) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn("Error adding received ICE candidate:", err);
        }
      }
    });
  },

  unbindCallSocketListeners: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("call:incoming");
    socket.off("call:accepted");
    socket.off("call:rejected");
    socket.off("call:ended");
    socket.off("call:unavailable");
    socket.off("ice:candidate");
  },
}));
