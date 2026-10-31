import { MessageSquare, Zap, Shield, Smile, Radio } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const NoChatSelected = () => {
  const { authUser, onlineUsers } = useAuthStore();
  const { users, setSelectedUser } = useChatStore();

  const otherOnlineUsers = users.filter(
    (u) => onlineUsers.includes(u._id) && u._id !== authUser?._id
  );

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center p-6 sm:p-12 bg-base-100/40 select-none">
      <div className="max-w-lg w-full text-center space-y-6">
        {/* Animated Brand Emblem */}
        <div className="flex justify-center">
          <div className="relative group cursor-pointer">
            <div className="absolute -inset-2 bg-gradient-to-r from-primary/30 to-secondary/30 rounded-3xl blur-xl opacity-70 group-hover:opacity-100 transition-opacity" />
            <div className="relative size-20 rounded-2xl bg-gradient-to-tr from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-xl group-hover:scale-105 transition-transform duration-300">
              <MessageSquare className="size-10 text-primary drop-shadow-sm animate-pulse" />
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-base-100" />
            </span>
          </div>
        </div>

        {/* Heading & Subtitle */}
        <div className="space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-base-content">
            Welcome, {authUser?.fullName?.split(" ")[0] || "Friend"}!
          </h2>
          <p className="text-sm text-base-content/60 max-w-sm mx-auto leading-relaxed">
            Select a conversation from the sidebar or click an active contact below to start chatting instantly.
          </p>
        </div>

        {/* Active Online Contacts Bar */}
        {otherOnlineUsers.length > 0 && (
          <div className="bg-base-200/60 backdrop-blur-sm rounded-2xl p-4 border border-base-content/10 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-base-content/80 flex items-center gap-1.5">
                <Radio className="size-3.5 text-emerald-500 animate-pulse" />
                <span>Online Right Now ({otherOnlineUsers.length})</span>
              </span>
              <span className="text-[11px] text-base-content/50">Click to chat</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {otherOnlineUsers.slice(0, 4).map((user) => (
                <button
                  key={user._id}
                  onClick={() => setSelectedUser(user)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-base-100 hover:bg-primary hover:text-primary-content border border-base-content/10 transition-all text-xs font-medium group"
                >
                  <img
                    src={user.profilePic || "/avatar.png"}
                    alt={user.fullName}
                    className="size-5 rounded-full object-cover"
                  />
                  <span className="truncate max-w-[120px]">{user.fullName}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-3 gap-3 pt-2 text-left">
          <div className="p-3 rounded-2xl bg-base-200/40 border border-base-content/5 flex flex-col gap-1.5">
            <Zap className="size-5 text-amber-500" />
            <span className="text-xs font-semibold text-base-content">Real-Time</span>
            <span className="text-[11px] text-base-content/50 leading-tight">
              Instant delivery & read receipts
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-base-200/40 border border-base-content/5 flex flex-col gap-1.5">
            <Smile className="size-5 text-sky-500" />
            <span className="text-xs font-semibold text-base-content">Rich Media</span>
            <span className="text-[11px] text-base-content/50 leading-tight">
              Voice notes, photos & emoji reactions
            </span>
          </div>

          <div className="p-3 rounded-2xl bg-base-200/40 border border-base-content/5 flex flex-col gap-1.5">
            <Shield className="size-5 text-emerald-500" />
            <span className="text-xs font-semibold text-base-content">Reliable</span>
            <span className="text-[11px] text-base-content/50 leading-tight">
              Optimistic updates with retry queue
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoChatSelected;
