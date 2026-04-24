import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { PlayerProvider } from './context/PlayerContext';
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import HomePage from './pages/Home';
import DiscoverPage from './pages/Discover';
import LibraryPage from './pages/Library';

export default function App() {
  return (
    <BrowserRouter>
      <PlayerProvider>
        <div
          className="flex flex-col"
          style={{ height: '100vh', background: 'var(--bg-primary)' }}
        >
          {/* Main area: sidebar + content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <Sidebar />

            {/* Page content */}
            <main
              className="flex-1 overflow-y-auto"
              style={{ background: 'var(--bg-primary)' }}
            >
              {/* Subtle top gradient */}
              <div
                className="sticky top-0 z-10 pointer-events-none"
                style={{
                  height: '80px',
                  marginBottom: '-80px',
                  background: 'linear-gradient(to bottom, var(--bg-primary) 20%, transparent)',
                }}
              />

              <div className="px-8 pt-8 pb-6 max-w-7xl">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/discover" element={<DiscoverPage />} />
                  <Route path="/library" element={<LibraryPage />} />
                </Routes>
              </div>
            </main>
          </div>

          {/* Player bar — always visible at bottom */}
          <PlayerBar />
        </div>
      </PlayerProvider>
    </BrowserRouter>
  );
}
