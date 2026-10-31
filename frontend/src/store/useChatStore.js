import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";
import { playNotificationSound, showDesktopNotification } from "../lib/sound";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isLoadingMore: false,
  hasMoreMessages: false,
  typingUsers: {}, // { [userId]: boolean }
  searchQuery: "",
  inChatSearchOpen: false,
  inChatSearchQuery: "",
  activeSearchMatchIndex: 0,
  activeSearchMessageId: null,

  toggleInChatSearch: () =>
    set((state) => ({
      inChatSearchOpen: !state.inChatSearchOpen,
      inChatSearchQuery: "",
      activeSearchMatchIndex: 0,
      activeSearchMessageId: null,
    })),
  setInChatSearchQuery: (query) =>
    set({ inChatSearchQuery: query, activeSearchMatchIndex: 0 }),
  setActiveSearchMatchIndex: (idx) => set({ activeSearchMatchIndex: idx }),
  setActiveSearchMessageId: (id) => set({ activeSearchMessageId: id }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load contacts");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true, hasMoreMessages: false });
    try {
      const res = await axiosInstance.get(`/messages/${userId}?limit=30`);
      const messagesList = Array.isArray(res.data) ? res.data : res.data.messages || [];
      const hasMore =
        res.data?.hasMore !== undefined
          ? res.data.hasMore
          : res.headers?.["x-has-more"] === "true" || messagesList.length >= 30;

      set({
        messages: messagesList,
        hasMoreMessages: hasMore,
      });

      // Auto mark unread incoming messages as read
      get().markMessagesAsRead(userId);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  loadMoreMessages: async () => {
    const { selectedUser, messages, isLoadingMore, hasMoreMessages } = get();
    if (!selectedUser || isLoadingMore || !hasMoreMessages || messages.length === 0) return;

    const earliestCursor = messages[0]?.createdAt;
    if (!earliestCursor) return;

    set({ isLoadingMore: true });
    try {
      const res = await axiosInstance.get(
        `/messages/${selectedUser._id}?cursor=${encodeURIComponent(earliestCursor)}&limit=30`
      );

      const olderMessages = Array.isArray(res.data) ? res.data : res.data.messages || [];
      const stillHasMore =
        res.data?.hasMore !== undefined
          ? res.data.hasMore
          : res.headers?.["x-has-more"] === "true" || olderMessages.length >= 30;

      // Filter out duplicates if any
      const existingIds = new Set(messages.map((m) => m._id));
      const filteredOlder = olderMessages.filter((m) => !existingIds.has(m._id));

      set({
        messages: [...filteredOlder, ...messages],
        hasMoreMessages: stillHasMore,
      });
      return filteredOlder.length;
    } catch (error) {
      console.error("Failed to load more messages:", error);
    } finally {
      set({ isLoadingMore: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, messages } = get();
    const authUser = useAuthStore.getState().authUser;
    if (!selectedUser || !authUser) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Optimistic message
    const optimisticMessage = {
      _id: tempId,
      tempId,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      text: messageData.text || "",
      image: messageData.image || null,
      audio: messageData.audio || null,
      createdAt: new Date().toISOString(),
      status: "sending",
      reactions: [],
      payload: messageData,
    };

    set({ messages: [...messages, optimisticMessage] });

    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);

      // Replace optimistic message with confirmed server response
      set((state) => ({
        messages: state.messages.map((m) =>
          m._id === tempId || m.tempId === tempId ? res.data : m
        ),
      }));
    } catch (error) {
      console.error("Failed to send message:", error);
      // Mark optimistic message as failed
      set((state) => ({
        messages: state.messages.map((m) =>
          m._id === tempId || m.tempId === tempId ? { ...m, status: "failed" } : m
        ),
      }));
      toast.error("Message failed to send. Click to retry.");
    }
  },

  retrySendMessage: async (failedMessageId) => {
    const { messages, selectedUser } = get();
    const targetMsg = messages.find(
      (m) => m._id === failedMessageId || m.tempId === failedMessageId
    );
    if (!targetMsg || !selectedUser) return;

    // Reset status to sending
    set((state) => ({
      messages: state.messages.map((m) =>
        m._id === failedMessageId || m.tempId === failedMessageId
          ? { ...m, status: "sending" }
          : m
      ),
    }));

    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        targetMsg.payload || {
          text: targetMsg.text,
          image: targetMsg.image,
          audio: targetMsg.audio,
        }
      );

      set((state) => ({
        messages: state.messages.map((m) =>
          m._id === failedMessageId || m.tempId === failedMessageId ? res.data : m
        ),
      }));
    } catch {
      set((state) => ({
        messages: state.messages.map((m) =>
          m._id === failedMessageId || m.tempId === failedMessageId
            ? { ...m, status: "failed" }
            : m
        ),
      }));
      toast.error("Retry failed. Please check connection.");
    }
  },

  sendTypingStart: () => {
    const { selectedUser } = get();
    const socket = useAuthStore.getState().socket;
    if (!selectedUser || !socket?.connected) return;
    socket.emit("typing:start", { receiverId: selectedUser._id });
  },

  sendTypingStop: () => {
    const { selectedUser } = get();
    const socket = useAuthStore.getState().socket;
    if (!selectedUser || !socket?.connected) return;
    socket.emit("typing:stop", { receiverId: selectedUser._id });
  },

  markMessagesAsRead: async (senderId) => {
    const socket = useAuthStore.getState().socket;
    if (!senderId) return;

    try {
      await axiosInstance.patch(`/messages/read/${senderId}`);
      if (socket?.connected) {
        socket.emit("message:read", { senderId });
      }

      // Update unread status locally for messages from sender
      set((state) => ({
        messages: state.messages.map((m) =>
          m.senderId === senderId && m.status !== "read" ? { ...m, status: "read" } : m
        ),
      }));
    } catch (error) {
      console.warn("Could not mark messages as read:", error.message);
    }
  },

  reactToMessage: async (messageId, emoji) => {
    const authUser = useAuthStore.getState().authUser;
    if (!authUser) return;

    // Optimistic reaction update
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m._id !== messageId) return m;
        const reactions = [...(m.reactions || [])];
        const existingIdx = reactions.findIndex(
          (r) => r.userId === authUser._id && r.emoji === emoji
        );
        if (existingIdx > -1) {
          reactions.splice(existingIdx, 1);
        } else {
          const userOther = reactions.findIndex((r) => r.userId === authUser._id);
          if (userOther > -1) {
            reactions[userOther].emoji = emoji;
          } else {
            reactions.push({ userId: authUser._id, emoji });
          }
        }
        return { ...m, reactions };
      }),
    }));

    try {
      const res = await axiosInstance.post(`/messages/react/${messageId}`, { emoji });
      set((state) => ({
        messages: state.messages.map((m) => (m._id === messageId ? res.data : m)),
      }));
    } catch (error) {
      console.error("Failed to react to message:", error);
    }
  },

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    // Remove existing to prevent duplicate bindings
    socket.off("newMessage");
    socket.off("typing:start");
    socket.off("typing:stop");
    socket.off("messages:read");
    socket.off("message:reaction");

    socket.on("newMessage", (newMessage) => {
      const { selectedUser } = get();
      const isFromSelected = selectedUser && newMessage.senderId === selectedUser._id;

      // Play chime & desktop notification
      playNotificationSound();
      showDesktopNotification(
        "New Message",
        newMessage.text || (newMessage.image ? "Sent a photo" : "Sent a voice note")
      );

      if (isFromSelected) {
        set((state) => ({
          messages: [...state.messages, newMessage],
        }));

        // Immediately acknowledge read receipt if chat is open
        get().markMessagesAsRead(selectedUser._id);
      }
    });

    socket.on("typing:start", ({ senderId }) => {
      set((state) => ({
        typingUsers: { ...state.typingUsers, [senderId]: true },
      }));
    });

    socket.on("typing:stop", ({ senderId }) => {
      set((state) => ({
        typingUsers: { ...state.typingUsers, [senderId]: false },
      }));
    });

    socket.on("messages:read", ({ readerId }) => {
      const { selectedUser } = get();
      // If current selected user read our messages, mark our outgoing messages as read
      if (selectedUser && selectedUser._id === readerId) {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.senderId !== readerId ? { ...m, status: "read" } : m
          ),
        }));
      }
    });

    socket.on("message:reaction", ({ messageId, reactions }) => {
      set((state) => ({
        messages: state.messages.map((m) => (m._id === messageId ? { ...m, reactions } : m)),
      }));
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newMessage");
    socket.off("typing:start");
    socket.off("typing:stop");
    socket.off("messages:read");
    socket.off("message:reaction");
  },

  setSelectedUser: (selectedUser) => {
    set({
      selectedUser,
      messages: [],
      hasMoreMessages: false,
      inChatSearchOpen: false,
      inChatSearchQuery: "",
      activeSearchMatchIndex: 0,
      activeSearchMessageId: null,
    });
  },
}));
