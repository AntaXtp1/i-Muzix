import { useState } from 'react';
import { Heart, Music, Shuffle, Play, Trash2 } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import TrackRow from '../components/TrackRow';

export default function LibraryPage() {
  const { likedTracks, playTrack, toggleLike } = usePlayer();
  const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'title' | 'artist'

  const sorted = [...likedTracks].sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'artist') return a.artist.localeCompare(b.artist);
    return 0; // recent = as-is (newest first, already prepended)
  });

  const playAll = () => {
    if (sorted.length === 0) return;
    playTrack(sorted[0], sorted);
  };

  const shufflePlay = () => {
    if (sorted.length === 0) return;
    const shuffled = [...sorted].sort(() => Math.random() - 0.5);
    playTrack(shuffled[0], shuffled);
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-end gap-6 mb-8">
        {/* Cover collage */}
        <div className="relative w-36 h-36 rounded-2xl overflow-hidden flex-shrink-0 bg-[#1a1a1a] shadow-2xl">
          {likedTracks.length === 0 ? (
            <div className="w-full h-full flex items-center justify-center">
              <Heart size={40} className="text-white/10" />
            </div>
          ) : likedTracks.length === 1 ? (
            <img src={likedTracks[0].thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="grid grid-cols-2 w-full h-full">
              {likedTracks.slice(0, 4).map((t, i) => (
                <div key={i} className="overflow-hidden bg-[#2a2a2a]">
                  {t.thumbnail
                    ? <img src={t.thumbnail} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Music size={12} className="text-white/20" /></div>
                  }
                </div>
              ))}
            </div>
          )}
          {/* Lime overlay badge */}
          <div className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-[#C8FF3E] flex items-center justify-center shadow-lg">
            <Heart size={13} fill="black" className="text-black" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/30 font-mono uppercase tracking-widest mb-2">Playlist</p>
          <h1 className="text-4xl font-extrabold text-white mb-1">Liked Songs</h1>
          <p className="text-white/40 text-sm">
            {likedTracks.length === 0
              ? 'Belum ada lagu yang di-like'
              : `${likedTracks.length} lagu · Disimpen di browser lo`}
          </p>

          {likedTracks.length > 0 && (
            <div className="flex items-center gap-3 mt-5">
              <button
                onClick={playAll}
                className="btn-accent flex items-center gap-2 text-sm"
              >
                <Play size={14} fill="black" />
                Play All
              </button>
              <button
                onClick={shufflePlay}
                className="btn-ghost flex items-center gap-2 text-sm"
              >
                <Shuffle size={14} />
                Shuffle
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Empty state */}
      {likedTracks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-[#C8FF3E]/10 flex items-center justify-center mb-5">
            <Heart size={32} className="text-[#C8FF3E]/60" />
          </div>
          <h3 className="text-white font-bold text-lg mb-2">Belum ada lagu</h3>
          <p className="text-white/30 text-sm text-center max-w-xs">
            Hover lagu manapun terus klik ❤️ buat nambahin ke sini
          </p>
        </div>
      )}

      {/* Track list */}
      {likedTracks.length > 0 && (
        <>
          {/* Sort controls */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-white/30 font-mono mr-1">Sort:</span>
            {['recent', 'title', 'artist'].map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all duration-200
                  ${sortBy === s
                    ? 'bg-[#C8FF3E]/10 text-[#C8FF3E] border border-[#C8FF3E]/30'
                    : 'text-white/30 hover:text-white hover:bg-white/5'
                  }`}
              >
                {s === 'recent' ? 'Terbaru' : s === 'title' ? 'Judul' : 'Artis'}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="bg-[#111] rounded-2xl overflow-hidden border border-white/5">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
              <span className="w-8 text-xs text-white/25 font-mono text-center">#</span>
              <span className="w-10" />
              <span className="flex-1 text-xs text-white/25 font-mono uppercase tracking-wider">Title</span>
              <span className="hidden md:block text-xs text-white/25 font-mono uppercase tracking-wider w-32">Album</span>
              <span className="w-20" />
              <span className="w-10 text-xs text-white/25 font-mono text-right">Time</span>
            </div>

            {sorted.map((track, i) => (
              <TrackRow
                key={track.videoId}
                track={track}
                index={i}
                queue={sorted}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
