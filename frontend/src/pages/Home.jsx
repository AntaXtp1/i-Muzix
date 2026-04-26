import { useEffect, useState } from 'react';
import { TrendingUp, Zap, Music } from 'lucide-react';
import api from '../utils/api';
import { usePlayer } from '../context/PlayerContext';
import MusicCard from '../components/MusicCard';
import TrackRow from '../components/TrackRow';
import { SkeletonCard, SkeletonTrack, SkeletonBanner, ServerWakeup } from '../components/Skeleton';

function FeaturedBanner({ track, onPlay }) {
  if (!track) return null;
  return (
    <div
      className="relative rounded-3xl overflow-hidden cursor-pointer group mb-8 animate-fade-in"
      style={{ height: '260px' }}
      onClick={() => onPlay(track)}
    >
      {/* BG image */}
      {track.thumbnail && (
        <img
          src={track.thumbnail}
          alt={track.title}
          className="absolute inset-0 w-full h-full object-cover scale-105 group-hover:scale-110 transition-transform duration-700"
        />
      )}
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-mono bg-[#C8FF3E] text-black px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
            🔥 Trending #1
          </span>
        </div>
        <h2 className="text-3xl font-extrabold text-white mb-1 leading-tight max-w-md">{track.title}</h2>
        <p className="text-white/60 text-sm mb-5">{track.artist}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); onPlay(track); }}
            className="btn-accent flex items-center gap-2 text-sm"
          >
            ▶ Play Now
          </button>
          <span className="text-white/30 text-sm font-mono">{track.duration}</span>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { playTrack } = usePlayer();
  const [charts, setCharts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const fetchCharts = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await api.charts('ID');
      setCharts(data);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCharts();
  }, []);

  const topSongs = charts?.top_songs || [];
  const trending = charts?.trending || [];
  const featuredTrack = topSongs[0] || trending[0];

  return (
    <div className="animate-fade-in">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white">
          Selamat {getGreeting()},{' '}
          <span className="text-[#C8FF3E]">iMuzik</span>
        </h1>
        <p className="text-white/40 text-sm mt-1.5">Trending musik Indonesia hari ini 🇮🇩</p>
      </div>

      {/* Server waking up */}
      {loading && !charts && (
        <>
          <SkeletonBanner />
          <ServerWakeup />
        </>
      )}

      {error && (
        <div className="text-center py-16 animate-fade-in">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="text-white/60 mb-2">Gagal konek ke server</p>
          <p className="text-white/30 text-sm mb-6">Server mungkin sedang cold start...</p>
          <button onClick={fetchCharts} className="btn-accent text-sm">
            Retry
          </button>
        </div>
      )}

      {charts && (
        <>
          {/* Featured Banner */}
          <FeaturedBanner track={featuredTrack} onPlay={playTrack} />

          {/* Top Songs Grid */}
          {topSongs.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp size={18} className="text-[#C8FF3E]" />
                <h2 className="text-lg font-bold text-white">Top Songs Indonesia</h2>
                <span className="text-xs text-white/30 font-mono ml-auto">via YT Music Charts</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 stagger-children">
                {topSongs.slice(0, 12).map(track => (
                  <MusicCard key={track.id} track={track} />
                ))}
              </div>
            </section>
          )}

          {/* Trending List */}
          {trending.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={18} className="text-[#C8FF3E]" />
                <h2 className="text-lg font-bold text-white">Lagi Trending</h2>
              </div>
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
                {trending.slice(0, 15).map((track, i) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={i}
                    queue={trending}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Pagi';
  if (h < 15) return 'Siang';
  if (h < 19) return 'Sore';
  return 'Malam';
}
