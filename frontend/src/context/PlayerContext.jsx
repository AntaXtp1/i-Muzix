import { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import api from '../utils/api';

const PlayerContext = createContext(null);

export function PlayerProvider({ children }) {
  const audioRef = useRef(null);
  const embedRef = useRef(null);          // ← ref ke iframe embed
  const handleNextRef = useRef(null);     // ← anti-stale closure untuk embed ended
  const handlePrevRef = useRef(null);     // ← anti-stale closure untuk Media Session
  const loadAndPlayRef = useRef(null);    // ← anti-stale closure untuk stall retry
  const sendEmbedCommandRef = useRef(null); // ← anti-stale closure untuk visibility handler
  const currentTrackRef = useRef(null);  // ← track aktif terbaru (hindari stale closure)
  const retryCountRef = useRef(0);       // ← counter retry stall (max 2x)
  const isRetryRef = useRef(false);      // ← flag: ini retry stall atau track baru
  const waitingTimerRef = useRef(null);  // ← debounce timer untuk 'waiting' event
  // stream URL cache — key: `${videoId}_${quality}`, value: {url, ts}
  // TTL 25 menit karena YouTube signed URL expired ~30 menit
  const streamCacheRef = useRef(new Map());
  const STREAM_CACHE_TTL = 25 * 60 * 1000;

  const [queue, setQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [shuffle, setShuffle] = useState(false);
  const shuffledQueueRef = useRef([]); // pre-computed shuffle order
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

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate   = () => setProgress(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onEnded        = () => handleNextRef.current?.();
    const onPlay         = () => setIsPlaying(true);
    const onPause        = () => setIsPlaying(false);
    const onError        = () => { setStreamError(true); setLoading(false); };

    // ─── STALL HANDLERS ────────────────────────────────────────────────────
    // waiting = browser nunggu buffer (CDN lambat / throttle)
    // → debounce 1.5s sebelum set isPlaying=false, biar buffering normal
    //   (1-2 detik) ga bikin cover art flicker stop-start
    const onWaiting = () => {
      setLoading(true);
      // Kalau 'playing' event dateng dalam 1.5s → cancel, ga perlu action
      clearTimeout(waitingTimerRef.current);
      waitingTimerRef.current = setTimeout(() => {
        setIsPlaying(false);
      }, 1500);
    };

    // stalled = browser bener-bener stuck, gak ada data masuk 3+ detik
    // → sama kayak waiting + trigger retry kalau belum exceed limit
    const onStalled = () => {
      clearTimeout(waitingTimerRef.current);
      setLoading(true);
      setIsPlaying(false);
      if (retryCountRef.current < 2 && currentTrackRef.current) {
        retryCountRef.current += 1;
        isRetryRef.current = true; // tandai ini retry, bukan track baru
        loadAndPlayRef.current?.(currentTrackRef.current);
      }
    };

    // canplay = data tersedia lagi, tapi tunggu 'playing' buat set isPlaying
    const onCanPlay = () => {
      clearTimeout(waitingTimerRef.current);
      setLoading(false);
    };

    // playing = audio beneran mulai jalan lagi setelah waiting/stalled
    // cancel debounce timer — buffering selesai, ga perlu set isPlaying=false
    const onPlaying = () => {
      clearTimeout(waitingTimerRef.current);
      setLoading(false);
      setIsPlaying(true);
      retryCountRef.current = 0; // reset retry counter kalau berhasil
    };
    // ───────────────────────────────────────────────────────────────────────

    audio.addEventListener('timeupdate',     onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended',          onEnded);
    audio.addEventListener('play',           onPlay);
    audio.addEventListener('pause',          onPause);
    audio.addEventListener('error',          onError);
    audio.addEventListener('waiting',        onWaiting);
    audio.addEventListener('stalled',        onStalled);
    audio.addEventListener('canplay',        onCanPlay);
    audio.addEventListener('playing',        onPlaying);

    return () => {
      clearTimeout(waitingTimerRef.current);
      audio.removeEventListener('timeupdate',     onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended',          onEnded);
      audio.removeEventListener('play',           onPlay);
      audio.removeEventListener('pause',          onPause);
      audio.removeEventListener('error',          onError);
      audio.removeEventListener('waiting',        onWaiting);
      audio.removeEventListener('stalled',        onStalled);
      audio.removeEventListener('canplay',        onCanPlay);
      audio.removeEventListener('playing',        onPlaying);
    };
  }, []);

  // ─── TAB VISIBILITY — recovery saat user balik ke tab ────────────────────
  //
  // MASALAH: browser throttle JS execution di background tab.
  // Efeknya di iMuzik:
  //   1. Stream mode  — audio.play() dipanggil tapi browser suspend → paused
  //   2. Embed mode   — postMessage ke YT iframe bisa di-drop / delay
  //   3. loadAndPlay  — kalau dipanggil saat background (auto-next),
  //                     fetch + state update kepotong → track stuck loading
  //                     sampai user balik ke tab
  //
  // SOLUSI: saat tab visible lagi, cek SEMUA kondisi stuck dan recover.
  // Pakai ref biar handler selalu baca state terbaru (hindari stale closure).
  const isPlayingRef   = useRef(false);
  const loadingRef     = useRef(false);
  const embedUrlRef    = useRef(null);
  isPlayingRef.current = isPlaying;
  loadingRef.current   = loading;
  embedUrlRef.current  = embedUrl;

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) return; // ke background → skip

      const audio      = isPlayingRef.current ? audioRef.current : null;
      const curEmbed   = embedUrlRef.current;
      const curLoading = loadingRef.current;
      const curTrack   = currentTrackRef.current;

      // ── Case 1: Stream mode, audio harusnya playing tapi paused ──────
      if (!curEmbed && audio && audio.src && !audio.ended && audio.paused) {
        audio.play().catch(() => {});
        return;
      }

      // ── Case 2: Embed mode, postMessage mungkin di-drop browser ──────
      // Kirim ulang playVideo command biar YT player resume
      if (curEmbed && isPlayingRef.current) {
        setTimeout(() => {
          sendEmbedCommandRef.current?.('playVideo');
        }, 300); // delay kecil — iframe perlu wake up dulu
        return;
      }

      // ── Case 3: loadAndPlay kepotong di background (stuck loading) ───
      // Tandanya: loading=true tapi ga ada audio src dan ga ada embedUrl
      // → artinya fetch/state update ga kelar saat background → retry
      if (curLoading && curTrack) {
        const audio2 = audioRef.current;
        const hasAudioSrc  = !!(audio2?.src && !audio2.src.endsWith('/'));
        const hasEmbed     = !!curEmbed;
        if (!hasAudioSrc && !hasEmbed) {
          // loadAndPlay kepotong — reload track dari awal
          loadAndPlayRef.current?.(curTrack);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []); // [] — semua state dibaca via ref, ga perlu re-attach
  // ───────────────────────────────────────────────────────────────────────────

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
          // State 1 = YT player beneran udah playing → baru clear loading
          if (info.playerState === 0) handleNextRef.current?.();
          if (info.playerState === 1) {
            setIsPlaying(true);
            setLoading(false); // ← embed beneran siap, bukan cuma iframe load
          }
          if (info.playerState === 2) setIsPlaying(false);
          if (info.playerState === 3) setLoading(true); // buffering di YT player
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
    // Reset counter HANYA kalau ini bukan retry dari onStalled
    // Kalau retry, counter dibiarkan naik agar limit 2x works
    if (!isRetryRef.current) {
      retryCountRef.current = 0;
    }
    const wasRetry = isRetryRef.current; // simpan sebelum di-reset
    isRetryRef.current = false; // reset flag setelah dicek
    setLoading(true);
    setStreamError(false);
    setEmbedUrl(null);
    setProgress(0);
    setDuration(0);

    try {
      // ─── STREAM CACHE ─────────────────────────────────────────────────
      const cacheKey = `${track.videoId}_${quality}`;
      const cached = streamCacheRef.current.get(cacheKey);
      // Kalau ini retry dari stall, invalidate cache — URL lama mungkin udah
      // throttled/expired duluan, harus fetch fresh dari backend
      if (wasRetry) {
        streamCacheRef.current.delete(cacheKey);
      }
      const isFresh = !wasRetry && cached && (Date.now() - cached.ts < STREAM_CACHE_TTL);

      let streamUrl = null;
      let useEmbed = false;
      let embedSrc = null;

      if (isFresh) {
        // Cache hit — skip request ke backend
        streamUrl = cached.url;
      } else {
        const data = await api.stream(track.videoId, quality);
        if (data.method === 'stream' && data.url) {
          streamUrl = data.url;
          // Simpan ke cache
          streamCacheRef.current.set(cacheKey, { url: streamUrl, ts: Date.now() });
          // Buang cache lama kalau > 30 entry (biar ga bloat)
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
        const audio = audioRef.current;
        audio.src = streamUrl;
        await audio.play();
        setIsPlaying(true);
        setEmbedUrl(null);
        setLoading(false);
      } else if (useEmbed) {
        const origin = encodeURIComponent(window.location.origin);
        setEmbedUrl(`${embedSrc}&origin=${origin}`);
        setIsPlaying(true);
        setStreamError(false);
        // ⚠️ JANGAN setLoading(false) di sini!
        // loading akan di-clear oleh handleYTMessage saat playerState=1
        // Kalau di-clear sekarang, user liat spinner hilang padahal YT belum siap
      }
      // ──────────────────────────────────────────────────────────────────
    } catch (err) {
      setStreamError(true);
      setLoading(false);
    } finally {
      // Embed mode: loading di-clear sama handleYTMessage (playerState=1)
      // Stream mode & error: clear di sini
      if (!embedRef.current?.src) setLoading(false);
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

  // Toggle shuffle + pre-compute urutan sekarang juga
  // Fisher-Yates shuffle — truly random, no repeat
  const toggleShuffle = useCallback(() => {
    setShuffle(prev => {
      const next = !prev;
      if (next && queue.length > 1) {
        const indices = queue.map((_, i) => i).filter(i => i !== currentIndex);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        shuffledQueueRef.current = indices; // urutan next yang akan dipakai
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
      // Ambil dari pre-computed shuffled list, shift satu per satu
      // Kalau list habis, re-shuffle lagi otomatis
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

  // Selalu update ref supaya listener embed & audio gak stale
  handleNextRef.current        = handleNext;
  handlePrevRef.current        = handlePrev;
  loadAndPlayRef.current       = loadAndPlay;
  sendEmbedCommandRef.current  = sendEmbedCommand;
  currentTrackRef.current      = currentTrack;

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

  // ─── MEDIA SESSION API ─────────────────────────────────────────────────────
  // Saat user minimize / pindah tab, OS media controls tetap jalan
  // (notifikasi musik di Android, lock screen di iOS, taskbar Windows)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    if (!currentTrack) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title:  currentTrack.title  || 'Unknown',
      artist: currentTrack.artist || 'Unknown Artist',
      album:  currentTrack.album  || '',
      artwork: currentTrack.thumbnail ? [
        { src: currentTrack.thumbnail, sizes: '500x500', type: 'image/jpeg' },
      ] : [],
    });
  }, [currentTrack]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play',           () => togglePlay());
    navigator.mediaSession.setActionHandler('pause',          () => togglePlay());
    navigator.mediaSession.setActionHandler('nexttrack',      () => handleNextRef.current?.());
    navigator.mediaSession.setActionHandler('previoustrack',  () => {
      const audio = audioRef.current;
      if (audio && audio.currentTime > 3) { audio.currentTime = 0; return; }
      handlePrevRef.current?.();
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) seekTo(details.seekTime);
    });

    return () => {
      ['play','pause','nexttrack','previoustrack','seekto'].forEach(action => {
        try { navigator.mediaSession.setActionHandler(action, null); } catch {}
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
  // ───────────────────────────────────────────────────────────────────────────
  // Pakai ref biar ga baca currentTrack/isPlaying dari closure lama
  useEffect(() => {
    if (currentTrackRef.current && audioRef.current && !audioRef.current.paused) {
      loadAndPlayRef.current?.(currentTrackRef.current);
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
      shuffle, setShuffle: toggleShuffle,
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
