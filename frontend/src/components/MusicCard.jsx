import { useState } from 'react';
import { Play, Heart, Music } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

export default function MusicCard({ track, size = 'md' }) {
  const { playTrack, currentTrack, isPlaying, toggleLike, isLiked } = usePlayer();
  const [hovered, setHovered] = useState(false);

  const isActive = currentTrack?.videoId === track.videoId;
  const liked = isLiked(track.videoId);

  const sizeClasses = {
    sm: 'w-full',
    md: 'w-full',
    lg: 'w-full',
  };

  return (
    <div
      className={`music-card bg-[#1a1a1a] hover:bg-[#222] ${sizeClasses[size]} animate-slide-up`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => playTrack(track)}
    >
      {/* Cover */}
      <div className="relative aspect-square overflow-hidden">
        {track.thumbnail ? (
          <img
            src={track.thumbnail}
            alt={track.title}
            className={`w-full h-full object-cover transition-transform duration-500 ${hovered ? 'scale-110' : 'scale-100'}`}
            loading="lazy"
            onError={(e) => {
              // maxresdefault kadang gak exist — fallback ke hqdefault
              if (e.target.src.includes('maxresdefault')) {
                e.target.src = e.target.src.replace('maxresdefault', 'hqdefault');
              }
            }}
          />
        ) : (
          <div className="w-full h-full bg-[#2a2a2a] flex items-center justify-center">
            <Music size={32} className="text-white/20" />
          </div>
        )}

        {/* Overlay */}
        <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-200 ${hovered ? 'opacity-100' : 'opacity-0'}`}>
          <button
            onClick={(e) => { e.stopPropagation(); playTrack(track); }}
            className="w-12 h-12 rounded-full bg-[#C8FF3E] flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
          >
            <Play size={20} fill="black" className="text-black ml-0.5" />
          </button>
        </div>

        {/* Like button */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleLike(track); }}
          className={`absolute top-2 right-2 p-1.5 rounded-full bg-black/60 transition-all duration-200
            ${liked ? 'opacity-100 text-[#C8FF3E]' : `${hovered ? 'opacity-100' : 'opacity-0'} text-white/70 hover:text-white`}`}
        >
          <Heart size={13} fill={liked ? 'currentColor' : 'none'} />
        </button>

        {/* Active indicator */}
        {isActive && (
          <div className="absolute bottom-2 left-2 flex items-end gap-[2px] bg-black/60 rounded px-1.5 py-1">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="w-[3px] rounded-full bg-[#C8FF3E]"
                style={{
                  height: isPlaying ? `${[10, 16, 12][i - 1]}px` : '4px',
                  animation: isPlaying ? `barPulse 0.8s ease-in-out ${i * 0.15}s infinite alternate` : 'none',
                  transition: 'height 0.2s',
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className={`text-sm font-semibold truncate leading-tight ${isActive ? 'text-[#C8FF3E]' : 'text-white'}`}>
          {track.title}
        </p>
        <p className="text-xs text-white/40 truncate mt-0.5">{track.artist}</p>
      </div>

      <style>{`
        @keyframes barPulse {
          from { transform: scaleY(0.4); }
          to { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
