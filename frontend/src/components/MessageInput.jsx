import { useRef, useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useThemeStore } from "../store/useThemeStore";
import {
  Image,
  Send,
  X,
  Smile,
  Mic,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import EmojiPicker, { Theme } from "emoji-picker-react";
import { formatAudioDuration } from "../lib/utils";

const DARK_THEMES = new Set([
  "dark",
  "synthwave",
  "halloween",
  "forest",
  "black",
  "luxury",
  "dracula",
  "business",
  "night",
  "coffee",
  "dim",
  "sunset",
]);

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const streamRef = useRef(null);

  const { sendMessage, sendTypingStart, sendTypingStop } = useChatStore();
  const { theme } = useThemeStore();

  const isDark = DARK_THEMES.has(theme);

  // Close emoji picker on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showEmojiPicker]);

  // Clean up recording timer and streams on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleTextChange = (e) => {
    setText(e.target.value);

    // Debounced typing indicator
    sendTypingStart();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTypingStop();
    }, 1500);
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image size must be less than 8MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleEmojiClick = (emojiData) => {
    setText((prev) => prev + emojiData.emoji);
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!text.trim() && !imagePreview) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTypingStop();

    const payload = {
      text: text.trim(),
      image: imagePreview,
    };

    setText("");
    setImagePreview(null);
    setShowEmojiPicker(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    try {
      await sendMessage(payload);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  // Start Voice Note Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Microphone access error:", err);
      toast.error("Could not access microphone. Please check permissions.");
    }
  };

  // Stop & Discard Voice Note
  const cancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  // Stop & Send Voice Note
  const sendVoiceRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;

    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, {
        type: mediaRecorderRef.current.mimeType || "audio/webm",
      });

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = reader.result;
        try {
          await sendMessage({ audio: base64Audio });
        } catch {
          toast.error("Failed to send voice recording");
        }
      };
      reader.readAsDataURL(audioBlob);

      setIsRecording(false);
      setRecordingSeconds(0);
      audioChunksRef.current = [];
    };

    mediaRecorderRef.current.stop();
  };

  return (
    <div className="p-3 sm:p-4 w-full bg-base-100/80 backdrop-blur-md border-t border-base-content/10 shrink-0 relative">
      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div
          ref={emojiPickerRef}
          className="absolute bottom-20 left-4 z-50 shadow-2xl rounded-2xl overflow-hidden border border-base-content/10 animate-in fade-in zoom-in-95 duration-150"
        >
          <EmojiPicker
            theme={isDark ? Theme.DARK : Theme.LIGHT}
            onEmojiClick={handleEmojiClick}
            lazyLoadEmojis={true}
            searchPlaceHolder="Search emoji..."
            width={320}
            height={380}
          />
        </div>
      )}

      {/* Image Attachment Preview */}
      {imagePreview && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative group">
            <img
              src={imagePreview}
              alt="Preview"
              className="size-20 object-cover rounded-xl border border-base-content/15 shadow-md"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 size-6 rounded-full bg-base-300 hover:bg-error hover:text-white transition-colors flex items-center justify-center shadow-md"
              type="button"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <span className="text-xs text-base-content/60">Image attached (ready to send)</span>
        </div>
      )}

      {/* Active Voice Recording Bar */}
      {isRecording ? (
        <div className="flex items-center justify-between gap-3 bg-base-200/90 rounded-2xl p-2.5 px-4 border border-primary/30 animate-pulse">
          <div className="flex items-center gap-3">
            <span className="size-3 rounded-full bg-error animate-ping" />
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-error">Recording</span>
              <span className="text-xs font-mono font-medium text-base-content/70">
                {formatAudioDuration(recordingSeconds)}
              </span>
            </div>
            {/* Waveform Pulse Visualizer */}
            <div className="flex items-center gap-1 h-5 px-2">
              <span className="w-1 bg-error rounded-full animate-[bounce_0.8s_infinite_100ms] h-3" />
              <span className="w-1 bg-error rounded-full animate-[bounce_0.8s_infinite_300ms] h-5" />
              <span className="w-1 bg-error rounded-full animate-[bounce_0.8s_infinite_200ms] h-4" />
              <span className="w-1 bg-error rounded-full animate-[bounce_0.8s_infinite_400ms] h-2" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelRecording}
              className="btn btn-sm btn-ghost btn-circle text-error hover:bg-error/10"
              title="Discard recording"
            >
              <Trash2 className="size-4" />
            </button>
            <button
              type="button"
              onClick={sendVoiceRecording}
              className="btn btn-sm btn-primary rounded-xl gap-1.5 px-3"
            >
              <Send className="size-3.5" />
              <span className="text-xs font-semibold">Send Audio</span>
            </button>
          </div>
        </div>
      ) : (
        /* Standard Message Bar */
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          {/* Action Buttons: Emoji & Attachment */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className={`btn btn-sm btn-circle btn-ghost text-base-content/70 hover:text-primary transition-colors ${
                showEmojiPicker ? "text-primary bg-primary/10" : ""
              }`}
              title="Add emoji"
            >
              <Smile className="size-5" />
            </button>

            <button
              type="button"
              className={`btn btn-sm btn-circle btn-ghost transition-colors ${
                imagePreview ? "text-primary bg-primary/10" : "text-base-content/70 hover:text-primary"
              }`}
              onClick={() => fileInputRef.current?.click()}
              title="Attach image"
            >
              <Image className="size-5" />
            </button>

            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageChange}
            />
          </div>

          {/* Text Input */}
          <div className="flex-1 relative">
            <input
              type="text"
              className="w-full input input-bordered rounded-xl input-sm sm:input-md bg-base-200/50 focus:bg-base-100 border-base-content/10 focus:border-primary text-sm transition-all"
              placeholder="Type a message..."
              value={text}
              onChange={handleTextChange}
            />
          </div>

          {/* Voice Record or Send Button */}
          {text.trim() || imagePreview ? (
            <button
              type="submit"
              className="btn btn-sm sm:btn-md btn-circle btn-primary shadow-md shadow-primary/20 transition-all hover:scale-105"
              title="Send message"
            >
              <Send className="size-4 sm:size-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              className="btn btn-sm sm:btn-md btn-circle btn-ghost text-base-content/70 hover:text-error hover:bg-error/10 transition-colors"
              title="Record voice note"
            >
              <Mic className="size-5" />
            </button>
          )}
        </form>
      )}
    </div>
  );
};

export default MessageInput;
