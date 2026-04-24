import { NavLink } from 'react-router-dom';
import { Home, Compass, Library, Music2, TrendingUp } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/discover', icon: Compass, label: 'Discover' },
  { to: '/library', icon: Library, label: 'Library' },
];

export default function Sidebar() {
  const { likedTracks } = usePlayer();

  return (
    <aside
      className="flex flex-col h-full bg-[#111111] border-r border-white/5"
      style={{ width: 'var(--sidebar-width)', flexShrink: 0 }}
    >
      {/* Logo */}
      <div className="px-6 pt-7 pb-8">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#C8FF3E] flex items-center justify-center">
            <Music2 size={16} className="text-black" strokeWidth={2.5} />
          </div>
          <span className="text-white font-extrabold text-xl tracking-tight">
            i<span className="text-[#C8FF3E]">Muzik</span>
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        <p className="text-white/25 text-xs font-mono uppercase tracking-widest px-3 mb-3">Menu</p>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group
              ${isActive
                ? 'bg-[#C8FF3E]/10 text-[#C8FF3E]'
                : 'text-white/50 hover:text-white hover:bg-white/5'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={18}
                  className={`transition-all duration-200 ${isActive ? 'text-[#C8FF3E]' : 'group-hover:text-white'}`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {label}
                {label === 'Library' && likedTracks.length > 0 && (
                  <span className="ml-auto text-xs bg-white/10 text-white/50 rounded-full px-2 py-0.5 font-mono">
                    {likedTracks.length}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}

        {/* Divider */}
        <div className="border-t border-white/5 my-4" />

        <p className="text-white/25 text-xs font-mono uppercase tracking-widest px-3 mb-3">Trending</p>
        <NavLink
          to="/discover?tab=trending"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white/50 hover:text-white hover:bg-white/5 transition-all duration-200 group"
        >
          <TrendingUp size={18} strokeWidth={2} className="group-hover:text-[#C8FF3E] transition-colors" />
          Charts Indonesia
        </NavLink>
      </nav>

      {/* Footer */}
      <div className="px-6 py-5 border-t border-white/5">
        <p className="text-white/20 text-xs font-mono">iMuzik v1.0</p>
        <p className="text-white/15 text-xs mt-0.5">Powered by YT Music</p>
      </div>
    </aside>
  );
}
