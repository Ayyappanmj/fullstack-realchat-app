import { useRef, useEffect } from "react";
import {
  ChevronLeft,
  X,
  Phone,
  Video,
  Search,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useCallStore } from "../store/useCallStore";

const ChatHeader = () => {
  const {
    selectedUser,
    setSelectedUser,
    typingUsers,
    inChatSearchOpen,
    inChatSearchQuery,
    toggleInChatSearch,
    setInChatSearchQuery,
    activeSearchMatchIndex,
    setActiveSearchMatchIndex,
  } = useChatStore();

  const { onlineUsers } = useAuthStore();
  const { startCall } = useCallStore();
  const searchInputRef = useRef(null);

  // Focus search input when opened
  useEffect(() => {
    if (inChatSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [inChatSearchOpen]);

  if (!selectedUser) return null;

  const isOnline = onlineUsers.includes(selectedUser._id);
  const isTyping = Boolean(typingUsers[selectedUser._id]);

  return (
    <div className="border-b border-base-content/10 bg-base-100/70 backdrop-blur-md shrink-0 flex flex-col transition-all">
      {/* Top Header Bar */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Mobile Back Button */}
          <button
            onClick={() => setSelectedUser(null)}
            className="btn btn-ghost btn-circle btn-sm md:hidden text-base-content/70 hover:text-base-content -ml-1"
            aria-label="Back to contacts"
          >
            <ChevronLeft className="size-5" />
          </button>

          {/* Avatar with Status */}
          <div className="relative">
            <img
              src={selectedUser.profilePic || "/avatar.png"}
              alt={selectedUser.fullName}
              className="size-10 object-cover rounded-full ring-2 ring-base-content/10"
            />
            {isOnline ? (
              <span className="absolute bottom-0 right-0 size-3 bg-emerald-500 rounded-full ring-2 ring-base-100" />
            ) : (
              <span className="absolute bottom-0 right-0 size-2.5 bg-base-content/20 rounded-full ring-2 ring-base-100" />
            )}
          </div>

          {/* User Info & Typing Indicator */}
          <div className="flex flex-col">
            <h3 className="font-semibold text-sm sm:text-base leading-tight text-base-content">
              {selectedUser.fullName}
            </h3>
            {isTyping ? (
              <div className="flex items-center gap-1.5 text-xs text-primary font-medium animate-pulse">
                <span>typing</span>
                <div className="flex items-center gap-0.5">
                  <span className="size-1 bg-primary rounded-full animate-bounce" />
                  <span className="size-1 bg-primary rounded-full animate-bounce [animation-delay:0.15s]" />
                  <span className="size-1 bg-primary rounded-full animate-bounce [animation-delay:0.3s]" />
                </div>
              </div>
            ) : (
              <span
                className={`text-xs ${
                  isOnline ? "text-emerald-500 font-medium" : "text-base-content/50"
                }`}
              >
                {isOnline ? "Active now" : "Offline"}
              </span>
            )}
          </div>
        </div>

        {/* Right Calling & Search Controls */}
        <div className="flex items-center gap-1">
          {/* Audio Call Button */}
          <button
            type="button"
            onClick={() => startCall(selectedUser, "audio")}
            className="btn btn-ghost btn-circle btn-sm text-base-content/70 hover:text-primary transition-colors"
            title="Start Audio Call"
          >
            <Phone className="size-4 sm:size-4.5" />
          </button>

          {/* Video Call Button */}
          <button
            type="button"
            onClick={() => startCall(selectedUser, "video")}
            className="btn btn-ghost btn-circle btn-sm text-base-content/70 hover:text-primary transition-colors"
            title="Start Video Call"
          >
            <Video className="size-4.5 sm:size-5" />
          </button>

          {/* In-Chat Search Button */}
          <button
            type="button"
            onClick={toggleInChatSearch}
            className={`btn btn-ghost btn-circle btn-sm transition-colors ${
              inChatSearchOpen
                ? "bg-primary/10 text-primary"
                : "text-base-content/70 hover:text-primary"
            }`}
            title="Search In Conversation"
          >
            <Search className="size-4 sm:size-4.5" />
          </button>

          {/* Desktop Close Button */}
          <button
            onClick={() => setSelectedUser(null)}
            className="btn btn-ghost btn-circle btn-sm text-base-content/60 hover:text-base-content hidden md:inline-flex ml-1"
            title="Close chat"
          >
            <X className="size-4.5" />
          </button>
        </div>
      </div>

      {/* Instant In-Chat Fuzzy Search Bar */}
      {inChatSearchOpen && (
        <div className="px-4 py-2 border-t border-base-content/10 bg-base-200/50 flex items-center gap-2 animate-in slide-in-from-top-1 duration-150">
          <div className="relative flex-1">
            <Search className="size-3.5 absolute inset-y-0 left-2.5 my-auto text-base-content/40" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search in conversation (fuzzy matching)..."
              value={inChatSearchQuery}
              onChange={(e) => setInChatSearchQuery(e.target.value)}
              className="input input-xs w-full pl-8 pr-3 rounded-lg bg-base-100 border-base-content/15 focus:border-primary text-xs"
            />
          </div>

          {/* Search Navigation Controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                setActiveSearchMatchIndex(Math.max(0, activeSearchMatchIndex - 1))
              }
              className="btn btn-ghost btn-xs btn-square text-base-content/70 hover:text-base-content"
              title="Previous Match"
            >
              <ChevronUp className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setActiveSearchMatchIndex(activeSearchMatchIndex + 1)}
              className="btn btn-ghost btn-xs btn-square text-base-content/70 hover:text-base-content"
              title="Next Match"
            >
              <ChevronDown className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={toggleInChatSearch}
              className="btn btn-ghost btn-xs btn-square text-base-content/50 hover:text-base-content"
              title="Close Search"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatHeader;
