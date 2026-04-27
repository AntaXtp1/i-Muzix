import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import api from '../utils/api';

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const audioRef = useRef(null);
  const embedRef = useRef(null);          // ← ref ke iframe embed
  const handleNextRef = useRef(null);     // ← anti-stale closure untuk embed ended

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

  // ─── CHARTS CACHE ──────────────────────────────────────────────────────────
  const [charts, setCharts] = useState(null);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [chartsError, setChartsError] = useState(false);
  const chartsTimestampRef = useRef(0);
  const CHARTS_TTL = 10 * 60 * 1000; // 10 menit

  const fetchCharts = useCallback(async (force = false) => {
    const isStale = Date.now() - chartsTimestampRef.current > CHARTS_TTL;
    if (!force && charts && !isStale) return; // data masih fresh, skip

    setChartsLoading(true);
    setChartsError(false);
    try {
      const data = await api.charts('ID');
      setCharts(data);
      chartsTimestampRef.current = Date.now();
    } catch {
      setChartsError(true);
    } finally {
      setChartsLoading(false);
    }
  }, [charts]);

  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : null;

  // Persist quality
  useEffect(() => {
    localStorage.setItem('imuzik_quality', quality);
  }, [quality]);

  // Persist liked
  useEffect(() => {
    localStorage.setItem('imuzik_liked', JSON.stringify(likedTracks));
  }, [likedTracks]);

  // Audio event listeners (untuk mode <audio> — tidak berubah)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setProgress(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onEnded = () => handleNextRef.current?.();
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

  // YouTube IFrame API — listen postMessage dari iframe
  useEffect(() => {
    const handleYTMessage = (event) => {
      if (event.origin !== 'https://www.youtube.com') return;
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'infoDelivery' && data.info) {
          const info = data.info;
          // Update progress & duration dari YouTube
          if (typeof info.currentTime === 'number') setProgress(info.currentTime);
          if (typeof info.duration === 'number' && info.duration > 0) setDuration(info.duration);
          // playerState: 0=ended, 1=playing, 2=paused
          if (info.playerState === 0) handleNextRef.current?.();
          if (info.playerState === 1) setIsPlaying(true);
          if (info.playerState === 2) setIsPlaying(false);
        }
      } catch { /* bukan JSON atau bukan dari YT */ }
    };

    window.addEventListener('message', handleYTMessage);
    return () => window.removeEventListener('message', handleYTMessage);
  }, []);

  // Helper: kirim command ke YouTube iframe via postMessage
  const sendEmbedCommand = useCallback((func, args = '') => {
    if (!embedRef.current?.contentWindow) return;
    embedRef.current.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      'https://www.youtube.com'
    );
  }, []);

  // Dipanggil pas iframe selesai load — mulai subscribe ke info updates
  const onEmbedLoad = useCallback(() => {
    if (!embedRef.current?.contentWindow) return;
    embedRef.current.contentWindow.postMessage(
      JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
      'https://www.youtube.com'
    );
  }, []);

  // Update volume — audio element + iframe embed
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Sync volume ke iframe kalau lagi embed mode
  useEffect(() => {
    if (embedUrl) sendEmbedCommand('setVolume', [Math.round(volume * 100)]);
  }, [volume, embedUrl, sendEmbedCommand]);

  const loadAndPlay = useCallback(async (track) => {
    if (!track?.videoId) return;
    setLoading(true);
    setStreamError(false);
    setEmbedUrl(null);
    setProgress(0);
    setDuration(0);

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
        // Tambah origin supaya postMessage balik ke parent bisa jalan
        const origin = encodeURIComponent(window.location.origin);
        setEmbedUrl(`${data.embedUrl}&origin=${origin}`);
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
      // Kontrol iframe via postMessage — bukan cuma visual state
      if (isPlaying) {
        sendEmbedCommand('pauseVideo');
        setIsPlaying(false);
      } else {
        sendEmbedCommand('playVideo');
        setIsPlaying(true);
      }
      return;
    }
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  }, [isPlaying, embedUrl, sendEmbedCommand]);

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

  // Selalu update ref supaya listener embed & audio gak stale
  handleNextRef.current = handleNext;

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
    if (embedUrl) {
      sendEmbedCommand('seekTo', [time, true]);
      setProgress(time);
      return;
    }
    if (audio) {
      audio.currentTime = time;
      setProgress(time);
    }
  }, [embedUrl, sendEmbedCommand]);

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
      embedRef,
      onEmbedLoad,
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
      charts, chartsLoading, chartsError, fetchCharts,
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
