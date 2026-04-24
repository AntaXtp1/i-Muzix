import { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api from '../utils/api';
import { usePlayer } from '../context/PlayerContext';
import TrackRow from '../components/TrackRow';
import MusicCard from '../components/MusicCard';
import { SkeletonTrack, SkeletonCard } from '../components/Skeleton';

const FILTERS = [
  { key: 'songs', label: 'Songs' },
  { key: 'albums', label: 'Albums' },
  { key: 'artists', label: 'Artists' },
];

export default function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [filter, setFilter] = useState('songs');
  const [results, setResults] = useState([]);
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(false);
  const [genreLoading, setGenreLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { playTrack } = usePlayer();
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    api.genres().then(d => setGenres(d.genres || [])).catch(() => {});
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      doSearch(q, filter);
    }
  }, []);

  const doSearch = async (q, f = filter) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    try {
      const data = await api.search(q, f);
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(val, filter);
      if (val) setSearchParams({ q: val });
      else setSearchParams({});
    }, 500);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
    setSearchParams({});
    inputRef.current?.focus();
  };

  const handleFilterChange = (f) => {
    setFilter(f);
    if (query) doSearch(query, f);
  };

  const handleGenreClick = async (genre) => {
    setQuery(genre.name);
    setFilter('songs');
    setGenreLoading(true);
    setSearched(true);
    try {
      const data = await api.search(genre.query, 'songs', 20);
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setGenreLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl font-extrabold text-white mb-6">Discover</h1>

      {/* Search bar */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInput}
          onKeyDown={e => e.key === 'Enter' && doSearch(query)}
          placeholder="Cari lagu, artis, album..."
          className="w-full bg-[#1a1a1a] border border-white/10 rounded-2xl pl-11 pr-12 py-3.5
            text-white placeholder-white/25 text-sm font-medium outline-none transition-all
            focus:border-[#C8FF3E]/50 focus:bg-[#1f1f1f]"
        />
        {loading && (
          <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#C8FF3E] animate-spin" />
        )}
        {query && !loading && (
          <button onClick={handleClear} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Filter pills */}
      {searched && (
        <div className="flex gap-2 mb-6">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => handleFilterChange(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200
                ${filter === f.key
                  ? 'bg-[#C8FF3E] text-black'
                  : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {searched && (
        <div className="mb-8 animate-fade-in">
          {(loading || genreLoading) ? (
            <div className="space-y-1">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonTrack key={i} />)}
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-white/50">Ga ada hasil buat "<span className="text-white">{query}</span>"</p>
            </div>
          ) : filter === 'songs' ? (
            <div className="bg-[#111] rounded-2xl overflow-hidden border border-white/5">
              {results.map((track, i) => (
                <TrackRow key={track.id || i} track={track} index={i} queue={results} showIndex={false} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 stagger-children">
              {results.map((item, i) => (
                <div
                  key={item.id || i}
                  className="music-card bg-[#1a1a1a] hover:bg-[#222] p-3 cursor-pointer animate-slide-up"
                  onClick={() => filter === 'songs' && playTrack(item)}
                >
                  <div className="aspect-square rounded-xl overflow-hidden mb-3 bg-[#2a2a2a]">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">
                        {filter === 'artists' ? '👤' : '💿'}
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white truncate">{item.title || item.name}</p>
                  {item.artist && <p className="text-xs text-white/40 truncate mt-0.5">{item.artist}</p>}
                  {item.year && <p className="text-xs text-white/30 mt-0.5">{item.year}</p>}
                  {item.subscribers && <p className="text-xs text-white/30 mt-0.5">{item.subscribers}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Genre grid — shown when not searching */}
      {!searched && (
        <div className="animate-fade-in">
          <h2 className="text-lg font-bold text-white mb-4">Browse Genre</h2>
          {genres.length === 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="skeleton aspect-[2/1] rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 stagger-children">
              {genres.map((genre) => (
                <button
                  key={genre.id}
                  onClick={() => handleGenreClick(genre)}
                  className="genre-card text-left animate-slide-up"
                  style={{ background: `linear-gradient(135deg, ${genre.color}22, ${genre.color}08)`, border: `1px solid ${genre.color}20` }}
                >
                  <div
                    className="absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition-opacity duration-300"
                    style={{ background: `linear-gradient(135deg, ${genre.color}33, ${genre.color}11)` }}
                  />
                  <div className="relative">
                    <p className="text-2xl mb-2">{getGenreEmoji(genre.id)}</p>
                    <p className="font-bold text-white text-sm">{genre.name}</p>
                  </div>
                  <div
                    className="absolute bottom-3 right-3 w-8 h-8 rounded-full opacity-30"
                    style={{ background: genre.color }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getGenreEmoji(id) {
  const map = {
    pop: '🎤', hiphop: '🎧', rnb: '🎶', indie: '🎸',
    rock: '🤘', electronic: '⚡', jazz: '🎷', dangdut: '🥁',
    kpop: '💫', acoustic: '🪕', classical: '🎻', viral: '🔥',
  };
  return map[id] || '🎵';
}
