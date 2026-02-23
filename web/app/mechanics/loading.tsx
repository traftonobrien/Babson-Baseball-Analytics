export default function MechanicsLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      {/* Header skeleton */}
      <div className="border-b border-zinc-800/50 px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="h-3 w-24 bg-zinc-800 rounded mb-2" />
          <div className="h-8 w-48 bg-zinc-800 rounded mb-1" />
          <div className="h-4 w-72 bg-zinc-800/60 rounded mb-4" />
          <div className="h-3 w-32 bg-zinc-800/40 rounded" />
        </div>
      </div>

      {/* Controls skeleton */}
      <div className="px-6 py-4 border-b border-zinc-800/30">
        <div className="max-w-6xl mx-auto flex flex-wrap gap-3">
          <div className="h-10 flex-1 min-w-48 max-w-xs bg-zinc-800/60 rounded-lg" />
          <div className="h-10 w-32 bg-zinc-800/60 rounded-lg" />
          <div className="h-10 w-36 bg-zinc-800/60 rounded-lg" />
        </div>
      </div>

      {/* Card grid skeleton */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden animate-pulse"
            >
              <div className="h-24 bg-zinc-800/60" />
              <div className="p-4 space-y-3">
                <div className="h-4 w-3/4 bg-zinc-800/60 rounded" />
                <div className="h-3 w-1/2 bg-zinc-800/40 rounded" />
                <div className="flex gap-3">
                  <div className="h-8 w-16 bg-zinc-800/60 rounded" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-full bg-zinc-800/40 rounded" />
                    <div className="h-3 w-2/3 bg-zinc-800/40 rounded" />
                  </div>
                </div>
                <div className="h-3 w-1/3 bg-zinc-800/40 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
