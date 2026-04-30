import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import api from '../utils/api';

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  // ─── DUAL AUDIO SETUP ──────────────────────────────────────────────────────
  // audioRef  = slot yang lagi AKTIF playing
  // audioBRef = slot PRELOAD (next track siap di sini)
  // Pas track ganti: swap reference, B langsung play, A fade out
  // → gapless, anti-delay, browser anggap tab "active audio" terus
  const audioRef  = useRef(null);   // active player
  const audioBRef = useRef(null);   // preload player
  const activeSlotRef = useRef('A'); // 'A' | 'B' — slot mana yang lagi main

  const embedRef = useRef(null);
  const handleNextRef       = useRef(null);
  const handlePrevRef       = useRef(null);
  const loadAndPlayRef      = useRef(null);
  const sendEmbedCommandRef = useRef(null);
  const currentTrackRef     = useRef(null);
  const retryCountRef       = useRef(0);
  const isRetryRef          = useRef(false);
  const waitingTimerRef     = useRef(null);
  const nextTrackStagedRef  = useRef(null); // {track, url} yang udah di-preload di slot B

  const streamCacheRef = useRef(new Map());
  const STREAM_CACHE_TTL = 25 * 60 * 1000;
  const prefetchedRef  = useRef(new Set());

  const [queue, setQueue]               = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [progress, setProgress]         = useState(0);
  const [duration, setDuration]         = useState(0);
  const [volume, setVolume]             = useState(0.8);
  const [shuffle, setShuffle]           = useState(false);
  const shuffledQueueRef                = useRef([]);
  const [repeat, setRepeat]             = useState('none');
  const [quality, setQuality]           = useState(() => localStorage.getItem('imuzik_quality') || 'normal');
  const [loading, setLoading]           = useState(false);
  const [streamError, setStreamError]   = useState(false);
  const [embedUrl, setEmbedUrl]         = useState(null);
  const [likedTracks, setLikedTracks]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('imuzik_liked') || '[]'); }
    catch { return []; }
  });

  const [charts, setCharts]             = useState(null);
  const [chartsLoading, setChartsLoading] = useState(false);
  const [chartsError, setChartsError]   = useState(false);
  const chartsTimestampRef              = useRef(0);
  const CHARTS_TTL                      = 10 * 60 * 1000;

  const fetchCharts = useCallback(async (force = false) => {
    const isStale = Date.now() - chartsTimestampRef.current > CHARTS_TTL;
    if (!force && charts && !isStale) return;
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

  useEffect(() => { localStorage.setItem('imuzik_quality', quality); }, [quality]);
  useEffect(() => { localStorage.setItem('imuzik_liked', JSON.stringify(likedTracks)); }, [likedTracks]);

  // ─── HELPER: get active / inactive audio element ───────────────────────────
  const getActive   = () => activeSlotRef.current === 'A' ? audioRef.current  : audioBRef.current;
  const getInactive = () => activeSlotRef.current === 'A' ? audioBRef.current : audioRef.current;

  // ─── ATTACH EVENTS LANGSUNG KE DOM — bypass React layer ───────────────────
  // Ini penting: onended di-assign langsung ke HTMLAudioElement bukan via
  // React addEventListener, jadi ga kena throttle React scheduler saat background.
  const attachAudioEvents = useCallback((audio) => {
    if (!audio) return;

    audio.onended = () => {
      // Cek dulu apakah slot B udah siap dengan next track
      const staged = nextTrackStagedRef.current;
      const inactive = getInactive();

      if (staged && inactive && inactive.src && inactive.readyState >= 2) {
        // ── SEAMLESS SWAP ── B udah preloaded, langsung swap
        console.debug('[dual-audio] seamless swap to preloaded track');
        handleNextViaStagedRef.current?.();
      } else {
        // Fallback ke normal next
        handleNextRef.current?.();
      }
    };

    audio.ontimeupdate = () => {
      setProgress(audio.currentTime);
    };

    audio.ondurationchange = () => {
      setDuration(audio.duration || 0);
    };

    audio.onplay  = () => setIsPlaying(true);
    audio.onpause = () => setIsPlaying(false);
    audio.onerror = () => { setStreamError(true); setLoading(false); };

    audio.onwaiting = () => {
      setLoading(true);
      clearTimeout(waitingTimerRef.current);
      waitingTimerRef.current = setTimeout(() => setIsPlaying(false), 1500);
    };

    audio.onstalled = () => {
      clearTimeout(waitingTimerRef.current);
      setLoading(true);
      setIsPlaying(false);
      if (retryCountRef.current < 2 && currentTrackRef.current) {
        retryCountRef.current += 1;
        isRetryRef.current = true;
        loadAndPlayRef.current?.(currentTrackRef.current);
      }
    };

    audio.oncanplay = () => {
      clearTimeout(waitingTimerRef.current);
      setLoading(false);
    };

    audio.onplaying = () => {
      clearTimeout(waitingTimerRef.current);
      setLoading(false);
      setIsPlaying(true);
      retryCountRef.current = 0;
    };
  }, []);

  // Init kedua audio element + attach events sekali aja
  useEffect(() => {
    const a = audioRef.current;
    const b = audioBRef.current;
    if (a) { a.volume = volume; attachAudioEvents(a); }
    if (b) { b.volume = volume; b.preload = 'auto'; }
    return () => {
      clearTimeout(waitingTimerRef.current);
      if (a) { a.onended = a.ontimeupdate = a.ondurationchange = a.onplay =
                a.onpause = a.onerror = a.onwaiting = a.onstalled =
                a.oncanplay = a.onplaying = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── PRELOAD NEXT TRACK KE SLOT B ─────────────────────────────────────────
  // Saat sisa 20 detik atau 80% progress: fetch URL + set audioBRef.src
  // Slot B mulai buffer di background → pas swap, langsung main tanpa delay
  useEffect(() => {
    if (!duration || duration < 10) return;
    if (!isPlaying) return;

    const timeLeft = duration - progress;
    const pct      = duration > 0 ? progress / duration : 0;
    if (timeLeft > 20 && pct < 0.80) return;

    let nextIdx = -1;
    if (repeat === 'one') return;
    if (shuffle && shuffledQueueRef.current.length > 0) {
      nextIdx = shuffledQueueRef.current[0];
    } else {
      nextIdx = (currentIndex + 1) % queue.length;
    }
    if (nextIdx < 0 || nextIdx === currentIndex) return;

    const nextTrack = queue[nextIdx];
    if (!nextTrack?.videoId) return;

    const cacheKey = `${nextTrack.videoId}_${quality}`;
    if (prefetchedRef.current.has(cacheKey)) return;
    prefetchedRef.current.add(cacheKey);

    api.stream(nextTrack.videoId, quality).then(data => {
      if (data.method === 'stream' && data.url) {
        streamCacheRef.current.set(cacheKey, { url: data.url, ts: Date.now() });

        // ── Preload ke slot B ──
        const inactive = getInactive();
        if (inactive && !nextTrackStagedRef.current) {
          inactive.src     = data.url;
          inactive.preload = 'auto';
          inactive.volume  = volume;
          // Load tapi jangan play dulu
          inactive.load();
          nextTrackStagedRef.current = { track: nextTrack, url: data.url, idx: nextIdx };
          console.debug(`[preload] ✅ staged "${nextTrack.title}" ke slot ${activeSlotRef.current === 'A' ? 'B' : 'A'}`);
        }
      }
    }).catch(() => {
      prefetchedRef.current.delete(cacheKey);
    });
  }, [progress, duration, isPlaying, currentIndex, queue, shuffle, repeat, quality]);

  // ─── TAB VISIBILITY RECOVERY ──────────────────────────────────────────────
  const isPlayingRef   = useRef(false);
  const loadingRef     = useRef(false);
  const embedUrlRef    = useRef(null);
  isPlayingRef.current = isPlaying;
  loadingRef.current   = loading;
  embedUrlRef.current  = embedUrl;

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) return;

      const active     = getActive();
      const curEmbed   = embedUrlRef.current;
      const curLoading = loadingRef.current;
      const curTrack   = currentTrackRef.current;

      // Case 1: stream mode, audio paused pas balik tab
      if (!curEmbed && isPlayingRef.current && active?.src && !active.ended && active.paused) {
        active.play().catch(() => {});
        return;
      }

      // Case 2: embed mode, kirim ulang playVideo
      if (curEmbed && isPlayingRef.current) {
        setTimeout(() => sendEmbedCommandRef.current?.('playVideo'), 300);
        return;
      }

      // Case 3: loadAndPlay kepotong di background
      if (curLoading && curTrack) {
        const hasAudioSrc = !!(active?.src && !active.src.endsWith('/'));
        if (!hasAudioSrc && !curEmbed) {
          loadAndPlayRef.current?.(curTrack);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // ─── YOUTUBE IFRAME ───────────────────────────────────────────────────────
  useEffect(() => {
    const handleYTMessage = (event) => {
      if (event.origin !== 'https://www.youtube.com') return;
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'infoDelivery' && data.info) {
          const info = data.info;
          if (typeof info.currentTime === 'number') setProgress(info.currentTime);
          if (typeof info.duration === 'number' && info.duration > 0) setDuration(info.duration);
          if (info.playerState === 0) handleNextRef.current?.();
          if (info.playerState === 1) { setIsPlaying(true); setLoading(false); }
          if (info.playerState === 2) setIsPlaying(false);
          if (info.playerState === 3) setLoading(true);
        }
      } catch {}
    };
    window.addEventListener('message', handleYTMessage);
    return () => window.removeEventListener('message', handleYTMessage);
  }, []);

  const sendEmbedCommand = useCallback((func, args = '') => {
    if (!embedRef.current?.contentWindow) return;
    embedRef.current.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      'https://www.youtube.com'
    );
  }, []);

  const onEmbedLoad = useCallback(() => {
    if (!embedRef.current?.contentWindow) return;
    embedRef.current.contentWindow.postMessage(
      JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
      'https://www.youtube.com'
    );
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    const b = audioBRef.current;
    if (a) a.volume = volume;
    if (b) b.volume = volume;
  }, [volume]);

  useEffect(() => {
    if (embedUrl) sendEmbedCommand('setVolume', [Math.round(volume * 100)]);
  }, [volume, embedUrl, sendEmbedCommand]);

  // ─── LOAD AND PLAY ────────────────────────────────────────────────────────
  const loadAndPlay = useCallback(async (track) => {
    if (!track?.videoId) return;

    if (!isRetryRef.current) retryCountRef.current = 0;
    const wasRetry = isRetryRef.current;
    isRetryRef.current = false;
    if (!wasRetry) {
      prefetchedRef.current.clear();
      nextTrackStagedRef.current = null; // reset staged track
    }

    setLoading(true);
    setStreamError(false);
    setEmbedUrl(null);
    setProgress(0);
    setDuration(0);

    try {
      const cacheKey = `${track.videoId}_${quality}`;
      if (wasRetry) streamCacheRef.current.delete(cacheKey);
      const cached  = streamCacheRef.current.get(cacheKey);
      const isFresh = !wasRetry && cached && (Date.now() - cached.ts < STREAM_CACHE_TTL);

      let streamUrl = null;
      let useEmbed  = false;
      let embedSrc  = null;

      if (isFresh) {
        streamUrl = cached.url;
      } else {
        const data = await api.stream(track.videoId, quality);
        if (data.method === 'stream' && data.url) {
          streamUrl = data.url;
          streamCacheRef.current.set(cacheKey, { url: streamUrl, ts: Date.now() });
          if (streamCacheRef.current.size > 30) {
            const oldest = streamCacheRef.current.keys().next().value;
            streamCacheRef.current.delete(oldest);
          }
        } else if (data.embedUrl) {
          useEmbed = true;
          embedSrc = data.embedUrl;
        }
      }

      if (streamUrl) {
        // Pakai slot yang aktif — jangan bikin Audio baru
        const active = getActive();
        active.src = streamUrl;
        await active.play();
        setIsPlaying(true);
        setEmbedUrl(null);
        setLoading(false);
      } else if (useEmbed) {
        const origin = encodeURIComponent(window.location.origin);
        setEmbedUrl(`${embedSrc}&origin=${origin}`);
        setIsPlaying(true);
        setStreamError(false);
        // loading di-clear saat YT playerState=1
      }
    } catch {
      setStreamError(true);
      setLoading(false);
    } finally {
      if (!embedRef.current?.src) setLoading(false);
    }
  }, [quality]);

  // ─── SEAMLESS NEXT VIA STAGED (dual audio swap) ───────────────────────────
  const handleNextViaStaged = useCallback(() => {
    const staged   = nextTrackStagedRef.current;
    const inactive = getInactive(); // slot B yang udah preloaded

    if (!staged || !inactive) {
      handleNextRef.current?.();
      return;
    }

    const { track, idx } = staged;

    // Fade out active slot
    const active = getActive();
    if (active && !active.paused) {
      // Quick fade: 200ms
      const startVol = active.volume;
      const fadeSteps = 10;
      let step = 0;
      const fadeInterval = setInterval(() => {
        step++;
        active.volume = Math.max(0, startVol * (1 - step / fadeSteps));
        if (step >= fadeSteps) {
          clearInterval(fadeInterval);
          active.pause();
          active.src = '';
          active.volume = startVol; // reset volume buat pemakaian berikutnya
        }
      }, 20);
    }

    // Swap slot reference
    activeSlotRef.current = activeSlotRef.current === 'A' ? 'B' : 'A';

    // Attach events ke slot baru yang jadi active
    attachAudioEvents(inactive);

    // Play slot B
    inactive.volume = volume;
    inactive.play().catch(() => {});

    // Update React state
    setCurrentIndex(idx);
    setIsPlaying(true);
    setLoading(false);
    setStreamError(false);
    setEmbedUrl(null);
    setProgress(0);
    setDuration(inactive.duration || 0);

    // Reset staged
    nextTrackStagedRef.current = null;
    prefetchedRef.current.clear();

    console.debug(`[dual-audio] swapped to "${track.title}" — gapless ✅`);
  }, [volume, attachAudioEvents]);

  // ref untuk dipanggil dari onended DOM handler
  const handleNextViaStagedRef = useRef(null);
  handleNextViaStagedRef.current = handleNextViaStaged;

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
    if (embedUrl) {
      if (isPlaying) {
        sendEmbedCommand('pauseVideo');
        setIsPlaying(false);
      } else {
        sendEmbedCommand('playVideo');
        setIsPlaying(true);
      }
      return;
    }
    const active = getActive();
    if (!active) return;
    if (isPlaying) {
      active.pause();
    } else {
      active.play().catch(() => {});
    }
  }, [isPlaying, embedUrl, sendEmbedCommand]);

  const toggleShuffle = useCallback(() => {
    setShuffle(prev => {
      const next = !prev;
      if (next && queue.length > 1) {
        const indices = queue.map((_, i) => i).filter(i => i !== currentIndex);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        shuffledQueueRef.current = indices;
      }
      return next;
    });
  }, [queue, currentIndex]);

  const handleNext = useCallback(() => {
    if (queue.length === 0) return;
    let nextIdx;
    if (repeat === 'one') {
      nextIdx = currentIndex;
    } else if (shuffle) {
      if (shuffledQueueRef.current.length === 0) {
        const indices = queue.map((_, i) => i).filter(i => i !== currentIndex);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        shuffledQueueRef.current = indices;
      }
      nextIdx = shuffledQueueRef.current.shift();
    } else {
      nextIdx = (currentIndex + 1) % queue.length;
    }
    setCurrentIndex(nextIdx);
    loadAndPlay(queue[nextIdx]);
  }, [queue, currentIndex, repeat, shuffle, loadAndPlay]);

  const handlePrev = useCallback(() => {
    const active = getActive();
    if (active && active.currentTime > 3) {
      active.currentTime = 0;
      return;
    }
    const prevIdx = currentIndex <= 0 ? queue.length - 1 : currentIndex - 1;
    setCurrentIndex(prevIdx);
    loadAndPlay(queue[prevIdx]);
  }, [queue, currentIndex, loadAndPlay]);

  // ⚠️ Refs harus SETELAH semua fungsi didefinisikan
  handleNextRef.current        = handleNext;
  handlePrevRef.current        = handlePrev;
  loadAndPlayRef.current       = loadAndPlay;
  sendEmbedCommandRef.current  = sendEmbedCommand;
  currentTrackRef.current      = currentTrack;

  const seekTo = useCallback((time) => {
    if (embedUrl) {
      sendEmbedCommand('seekTo', [time, true]);
      setProgress(time);
      return;
    }
    const active = getActive();
    if (active) {
      active.currentTime = time;
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

  // ─── MEDIA SESSION API ────────────────────────────────────────────────────
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title:   currentTrack.title  || 'Unknown',
      artist:  currentTrack.artist || 'Unknown Artist',
      album:   currentTrack.album  || '',
      artwork: currentTrack.thumbnail
        ? [{ src: currentTrack.thumbnail, sizes: '500x500', type: 'image/jpeg' }]
        : [],
    });
  }, [currentTrack]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.setActionHandler('play',          () => togglePlay());
    navigator.mediaSession.setActionHandler('pause',         () => togglePlay());
    navigator.mediaSession.setActionHandler('nexttrack',     () => handleNextRef.current?.());
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      const active = getActive();
      if (active && active.currentTime > 3) { active.currentTime = 0; return; }
      handlePrevRef.current?.();
    });
    navigator.mediaSession.setActionHandler('seekto', (d) => {
      if (d.seekTime != null) seekTo(d.seekTime);
    });
    return () => {
      ['play','pause','nexttrack','previoustrack','seekto'].forEach(a => {
        try { navigator.mediaSession.setActionHandler(a, null); } catch {}
      });
    };
  }, [togglePlay, seekTo]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !duration) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(progress, duration),
      });
    } catch {}
  }, [progress, duration]);

  // Re-load saat quality berubah
  useEffect(() => {
    if (currentTrackRef.current) {
      const active = getActive();
      if (active && !active.paused) loadAndPlayRef.current?.(currentTrackRef.current);
    }
  }, [quality]);

  return (
    <PlayerContext.Provider value={{
      audioRef,   // expose slot A (untuk PlayerBar ref jika perlu)
      embedRef,
      onEmbedLoad,
      queue, setQueue,
      currentIndex, currentTrack,
      isPlaying, loading, streamError, embedUrl,
      progress, duration, volume, setVolume,
      shuffle, setShuffle: toggleShuffle,
      repeat, setRepeat,
      quality, setQuality,
      likedTracks,
      playTrack, togglePlay,
      handleNext, handlePrev,
      seekTo, toggleLike, isLiked,
      charts, chartsLoading, chartsError, fetchCharts,
    }}>
      {/* Slot A — active by default */}
      <audio ref={audioRef}  preload="auto" />
      {/* Slot B — preload next track */}
      <audio ref={audioBRef} preload="auto" />
      {children}
    </PlayerContext.Provider>
  );
}

export const usePlayer = () => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be inside PlayerProvider');
  return ctx;
};
