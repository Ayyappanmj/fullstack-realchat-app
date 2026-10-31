import { useChatStore } from "../store/useChatStore";
import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";

const HomePage = () => {
  const { selectedUser } = useChatStore();

  return (
    <div className="h-[100dvh] w-full bg-gradient-to-br from-base-200 via-base-300/40 to-base-200 flex flex-col justify-center items-center p-0 sm:p-4 md:p-6 overflow-hidden">
      {/* Ambient background glow orbs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 size-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 size-96 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container Shell */}
      <div className="w-full max-w-7xl h-full sm:h-[calc(100dvh-5rem)] sm:mt-16 bg-base-100/80 backdrop-blur-md border border-base-content/10 sm:rounded-3xl shadow-2xl overflow-hidden flex z-10">
        {/* Sidebar: on mobile, visible only if no chat is selected */}
        <div
          className={`h-full ${
            selectedUser ? "hidden md:flex" : "flex w-full"
          } md:w-80 lg:w-88 shrink-0 transition-all duration-200`}
        >
          <Sidebar />
        </div>

        {/* Chat Area: on mobile, visible only when a chat is selected */}
        <div
          className={`flex-1 h-full ${
            !selectedUser ? "hidden md:flex" : "flex w-full"
          } flex-col overflow-hidden`}
        >
          {!selectedUser ? <NoChatSelected /> : <ChatContainer />}
        </div>
      </div>
    </div>
  );
};

export default HomePage;
