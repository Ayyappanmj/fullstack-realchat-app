import { useEffect, useState, useMemo, useRef } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { formatConversationTime } from "../lib/utils";
import {
  MessageSquare,
  MessageSquarePlus,
  Users,
  Search,
  X,
  Compass,
  CheckCheck,
} from "lucide-react";

const Sidebar = () => {
  const { getUsers, users, selectedUser, setSelectedUser, isUsersLoading } = useChatStore();
  const { onlineUsers, authUser } = useAuthStore();

  // WhatsApp style: "chats" (Recent active conversations only) | "explore" (All contacts to start new chat) | "online"
  const [filterMode, setFilterMode] = useState("chats");
  const [localSearch, setLocalSearch] = useState("");
  const searchInputRef = useRef(null);

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  // Self-heal: If initial contacts fetch failed or empty while online users arrive, auto re-fetch
  useEffect(() => {
    if (users.length === 0 && !isUsersLoading && onlineUsers.length > 0) {
      getUsers();
    }
  }, [onlineUsers, users.length, isUsersLoading, getUsers]);

  // Active conversations: users with at least 1 message exchanged, sorted by most recent first
  const conversations = useMemo(() => {
    return users
      .filter((user) => Boolean(user.hasConversation))
      .sort((a, b) => new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0));
  }, [users]);

  const onlineCount = useMemo(() => {
    return users.filter((user) => onlineUsers.includes(user._id)).length;
  }, [users, onlineUsers]);

  // Filtered list based on active tab and search query
  const filteredUsers = useMemo(() => {
    let baseList = [];
    if (filterMode === "chats") {
      baseList = conversations;
    } else if (filterMode === "online") {
      baseList = users.filter((u) => onlineUsers.includes(u._id));
    } else {
      // "explore" / "all"
      baseList = users;
    }

    if (localSearch.trim()) {
      const query = localSearch.toLowerCase().trim();
      return baseList.filter((user) => {
        const matchName = user.fullName?.toLowerCase().includes(query);
        const matchEmail = user.email?.toLowerCase().includes(query);
        const matchMessage = user.lastMessage?.toLowerCase().includes(query);
        return matchName || matchEmail || matchMessage;
      });
    }

    return baseList;
  }, [conversations, users, onlineUsers, filterMode, localSearch]);

  const handleOpenExplore = () => {
    setFilterMode("explore");
    setLocalSearch("");
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="h-full w-full md:w-80 lg:w-88 border-r border-base-content/10 flex flex-col bg-base-100/60 backdrop-blur-md transition-all duration-300">
      {/* Header & Controls */}
      <div className="p-4 border-b border-base-content/10 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
              {filterMode === "chats" ? (
                <MessageSquare className="size-5" />
              ) : filterMode === "explore" ? (
                <Compass className="size-5" />
              ) : (
                <Users className="size-5" />
              )}
            </div>
            <div>
              <h2 className="font-semibold text-base tracking-tight">
                {filterMode === "chats"
                  ? "Chats"
                  : filterMode === "explore"
                  ? "New Chat"
                  : "Online Users"}
              </h2>
              <p className="text-xs text-base-content/60">
                {filterMode === "chats"
                  ? `${conversations.length} active ${
                      conversations.length === 1 ? "conversation" : "conversations"
                    }`
                  : `${users.length} registered ${users.length === 1 ? "contact" : "contacts"}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* New Chat Quick Button */}
            <button
              onClick={
                filterMode === "explore" ? () => setFilterMode("chats") : handleOpenExplore
              }
              className={`btn btn-sm btn-circle transition-all ${
                filterMode === "explore"
                  ? "btn-primary shadow-sm"
                  : "btn-ghost bg-base-200/70 hover:bg-base-200 text-base-content/80"
              }`}
              title={filterMode === "explore" ? "Back to Recent Chats" : "Start New Chat / Explore"}
            >
              <MessageSquarePlus className="size-4" />
            </button>

            {/* Online Indicator Pill */}
            <button
              onClick={() => setFilterMode("online")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all text-xs font-medium ${
                filterMode === "online"
                  ? "bg-emerald-500 text-white border-emerald-600 shadow-xs"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
              }`}
            >
              <span
                className={`size-2 rounded-full ${
                  filterMode === "online" ? "bg-white" : "bg-emerald-500 animate-pulse"
                }`}
              />
              <span>{onlineCount} online</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40">
            <Search className="size-4" />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            placeholder={
              filterMode === "chats"
                ? "Search recent conversations..."
                : "Search contacts to start chat..."
            }
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="input input-sm w-full pl-9 pr-8 bg-base-200/60 focus:bg-base-100 rounded-xl border-base-content/10 focus:border-primary transition-all text-sm"
          />
          {localSearch && (
            <button
              onClick={() => setLocalSearch("")}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-base-content/40 hover:text-base-content"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/* WhatsApp-Style Navigation Filter Pills */}
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              setFilterMode("chats");
              setLocalSearch("");
            }}
            className={`btn btn-xs rounded-lg flex-1 font-medium transition-all ${
              filterMode === "chats"
                ? "btn-primary shadow-sm"
                : "btn-ghost bg-base-200/70 hover:bg-base-200 text-base-content/70"
            }`}
          >
            Chats ({conversations.length})
          </button>
          <button
            onClick={handleOpenExplore}
            className={`btn btn-xs rounded-lg flex-1 font-medium transition-all ${
              filterMode === "explore"
                ? "btn-primary shadow-sm"
                : "btn-ghost bg-base-200/70 hover:bg-base-200 text-base-content/70"
            }`}
          >
            New Chat ({users.length})
          </button>
          <button
            onClick={() => {
              setFilterMode("online");
              setLocalSearch("");
            }}
            className={`btn btn-xs rounded-lg flex-1 font-medium transition-all ${
              filterMode === "online"
                ? "btn-primary shadow-sm"
                : "btn-ghost bg-base-200/70 hover:bg-base-200 text-base-content/70"
            }`}
          >
            Online ({onlineCount})
          </button>
        </div>
      </div>

      {/* Users / Conversation List */}
      <div className="overflow-y-auto flex-1 p-2 space-y-1">
        {filteredUsers.length === 0 ? (
          filterMode === "chats" && !localSearch ? (
            /* WhatsApp Empty State for New Users */
            <div className="flex flex-col items-center justify-center h-64 text-center p-6 space-y-3">
              <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <MessageSquarePlus className="size-7" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-base-content">No conversations yet</p>
                <p className="text-xs text-base-content/60 max-w-[200px] leading-relaxed">
                  Start your first private chat by selecting a contact below.
                </p>
              </div>
              <button
                onClick={handleOpenExplore}
                className="btn btn-sm btn-primary rounded-xl gap-2 font-medium shadow-sm hover:scale-105 transition-transform"
              >
                <MessageSquarePlus className="size-4" />
                <span>Start a New Chat</span>
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-center p-4">
              <div className="size-12 rounded-full bg-base-200 flex items-center justify-center mb-2 text-base-content/40">
                <Users className="size-6" />
              </div>
              <p className="text-sm font-medium text-base-content/70">No contacts found</p>
              <p className="text-xs text-base-content/50 mt-0.5">
                {localSearch ? "Try a different search term" : "No users are currently available"}
              </p>
            </div>
          )
        ) : (
          filteredUsers.map((user) => {
            const isSelected = selectedUser?._id === user._id;
            const isOnline = onlineUsers.includes(user._id);
            const timeDisplay = user.lastMessageTime
              ? formatConversationTime(user.lastMessageTime)
              : null;

            return (
              <button
                key={user._id}
                onClick={() => {
                  setSelectedUser(user);
                  // If picked from Explore, seamlessly transition back to chats mode
                  if (filterMode === "explore") {
                    setFilterMode("chats");
                    setLocalSearch("");
                  }
                }}
                className={`w-full p-2.5 rounded-xl flex items-center gap-3 text-left transition-all duration-150 group ${
                  isSelected
                    ? "bg-primary text-primary-content shadow-md shadow-primary/20 scale-[0.99]"
                    : "hover:bg-base-200/80 text-base-content"
                }`}
              >
                {/* Avatar with Status Ring */}
                <div className="relative shrink-0">
                  <img
                    src={user.profilePic || "/avatar.png"}
                    alt={user.fullName}
                    className="size-11 object-cover rounded-full ring-2 ring-base-content/5 shadow-sm"
                  />
                  {isOnline ? (
                    <span className="absolute bottom-0 right-0 size-3 bg-emerald-500 rounded-full ring-2 ring-base-100" />
                  ) : (
                    <span className="absolute bottom-0 right-0 size-2.5 bg-base-content/20 rounded-full ring-2 ring-base-100" />
                  )}
                </div>

                {/* Conversation Meta (WhatsApp style) */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-semibold text-sm truncate ${
                        isSelected ? "text-primary-content" : "text-base-content"
                      }`}
                    >
                      {user.fullName}
                    </span>

                    {/* Time Stamp or Online Badge */}
                    {timeDisplay && filterMode === "chats" ? (
                      <span
                        className={`text-[11px] shrink-0 ml-1.5 ${
                          isSelected ? "text-primary-content/80" : "text-base-content/50"
                        }`}
                      >
                        {timeDisplay}
                      </span>
                    ) : (
                      <span
                        className={`text-[11px] shrink-0 ml-1.5 ${
                          isSelected
                            ? "text-primary-content/80"
                            : isOnline
                            ? "text-emerald-500 font-medium"
                            : "text-base-content/40"
                        }`}
                      >
                        {isOnline ? "online" : "offline"}
                      </span>
                    )}
                  </div>

                  {/* Subtitle: Last Message Preview OR Email */}
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <p
                      className={`text-xs truncate ${
                        isSelected
                          ? "text-primary-content/80"
                          : user.unreadCount > 0
                          ? "font-semibold text-base-content"
                          : "text-base-content/60"
                      }`}
                    >
                      {user.lastMessage ? user.lastMessage : user.email}
                    </p>

                    {/* Unread message counter badge */}
                    {user.unreadCount > 0 && (
                      <span className="badge badge-xs badge-primary shrink-0 font-bold px-1.5 py-2">
                        {user.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Current User Profile Pill at Bottom */}
      {authUser && (
        <div className="p-3 border-t border-base-content/10 bg-base-200/40 flex items-center gap-3 shrink-0">
          <div className="relative">
            <img
              src={authUser.profilePic || "/avatar.png"}
              alt={authUser.fullName}
              className="size-9 rounded-full object-cover ring-2 ring-primary/20"
            />
            <span className="absolute bottom-0 right-0 size-2.5 bg-emerald-500 rounded-full ring-2 ring-base-100" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate text-base-content">{authUser.fullName}</p>
            <p className="text-[11px] text-base-content/50 truncate">{authUser.email}</p>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
