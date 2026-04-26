export function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden bg-[#1a1a1a] p-3 animate-fade-in">
      <div className="skeleton aspect-square rounded-xl mb-3" />
      <div className="skeleton h-4 rounded w-3/4 mb-2" />
      <div className="skeleton h-3 rounded w-1/2" />
    </div>
  );
}

export function SkeletonTrack() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="skeleton w-10 h-10 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="skeleton h-4 rounded w-2/3 mb-2" />
        <div className="skeleton h-3 rounded w-1/3" />
      </div>
      <div className="skeleton h-3 rounded w-10" />
    </div>
  );
}

export function SkeletonBanner() {
  return (
    <div className="skeleton rounded-3xl w-full h-64 mb-8" />
  );
}

export function ServerWakeup() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-[#C8FF3E]/20" />
        <div className="absolute inset-0 rounded-full border-t-2 border-[#C8FF3E] animate-spin" />
        <div className="absolute inset-3 rounded-full bg-[#C8FF3E]/10 flex items-center justify-center">
          <span className="text-xl">🎵</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-white font-semibold mb-1">Nyalain server dulu...</p>
        <p className="text-white/40 text-sm font-mono">Server Lagi proses nyala...</p>
      </div>
      <div className="flex gap-1 mt-2">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#C8FF3E]"
            style={{ animation: `bounce 1s ease-in-out ${i * 0.15}s infinite alternate` }}
          />
        ))}
      </div>
      <style>{`
        @keyframes bounce {
          from { transform: translateY(0); opacity: 0.3; }
          to { transform: translateY(-8px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
