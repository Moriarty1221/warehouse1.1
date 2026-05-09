const BASE = import.meta.env.VITE_API_URL || '';

export async function api(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}/api${path}`, { ...options, headers });

  // Check disk usage from headers
  const diskUsage = res.headers.get('X-Disk-Usage');
  if (diskUsage) {
    window.__diskUsage = parseInt(diskUsage);
    window.dispatchEvent(new CustomEvent('diskUsageUpdate', { detail: { usage: parseInt(diskUsage) } }));
  }

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
  return data;
}

export async function apiDownload(path, filename) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${(import.meta.env.VITE_API_URL || '')}/api${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Ошибка загрузки');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
