const API_BASE = 'http://localhost:5000';

/**
 * Sends a query to the backend multi-model analysis endpoint.
 * Attaches Authorization header if a token is stored.
 */
export async function analyzeQuery(query) {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(),
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

function authHeader() {
  const token = localStorage.getItem('aeo_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function registerUser(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function loginUser(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export function storeToken(token) {
  localStorage.setItem('aeo_token', token);
}

export function clearToken() {
  localStorage.removeItem('aeo_token');
  localStorage.removeItem('aeo_user');
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem('aeo_user');
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

export function storeUser(user) {
  localStorage.setItem('aeo_user', JSON.stringify(user));
}
