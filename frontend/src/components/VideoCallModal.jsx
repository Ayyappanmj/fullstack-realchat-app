import { useEffect, useRef } from "react";
import { useCallStore } from "../store/useCallStore";
import { formatAudioDuration } from "../lib/utils";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Phone,
  Volume2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const VideoCallModal = () => {
  const {
    callState,
    callType,
    remoteUser,
    localStream,
    remoteStream,
    isMicMuted,
    isCameraOff,
    callDuration,
    answerCall,
    rejectCall,
    endCall,
    toggleMic,
    toggleCamera,
    incrementDuration,
  } = useCallStore();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Attach local stream to video element
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState]);

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState]);

  // Call duration counter
  useEffect(() => {
    let interval = null;
    if (callState === "connected") {
      interval = setInterval(() => {
        incrementDuration();
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState, incrementDuration]);

  if (callState === "idle") return null;

  // 1. Incoming Call Prompt Banner / Dialog
  if (callState === "incoming") {
    return (
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-sm bg-base-100 rounded-3xl p-6 shadow-2xl border border-base-content/10 flex flex-col items-center text-center space-y-6"
          >
            {/* Animated Ringing Avatar */}
            <div className="relative">
              <span className="absolute -inset-3 rounded-full bg-primary/20 animate-ping" />
              <img
                src={remoteUser?.profilePic || "/avatar.png"}
                alt={remoteUser?.fullName}
                className="size-24 rounded-full object-cover ring-4 ring-primary/40 shadow-xl relative z-10"
              />
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-lg text-base-content">
                {remoteUser?.fullName}
              </h3>
              <p className="text-xs text-primary font-medium animate-pulse flex items-center justify-center gap-1.5">
                <Volume2 className="size-3.5" />
                <span>
                  Incoming {callType === "video" ? "Video" : "Audio"} Call...
                </span>
              </p>
            </div>

            {/* Answer and Decline Buttons */}
            <div className="flex items-center justify-center gap-6 w-full pt-2">
              <button
                type="button"
                onClick={rejectCall}
                className="btn btn-circle btn-error size-14 shadow-lg hover:scale-105 transition-transform"
                title="Decline"
              >
                <PhoneOff className="size-6 text-white" />
              </button>

              <button
                type="button"
                onClick={answerCall}
                className="btn btn-circle btn-success size-14 shadow-lg hover:scale-105 transition-transform animate-bounce"
                title="Answer"
              >
                <Phone className="size-6 text-white" />
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  // 2. Active Outgoing or Connected Full-Screen Call Modal
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-6 select-none">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-4xl h-[85vh] bg-base-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col justify-between"
        >
          {/* Top Bar: Recipient Details & Duration */}
          <div className="absolute top-0 inset-x-0 z-30 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <img
                src={remoteUser?.profilePic || "/avatar.png"}
                alt={remoteUser?.fullName}
                className="size-10 rounded-full object-cover ring-2 ring-white/20"
              />
              <div>
                <h4 className="font-semibold text-sm leading-tight">
                  {remoteUser?.fullName}
                </h4>
                <p className="text-xs text-white/70">
                  {callState === "connected"
                    ? formatAudioDuration(callDuration)
                    : "Connecting..."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-mono font-medium uppercase tracking-wider text-white/80">
                P2P Encrypted
              </span>
            </div>
          </div>

          {/* Main Media Stage */}
          <div className="relative flex-1 w-full h-full bg-zinc-950 flex items-center justify-center overflow-hidden">
            {/* Remote Video Stream */}
            {callType === "video" && remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              /* Audio-Only / Connecting Placeholder */
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="relative">
                  <span className="absolute -inset-4 rounded-full bg-primary/20 animate-ping" />
                  <img
                    src={remoteUser?.profilePic || "/avatar.png"}
                    alt={remoteUser?.fullName}
                    className="size-28 sm:size-36 rounded-full object-cover ring-4 ring-primary/30 shadow-2xl relative z-10"
                  />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-white">
                    {remoteUser?.fullName}
                  </h3>
                  <p className="text-sm text-zinc-400 mt-1">
                    {callState === "connected"
                      ? "Audio call in progress"
                      : "Calling..."}
                  </p>
                </div>
              </div>
            )}

            {/* Local Video Stream Picture-in-Picture (PiP) */}
            {callType === "video" && (
              <motion.div
                drag
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                className="absolute bottom-20 right-4 z-20 w-32 sm:w-48 aspect-video rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-zinc-900 cursor-move"
              >
                {!isCameraOff ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover -scale-x-100"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-400 text-xs">
                    Camera Off
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Floating Call Action Controls Bar */}
          <div className="absolute bottom-0 inset-x-0 z-30 p-4 sm:p-6 bg-gradient-to-t from-black/90 to-transparent flex items-center justify-center gap-4">
            {/* Mic Mute Toggle */}
            <button
              type="button"
              onClick={toggleMic}
              className={`btn btn-circle size-12 shadow-lg transition-transform hover:scale-105 ${
                isMicMuted
                  ? "bg-error text-white border-none"
                  : "bg-white/20 hover:bg-white/30 text-white border-white/10"
              }`}
              title={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {isMicMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </button>

            {/* Camera Toggle (Video Call Only) */}
            {callType === "video" && (
              <button
                type="button"
                onClick={toggleCamera}
                className={`btn btn-circle size-12 shadow-lg transition-transform hover:scale-105 ${
                  isCameraOff
                    ? "bg-error text-white border-none"
                    : "bg-white/20 hover:bg-white/30 text-white border-white/10"
                }`}
                title={isCameraOff ? "Turn On Camera" : "Turn Off Camera"}
              >
                {isCameraOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
              </button>
            )}

            {/* End Call Button */}
            <button
              type="button"
              onClick={endCall}
              className="btn btn-circle btn-error size-14 shadow-xl hover:scale-110 transition-transform"
              title="End Call"
            >
              <PhoneOff className="size-6 text-white" />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default VideoCallModal;
