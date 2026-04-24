const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:7860';

async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  try {
    const res = await fetch(url, { ...options });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`[iMuzik API] ${path}:`, err.message);
    throw err;
  }
}

export const api = {
  health: () => apiFetch('/health'),
  charts: (region = 'ID') => apiFetch(`/charts?region=${region}`),
  search: (q, filter = 'songs', limit = 20) =>
    apiFetch(`/search?q=${encodeURIComponent(q)}&filter=${filter}&limit=${limit}`),
  stream: (videoId, quality = 'normal') =>
    apiFetch(`/stream/${videoId}?quality=${quality}`),
  song: (videoId) => apiFetch(`/song/${videoId}`),
  album: (browseId) => apiFetch(`/album/${browseId}`),
  artist: (channelId) => apiFetch(`/artist/${channelId}`),
  genres: () => apiFetch('/genres'),
};

export default api;
