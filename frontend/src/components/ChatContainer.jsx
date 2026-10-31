import { useEffect, useRef, useState, useMemo } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import VoiceMessagePlayer from "./VoiceMessagePlayer";
import ImageLightbox from "./ImageLightbox";
import { formatMessageTime, formatDateDivider } from "../lib/utils";
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Copy,
  ChevronDown,
  Loader2,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import Fuse from "fuse.js";

const QUICK_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🔥"];

// Substring highlighter for in-chat fuzzy search matches
const HighlightedText = ({ text, highlight }) => {
  if (!highlight || !highlight.trim() || !text) return <>{text}</>;

  const escaped = highlight.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase().trim() ? (
          <mark
            key={i}
            className="bg-amber-300 dark:bg-amber-400 text-black px-1 py-0.5 rounded font-semibold shadow-xs"
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
    loadMoreMessages,
    isLoadingMore,
    hasMoreMessages,
    retrySendMessage,
    reactToMessage,
    typingUsers,
    markMessagesAsRead,
    inChatSearchOpen,
    inChatSearchQuery,
    activeSearchMatchIndex,
    activeSearchMessageId,
    setActiveSearchMessageId,
  } = useChatStore();

  const { authUser } = useAuthStore();
  const scrollContainerRef = useRef(null);
  const messageEndRef = useRef(null);
  const prevScrollHeightRef = useRef(null);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Client-side fuzzy search using Fuse.js
  const fuse = useMemo(() => {
    return new Fuse(
      messages.filter((m) => Boolean(m.text)),
      {
        keys: ["text"],
        threshold: 0.35,
        ignoreLocation: true,
      }
    );
  }, [messages]);

  const searchResults = useMemo(() => {
    if (!inChatSearchQuery.trim()) return [];
    return fuse.search(inChatSearchQuery.trim());
  }, [fuse, inChatSearchQuery]);

  // When search matches change or navigation occurs, scroll to target message
  useEffect(() => {
    if (searchResults.length > 0) {
      const safeIndex = activeSearchMatchIndex % searchResults.length;
      const targetMessage = searchResults[safeIndex]?.item;
      if (targetMessage) {
        setActiveSearchMessageId(targetMessage._id);
        const element = document.getElementById(`msg-${targetMessage._id}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    } else {
      setActiveSearchMessageId(null);
    }
  }, [searchResults, activeSearchMatchIndex, setActiveSearchMessageId]);

  // Load conversation & bind socket listeners
  useEffect(() => {
    if (selectedUser?._id) {
      getMessages(selectedUser._id);
      subscribeToMessages();
    }
    return () => unsubscribeFromMessages();
  }, [selectedUser?._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  // Read receipts on window focus
  useEffect(() => {
    const handleFocus = () => {
      if (selectedUser?._id) {
        markMessagesAsRead(selectedUser._id);
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [selectedUser?._id, markMessagesAsRead]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (inChatSearchOpen && searchResults.length > 0) {
      return; // don't override active search position
    }

    if (prevScrollHeightRef.current && scrollContainerRef.current) {
      const newHeight = scrollContainerRef.current.scrollHeight;
      scrollContainerRef.current.scrollTop += newHeight - prevScrollHeightRef.current;
      prevScrollHeightRef.current = null;
    } else if (messageEndRef.current && !isLoadingMore) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoadingMore, inChatSearchOpen, searchResults.length]);

  // Handle scroll for infinite scroll & scroll-to-bottom button
  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 250;
    setShowScrollBottom(isFarFromBottom);

    if (scrollTop < 40 && hasMoreMessages && !isLoadingMore) {
      prevScrollHeightRef.current = scrollHeight;
      loadMoreMessages();
    }
  };

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleCopyText = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success("Message copied to clipboard", { duration: 1500 });
  };

  // Group messages with date separators
  const groupedMessages = useMemo(() => {
    const groups = [];
    let lastDate = null;

    messages.forEach((msg) => {
      const msgDate = formatDateDivider(msg.createdAt);
      if (msgDate !== lastDate) {
        groups.push({ type: "date-separator", date: msgDate, id: `sep-${msg.createdAt}` });
        lastDate = msgDate;
      }
      groups.push({ type: "message", data: msg, id: msg._id || msg.tempId });
    });

    return groups;
  }, [messages]);

  const isOtherUserTyping = Boolean(selectedUser && typingUsers[selectedUser._id]);

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-base-100/40">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-base-100/30 relative">
      <ChatHeader />

      {/* In-Chat Search Summary Floating Pill */}
      {inChatSearchOpen && inChatSearchQuery.trim() && (
        <div className="absolute top-16 inset-x-0 z-20 flex justify-center pointer-events-none">
          <div className="px-3.5 py-1.5 rounded-full bg-base-100/95 backdrop-blur-md border border-base-content/15 shadow-xl text-xs font-medium text-base-content flex items-center gap-2 pointer-events-auto">
            <Search className="size-3.5 text-primary" />
            {searchResults.length > 0 ? (
              <span>
                Match {(activeSearchMatchIndex % searchResults.length) + 1} of{" "}
                {searchResults.length}
              </span>
            ) : (
              <span className="text-base-content/60">No matching messages found</span>
            )}
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"
      >
        {/* Infinite Scroll Loading Indicator */}
        {isLoadingMore && (
          <div className="flex items-center justify-center py-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-base-200/80 text-xs text-base-content/70 shadow-sm border border-base-content/10">
              <Loader2 className="size-3.5 animate-spin text-primary" />
              <span>Loading older messages...</span>
            </div>
          </div>
        )}

        {/* Has More Messages Hint */}
        {hasMoreMessages && !isLoadingMore && (
          <div className="flex justify-center">
            <button
              onClick={() => {
                if (scrollContainerRef.current) {
                  prevScrollHeightRef.current = scrollContainerRef.current.scrollHeight;
                }
                loadMoreMessages();
              }}
              className="text-xs text-primary hover:underline font-medium py-1 px-3 rounded-full bg-primary/10 transition-colors"
            >
              Load earlier messages
            </button>
          </div>
        )}

        {/* Message Stream */}
        {groupedMessages.map((item) => {
          if (item.type === "date-separator") {
            return (
              <div key={item.id} className="flex justify-center my-3 select-none">
                <span className="px-3.5 py-1 rounded-full bg-base-300/80 backdrop-blur-sm text-xs font-medium text-base-content/70 border border-base-content/10 shadow-sm">
                  {item.date}
                </span>
              </div>
            );
          }

          const message = item.data;
          const isSender = message.senderId === authUser?._id;
          const isFailed = message.status === "failed";
          const isSending = message.status === "sending";
          const isSearchMatch = message._id === activeSearchMessageId;

          const reactionSummary = (message.reactions || []).reduce((acc, r) => {
            if (!acc[r.emoji]) acc[r.emoji] = { count: 0, hasReacted: false };
            acc[r.emoji].count += 1;
            if (r.userId === authUser?._id) acc[r.emoji].hasReacted = true;
            return acc;
          }, {});

          return (
            <motion.div
              id={`msg-${message._id}`}
              key={item.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.18 }}
              className={`flex items-end gap-2.5 group relative transition-all ${
                isSender ? "flex-row-reverse" : "flex-row"
              }`}
            >
              {/* Avatar */}
              <div className="size-8 rounded-full overflow-hidden shrink-0 ring-1 ring-base-content/10 self-end mb-1">
                <img
                  src={
                    isSender
                      ? authUser?.profilePic || "/avatar.png"
                      : selectedUser?.profilePic || "/avatar.png"
                  }
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Message Content Container */}
              <div className={`flex flex-col max-w-[85%] sm:max-w-[70%] ${isSender ? "items-end" : "items-start"}`}>
                <div className="relative group/bubble">
                  {/* Floating Action Bar */}
                  <div
                    className={`absolute -top-9 z-20 hidden group-hover/bubble:flex items-center gap-1 p-1 bg-base-100/95 backdrop-blur-md rounded-full shadow-lg border border-base-content/15 transition-all animate-in fade-in duration-150 ${
                      isSender ? "right-0" : "left-0"
                    }`}
                  >
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => reactToMessage(message._id, emoji)}
                        className="size-6 text-sm hover:scale-125 transition-transform flex items-center justify-center rounded-full hover:bg-base-200"
                        title={`React ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                    {message.text && (
                      <button
                        type="button"
                        onClick={() => handleCopyText(message.text)}
                        className="size-6 text-base-content/60 hover:text-base-content hover:scale-110 transition-all flex items-center justify-center rounded-full hover:bg-base-200"
                        title="Copy text"
                      >
                        <Copy className="size-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Main Bubble with Search Match Glow Ring */}
                  <div
                    className={`p-3 sm:p-3.5 shadow-sm text-sm relative transition-all ${
                      isSearchMatch ? "ring-2 ring-primary ring-offset-2 animate-pulse" : ""
                    } ${
                      isSender
                        ? "bg-primary text-primary-content rounded-2xl rounded-br-xs shadow-primary/10"
                        : "bg-base-200/90 text-base-content rounded-2xl rounded-bl-xs border border-base-content/5"
                    }`}
                  >
                    {/* Sent Photo */}
                    {message.image && (
                      <div className="relative group/img mb-2 overflow-hidden rounded-xl cursor-pointer">
                        <img
                          src={message.image}
                          alt="Attachment"
                          onClick={() => setLightboxImage(message.image)}
                          className="max-h-72 w-full object-cover rounded-xl transition-transform duration-200 group-hover/img:scale-[1.02]"
                        />
                      </div>
                    )}

                    {/* Sent Voice Note */}
                    {message.audio && (
                      <div className="mb-1">
                        <VoiceMessagePlayer src={message.audio} isSender={isSender} />
                      </div>
                    )}

                    {/* Text Body with Fuzzy Match Highlight */}
                    {message.text && (
                      <p className="whitespace-pre-wrap break-words leading-relaxed select-text font-normal">
                        <HighlightedText
                          text={message.text}
                          highlight={inChatSearchOpen ? inChatSearchQuery : ""}
                        />
                      </p>
                    )}
                  </div>
                </div>

                {/* Reaction Badges */}
                {Object.keys(reactionSummary).length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${isSender ? "justify-end" : "justify-start"}`}>
                    {Object.entries(reactionSummary).map(([emoji, meta]) => (
                      <button
                        key={emoji}
                        onClick={() => reactToMessage(message._id, emoji)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${
                          meta.hasReacted
                            ? "bg-primary/20 border-primary/40 text-primary font-medium"
                            : "bg-base-200/70 border-base-content/10 text-base-content hover:bg-base-300"
                        }`}
                      >
                        <span>{emoji}</span>
                        <span className="text-[10px]">{meta.count}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Timestamp & Delivery Status */}
                <div className={`flex items-center gap-1.5 mt-1 px-1 text-[11px] opacity-70 ${isSender ? "flex-row-reverse" : "flex-row"}`}>
                  <span>{formatMessageTime(message.createdAt)}</span>

                  {isSender && (
                    <span className="flex items-center">
                      {isSending ? (
                        <Clock className="size-3 animate-spin text-base-content/50" />
                      ) : isFailed ? (
                        <button
                          onClick={() => retrySendMessage(message._id || message.tempId)}
                          className="flex items-center gap-1 text-error font-medium hover:underline"
                          title="Click to retry sending"
                        >
                          <AlertCircle className="size-3" />
                          <span>Retry</span>
                        </button>
                      ) : message.status === "read" ? (
                        <CheckCheck className="size-3.5 text-sky-400" title="Read" />
                      ) : message.status === "delivered" ? (
                        <CheckCheck className="size-3.5 opacity-80" title="Delivered" />
                      ) : (
                        <Check className="size-3 opacity-80" title="Sent" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}

        {/* Live In-Stream Typing Bubble */}
        {isOtherUserTyping && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-end gap-2.5"
          >
            <div className="size-8 rounded-full overflow-hidden shrink-0 ring-1 ring-base-content/10 mb-1">
              <img
                src={selectedUser?.profilePic || "/avatar.png"}
                alt={selectedUser?.fullName}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="bg-base-200/90 border border-base-content/5 px-4 py-2.5 rounded-2xl rounded-bl-xs flex items-center gap-1.5 shadow-sm">
              <span className="size-2 bg-primary rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="size-2 bg-primary rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="size-2 bg-primary rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
          </motion.div>
        )}

        <div ref={messageEndRef} />
      </div>

      {/* Floating Scroll To Bottom Button */}
      <AnimatePresence>
        {showScrollBottom && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToBottom}
            className="absolute bottom-20 right-6 z-30 btn btn-circle btn-sm btn-primary shadow-xl hover:scale-105 transition-transform"
            title="Jump to latest"
          >
            <ChevronDown className="size-4" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />
      )}

      {/* Message Input Bar */}
      <MessageInput />
    </div>
  );
};

export default ChatContainer;
