import { useState } from 'react';
import { Play, Heart, MoreHorizontal, Music } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export default function TrackRow({ track, index, queue, showIndex = true }) {
  const { playTrack, currentTrack, isPlaying, toggleLike, isLiked } = usePlayer();
  const [hovered, setHovered] = useState(false);

  const isActive = currentTrack?.videoId === track.videoId;
  const liked = isLiked(track.videoId);

  const handlePlay = (e) => {
    e.stopPropagation();
    playTrack(track, queue || [track]);
  };

  const handleLike = (e) => {
    e.stopPropagation();
    toggleLike(track);
  };

  return (
    <div
      className={`track-row group ${isActive ? 'active' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handlePlay}
    >
      {/* Index / Play button */}
      <div className="w-8 flex items-center justify-center flex-shrink-0">
        {hovered ? (
          <button
            onClick={handlePlay}
            className="text-white hover:text-[#C8FF3E] transition-colors"
          >
            <Play size={15} fill="currentColor" />
          </button>
        ) : isActive && isPlaying ? (
          <div className="flex items-end gap-[2px] h-4">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="w-[3px] rounded-full bg-[#C8FF3E]"
                style={{
                  animation: `barPulse 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
                  height: `${[60, 100, 70][i - 1]}%`,
                }}
              />
            ))}
            <style>{`
              @keyframes barPulse {
                from { transform: scaleY(0.4); }
                to { transform: scaleY(1); }
              }
            `}</style>
          </div>
        ) : showIndex ? (
          <span className={`text-sm font-mono ${isActive ? 'text-[#C8FF3E]' : 'text-white/30'}`}>
            {index + 1}
          </span>
        ) : (
          <Music size={14} className="text-white/30" />
        )}
      </div>

      {/* Thumbnail */}
      <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
        {track.thumbnail ? (
          <img
            src={track.thumbnail}
            alt={track.title}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Music size={14} className="text-white/20" />
          </div>
        )}
        {isActive && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-[#C8FF3E]" />
          </div>
        )}
      </div>

      {/* Track info */}
      <div className="flex-1 min-w-0">
        <p className={`track-title text-sm font-semibold truncate leading-tight ${isActive ? 'text-[#C8FF3E]' : 'text-white'}`}>
          {track.title}
        </p>
        <p className="text-xs text-white/40 truncate mt-0.5">{track.artist}</p>
      </div>

      {/* Album */}
      {track.album && (
        <p className="text-xs text-white/30 truncate hidden md:block max-w-[120px]">
          {track.album}
        </p>
      )}

      {/* Actions */}
      <div className={`flex items-center gap-2 transition-opacity duration-150 ${hovered || liked ? 'opacity-100' : 'opacity-0'}`}>
        <button
          onClick={handleLike}
          className={`p-1.5 rounded-full transition-all duration-200 ${liked ? 'text-[#C8FF3E]' : 'text-white/30 hover:text-white'}`}
        >
          <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Duration */}
      <span className="text-xs text-white/30 font-mono w-10 text-right flex-shrink-0">
        {track.duration || '—'}
      </span>
    </div>
  );
}
