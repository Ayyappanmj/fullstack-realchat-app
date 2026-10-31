import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { LogOut, MessageSquare, Settings } from "lucide-react";

const Navbar = () => {
  const { logout, authUser } = useAuthStore();

  return (
    <header className="bg-base-100/80 border-b border-base-content/10 fixed w-full top-0 z-40 backdrop-blur-md transition-all">
      <div className="container mx-auto px-4 h-16">
        <div className="flex items-center justify-between h-full">
          {/* Brand */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-90 transition-all">
              <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
                <MessageSquare className="size-5" />
              </div>
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Chatty
              </h1>
            </Link>
          </div>

          {/* Right Action Nav */}
          <div className="flex items-center gap-2">
            <Link
              to="/settings"
              className="btn btn-sm btn-ghost rounded-xl gap-2 text-base-content/75 hover:text-base-content hover:bg-base-200"
            >
              <Settings className="size-4" />
              <span className="hidden sm:inline text-xs font-medium">Settings</span>
            </Link>

            {authUser && (
              <>
                <Link
                  to="/profile"
                  className="btn btn-sm btn-ghost rounded-xl gap-2 text-base-content/75 hover:text-base-content hover:bg-base-200"
                >
                  <img
                    src={authUser.profilePic || "/avatar.png"}
                    alt={authUser.fullName}
                    className="size-5 rounded-full object-cover ring-1 ring-base-content/20"
                  />
                  <span className="hidden sm:inline text-xs font-medium">Profile</span>
                </Link>

                <button
                  onClick={logout}
                  className="btn btn-sm btn-ghost rounded-xl gap-2 text-error/80 hover:text-error hover:bg-error/10 transition-colors"
                  title="Logout"
                >
                  <LogOut className="size-4" />
                  <span className="hidden sm:inline text-xs font-medium">Logout</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
