import { Users } from "lucide-react";

const SidebarSkeleton = () => {
  const skeletonContacts = Array(7).fill(null);

  return (
    <aside className="h-full w-full md:w-80 lg:w-88 border-r border-base-content/10 flex flex-col bg-base-100/50 backdrop-blur-sm">
      {/* Header Skeleton */}
      <div className="border-b border-base-content/10 w-full p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="size-5 text-primary animate-pulse" />
            </div>
            <div className="h-5 w-24 bg-base-300 rounded-md animate-pulse" />
          </div>
          <div className="h-5 w-16 bg-base-300 rounded-full animate-pulse" />
        </div>
        <div className="h-9 w-full bg-base-300 rounded-xl animate-pulse" />
      </div>

      {/* Skeleton Contacts List */}
      <div className="overflow-y-auto flex-1 w-full p-2 space-y-2">
        {skeletonContacts.map((_, idx) => (
          <div
            key={idx}
            className="w-full p-3 rounded-xl flex items-center gap-3 bg-base-200/40 animate-pulse"
          >
            {/* Avatar skeleton */}
            <div className="size-12 rounded-full bg-base-300 shrink-0" />

            {/* User info skeleton */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="h-4 w-28 bg-base-300 rounded" />
              <div className="h-3 w-16 bg-base-300/70 rounded" />
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};

export default SidebarSkeleton;
