const MessageSkeleton = () => {
  const skeletonMessages = [
    { isEnd: false, width: "w-48", height: "h-12" },
    { isEnd: true, width: "w-64", height: "h-16" },
    { isEnd: false, width: "w-52", height: "h-10" },
    { isEnd: true, width: "w-40", height: "h-12" },
    { isEnd: false, width: "w-72", height: "h-20" },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Date pill skeleton */}
      <div className="flex justify-center">
        <div className="h-6 w-24 bg-base-300 rounded-full animate-pulse" />
      </div>

      {skeletonMessages.map((item, idx) => (
        <div
          key={idx}
          className={`flex items-end gap-2.5 ${item.isEnd ? "flex-row-reverse" : "flex-row"}`}
        >
          {/* Avatar */}
          <div className="size-8 rounded-full bg-base-300 shrink-0 animate-pulse" />

          {/* Message content */}
          <div className={`flex flex-col space-y-1.5 ${item.isEnd ? "items-end" : "items-start"}`}>
            <div className="h-3 w-12 bg-base-300/60 rounded animate-pulse" />
            <div
              className={`${item.width} ${item.height} rounded-2xl ${
                item.isEnd ? "rounded-tr-sm bg-primary/20" : "rounded-tl-sm bg-base-200"
              } animate-pulse`}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default MessageSkeleton;
