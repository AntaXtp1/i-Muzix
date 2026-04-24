import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import api from '../utils/api';

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const audioRef = useRef(null);
  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState('none'); // 'none' | 'all' | 'one'
  const [quality, setQuality] = useState(() => localStorage.getItem('imuzik_quality') || 'normal');
  const [loading, setLoading] = useState(false);
  const [streamError, setStreamError] = useState(false);
  const [embedUrl, setEmbedUrl] = useState(null);
  const [likedTracks, setLikedTracks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('imuzik_liked') || '[]'); }
    catch { return []; }
  });

  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : null;

  // Persist quality
  useEffect(() => {
    localStorage.setItem('imuzik_quality', quality);
  }, [quality]);

  // Persist liked
  useEffect(() => {
    localStorage.setItem('imuzik_liked', JSON.stringify(likedTracks));
  }, [likedTracks]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onEnded = () => handleNext();
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onError = () => {
      setStreamError(true);
      setLoading(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
    };
  }, []);

  // Update volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const loadAndPlay = useCallback(async (track) => {
    if (!track?.videoId) return;
    setLoading(true);
    setStreamError(false);
    setEmbedUrl(null);

    try {
      const data = await api.stream(track.videoId, quality);
      if (data.method === 'stream' && data.url) {
        const audio = audioRef.current;
        audio.src = data.url;
        audio.load();
        await audio.play();
        setIsPlaying(true);
        setEmbedUrl(null);
      } else if (data.embedUrl) {
        // Fallback to embed
        setEmbedUrl(data.embedUrl);
        setIsPlaying(true);
        setStreamError(false);
      }
    } catch (err) {
      setStreamError(true);
    } finally {
      setLoading(false);
    }
  }, [quality]);

  const playTrack = useCallback((track, newQueue = null) => {
    if (newQueue) {
      setQueue(newQueue);
      const idx = newQueue.findIndex(t => t.videoId === track.videoId);
      setCurrentIndex(idx >= 0 ? idx : 0);
    } else {
      const idx = queue.findIndex(t => t.videoId === track.videoId);
      if (idx >= 0) {
        setCurrentIndex(idx);
      } else {
        setQueue(prev => [...prev, track]);
        setCurrentIndex(queue.length);
      }
    }
    loadAndPlay(track);
  }, [queue, loadAndPlay]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (embedUrl) {
      setIsPlaying(p => !p);
      return;
    }
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }, [isPlaying, embedUrl]);

  const handleNext = useCallback(() => {
    if (queue.length === 0) return;
    let nextIdx;
    if (repeat === 'one') {
      nextIdx = currentIndex;
    } else if (shuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else {
      nextIdx = (currentIndex + 1) % queue.length;
    }
    setCurrentIndex(nextIdx);
    loadAndPlay(queue[nextIdx]);
  }, [queue, currentIndex, repeat, shuffle, loadAndPlay]);

  const handlePrev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const prevIdx = currentIndex <= 0 ? queue.length - 1 : currentIndex - 1;
    setCurrentIndex(prevIdx);
    loadAndPlay(queue[prevIdx]);
  }, [queue, currentIndex, loadAndPlay]);

  const seekTo = useCallback((time) => {
    const audio = audioRef.current;
    if (audio && !embedUrl) {
      audio.currentTime = time;
      setProgress(time);
    }
  }, [embedUrl]);

  const toggleLike = useCallback((track) => {
    setLikedTracks(prev => {
      const exists = prev.find(t => t.videoId === track.videoId);
      if (exists) return prev.filter(t => t.videoId !== track.videoId);
      return [track, ...prev];
    });
  }, []);

  const isLiked = useCallback((videoId) =>
    likedTracks.some(t => t.videoId === videoId), [likedTracks]);

  // Re-load when quality changes and something is playing
  useEffect(() => {
    if (currentTrack && isPlaying) {
      loadAndPlay(currentTrack);
    }
  }, [quality]);

  return (
    <PlayerContext.Provider value={{
      audioRef,
      queue, setQueue,
      currentIndex, currentTrack,
      isPlaying, loading, streamError, embedUrl,
      progress, duration, volume, setVolume,
      shuffle, setShuffle,
      repeat, setRepeat,
      quality, setQuality,
      likedTracks,
      playTrack, togglePlay,
      handleNext, handlePrev,
      seekTo, toggleLike, isLiked,
    }}>
      <audio ref={audioRef} preload="auto" />
      {children}
    </PlayerContext.Provider>
  );
}

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be inside PlayerProvider');
  return ctx;
};
