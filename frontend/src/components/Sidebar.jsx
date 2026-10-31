import { useEffect, useState, useMemo } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users, Search, X } from "lucide-react";

const Sidebar = () => {
  const { getUsers, users, selectedUser, setSelectedUser, isUsersLoading } = useChatStore();
  const { onlineUsers, authUser } = useAuthStore();

  const [filterMode, setFilterMode] = useState("all"); // "all" | "online"
  const [localSearch, setLocalSearch] = useState("");

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  const onlineCount = useMemo(() => {
    return users.filter((user) => onlineUsers.includes(user._id)).length;
  }, [users, onlineUsers]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const isOnline = onlineUsers.includes(user._id);
      if (filterMode === "online" && !isOnline) return false;

      if (localSearch.trim()) {
        const query = localSearch.toLowerCase().trim();
        const matchName = user.fullName?.toLowerCase().includes(query);
        const matchEmail = user.email?.toLowerCase().includes(query);
        return matchName || matchEmail;
      }
      return true;
    });
  }, [users, onlineUsers, filterMode, localSearch]);

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="h-full w-full md:w-80 lg:w-88 border-r border-base-content/10 flex flex-col bg-base-100/60 backdrop-blur-md transition-all duration-300">
      {/* Header & Controls */}
      <div className="p-4 border-b border-base-content/10 space-y-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Users className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold text-base tracking-tight">Messages</h2>
              <p className="text-xs text-base-content/60">
                {users.length} {users.length === 1 ? "contact" : "contacts"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-medium">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{onlineCount} online</span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-base-content/40">
            <Search className="size-4" />
          </div>
          <input
            type="text"
            placeholder="Search conversations..."
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

        {/* Filter Pills */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterMode("all")}
            className={`btn btn-xs rounded-lg flex-1 font-medium transition-all ${
              filterMode === "all"
                ? "btn-primary shadow-sm"
                : "btn-ghost bg-base-200/70 hover:bg-base-200 text-base-content/70"
            }`}
          >
            All ({users.length})
          </button>
          <button
            onClick={() => setFilterMode("online")}
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

      {/* Users List */}
      <div className="overflow-y-auto flex-1 p-2 space-y-1">
        {filteredUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center p-4">
            <div className="size-12 rounded-full bg-base-200 flex items-center justify-center mb-2 text-base-content/40">
              <Users className="size-6" />
            </div>
            <p className="text-sm font-medium text-base-content/70">No conversations found</p>
            <p className="text-xs text-base-content/50 mt-0.5">
              {localSearch ? "Try a different search term" : "No users are currently available"}
            </p>
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isSelected = selectedUser?._id === user._id;
            const isOnline = onlineUsers.includes(user._id);

            return (
              <button
                key={user._id}
                onClick={() => setSelectedUser(user)}
                className={`w-full p-2.5 rounded-xl flex items-center gap-3 text-left transition-all duration-150 group ${
                  isSelected
                    ? "bg-primary text-primary-content shadow-md shadow-primary/20 scale-[0.99]"
                    : "hover:bg-base-200/80 text-base-content"
                }`}
              >
                {/* Avatar with indicator */}
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

                {/* User info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-semibold text-sm truncate ${
                        isSelected ? "text-primary-content" : "text-base-content"
                      }`}
                    >
                      {user.fullName}
                    </span>
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
                  </div>
                  <p
                    className={`text-xs truncate mt-0.5 ${
                      isSelected ? "text-primary-content/80" : "text-base-content/60"
                    }`}
                  >
                    {user.email}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Current User Pill at Bottom */}
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
