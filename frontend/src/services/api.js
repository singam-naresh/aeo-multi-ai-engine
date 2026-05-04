const API_BASE = 'http://localhost:5000';

/**
 * Sends a query to the backend multi-model analysis endpoint.
 * @param {string} query - The product search query
 * @returns {Promise<object>} - Full API response { success, data }
 */
export async function analyzeQuery(query) {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}
