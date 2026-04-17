const API_URL = "http://localhost:6969";

export const aniwatchSearch = async (query: string) => {
  const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
  return res.json();
};

export const aniwatchDetails = async (id: string) => {
  const res = await fetch(`${API_URL}/anime/${id}`);
  return res.json();
};

export const aniwatchEpisodes = async (id: string) => {
  const res = await fetch(`${API_URL}/episodes/${id}`);
  return res.json();
};

export const aniwatchServers = async (epId: string) => {
  const res = await fetch(`${API_URL}/servers/${epId}`);
  return res.json();
};

export const aniwatchMegaplay = async (epId: string) => {
  const res = await fetch(`${API_URL}/megaplay/${epId}`);
  return res.json();
};

export const aniwatchSources = async (serverId: string) => {
  const res = await fetch(`${API_URL}/sources/${serverId}`);
  return res.json();
};