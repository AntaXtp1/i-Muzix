import { useRef } from 'react';
import {
  Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Repeat1,
  Volume2, VolumeX, Music, Heart, Settings, Wifi, WifiOff
} from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

function formatTime(secs) {
  if (!secs || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlayerBar() {
  const {
    currentTrack, isPlaying, loading, streamError, embedUrl,
    progress, duration, volume, setVolume,
    shuffle, setShuffle, repeat, setRepeat,
    quality, setQuality,
    togglePlay, handleNext, handlePrev, seekTo,
    toggleLike, isLiked,
    embedRef, onEmbedLoad,
  } = usePlayer();

  const progressRef = useRef(null);
  const volumeRef = useRef(null);

  const handleProgressClick = (e) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seekTo(ratio * duration);
  };

  const handleVolumeClick = (e) => {
    if (!volumeRef.current) return;
    const rect = volumeRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(ratio);
  };

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;
  const liked = currentTrack ? isLiked(currentTrack.videoId) : false;

  const cycleRepeat = () => {
    setRepeat(r => r === 'none' ? 'all' : r === 'all' ? 'one' : 'none');
  };

  return (
    <div
      className="flex items-center gap-4 px-6 bg-[#0d0d0d] border-t border-white/5"
      style={{ height: 'var(--player-height)', flexShrink: 0 }}
    >
      {/* Left: Track info */}
      <div className="flex items-center gap-3 w-64 flex-shrink-0">
        {/* Cover art */}
        <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-[#1a1a1a]">
          {currentTrack?.thumbnail ? (
            <img
              src={currentTrack.thumbnail}
              alt={currentTrack.title}
              className={`w-full h-full object-cover ${isPlaying ? 'cover-spinning' : ''}`}
              style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}
              onError={(e) => {
                if (e.target.src.includes('maxresdefault')) {
                  e.target.src = e.target.src.replace('maxresdefault', 'hqdefault');
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music size={18} className="text-white/20" />
            </div>
          )}
          {isPlaying && currentTrack && (
            <div className="pulse-ring" style={{
              position: 'absolute', inset: '-3px', borderRadius: '14px',
              border: '1.5px solid #C8FF3E',
              animation: 'pulseRing 2s ease-out infinite',
            }} />
          )}
        </div>

        {/* Track name */}
        <div className="min-w-0 flex-1">
          {currentTrack ? (
            <>
              <p className="text-sm font-semibold truncate text-white leading-tight">
                {currentTrack.title}
              </p>
              <p className="text-xs text-white/40 truncate mt-0.5">{currentTrack.artist}</p>
            </>
          ) : (
            <p className="text-xs text-white/25 font-mono">No track playing</p>
          )}
        </div>

        {/* Like */}
        {currentTrack && (
          <button
            onClick={() => toggleLike(currentTrack)}
            className={`p-1.5 rounded-full transition-all duration-200 flex-shrink-0
              ${liked ? 'text-[#C8FF3E]' : 'text-white/30 hover:text-white'}`}
          >
            <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      {/* Center: Controls */}
      <div className="flex-1 flex flex-col items-center gap-2 max-w-xl">
        {/* Buttons */}
        <div className="flex items-center gap-5">
          {/* Shuffle */}
          <button
            onClick={setShuffle}
            className={`transition-colors duration-200 ${shuffle ? 'text-[#C8FF3E]' : 'text-white/30 hover:text-white'}`}
          >
            <Shuffle size={15} />
          </button>

          {/* Prev */}
          <button
            onClick={handlePrev}
            className="text-white/70 hover:text-white transition-colors"
            disabled={!currentTrack}
          >
            <SkipBack size={20} fill="currentColor" />
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            disabled={loading}
            className="w-10 h-10 rounded-full bg-[#C8FF3E] flex items-center justify-center
              hover:scale-110 active:scale-95 transition-all duration-150 shadow-lg
              disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ boxShadow: isPlaying ? '0 0 16px rgba(200,255,62,0.4)' : 'none' }}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause size={16} fill="black" className="text-black" />
            ) : (
              <Play size={16} fill="black" className="text-black ml-0.5" />
            )}
          </button>

          {/* Next */}
          <button
            onClick={handleNext}
            className="text-white/70 hover:text-white transition-colors"
            disabled={!currentTrack}
          >
            <SkipForward size={20} fill="currentColor" />
          </button>

          {/* Repeat */}
          <button
            onClick={cycleRepeat}
            className={`transition-colors duration-200 relative
              ${repeat !== 'none' ? 'text-[#C8FF3E]' : 'text-white/30 hover:text-white'}`}
          >
            {repeat === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 w-full">
          <span className="text-xs text-white/30 font-mono w-9 text-right">
            {formatTime(progress)}
          </span>
          <div
            ref={progressRef}
            onClick={handleProgressClick}
            className="progress-bar flex-1 h-1 rounded-full cursor-pointer group"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <div
              className="h-full rounded-full relative transition-all duration-100"
              style={{
                width: `${progressPercent}%`,
                background: embedUrl ? 'rgba(200,255,62,0.4)' : '#C8FF3E',
              }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white
                opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2 shadow" />
            </div>
          </div>
          <span className="text-xs text-white/30 font-mono w-9">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* Right: Volume + Quality */}
      <div className="flex items-center gap-3 w-52 justify-end flex-shrink-0">
        {/* Stream status */}
        {currentTrack && (
          <div className="flex items-center gap-1">
            {embedUrl ? (
              <span title="Embed mode (fallback)" className="text-yellow-500/60">
                <WifiOff size={12} />
              </span>
            ) : streamError ? (
              <span className="text-red-500/60"><WifiOff size={12} /></span>
            ) : (
              <span className="text-[#C8FF3E]/40"><Wifi size={12} /></span>
            )}
          </div>
        )}

        {/* Quality toggle */}
        <button
          onClick={() => setQuality(q => q === 'normal' ? 'high' : 'normal')}
          className={`text-xs font-mono px-2 py-1 rounded-md border transition-all duration-200
            ${quality === 'high'
              ? 'border-[#C8FF3E]/50 text-[#C8FF3E] bg-[#C8FF3E]/10'
              : 'border-white/10 text-white/30 hover:border-white/20 hover:text-white/50'
            }`}
          title="Toggle audio quality"
        >
          {quality === 'high' ? 'HQ' : 'NQ'}
        </button>

        {/* Volume */}
        <button
          onClick={() => setVolume(v => v > 0 ? 0 : 0.8)}
          className="text-white/40 hover:text-white transition-colors"
        >
          {volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
        <div
          ref={volumeRef}
          onClick={handleVolumeClick}
          className="progress-bar w-20 h-1 rounded-full cursor-pointer group"
          style={{ background: 'rgba(255,255,255,0.1)' }}
        >
          <div
            className="h-full rounded-full relative"
            style={{ width: `${volume * 100}%`, background: '#C8FF3E' }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white
              opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2 shadow" />
          </div>
        </div>
      </div>

      {/* Embed iframe (hidden, last resort) */}
      {embedUrl && (
        <iframe
          ref={embedRef}
          src={embedUrl}
          className="hidden"
          allow="autoplay"
          title="audio-fallback"
          onLoad={onEmbedLoad}
        />
      )}
    </div>
  );
}
