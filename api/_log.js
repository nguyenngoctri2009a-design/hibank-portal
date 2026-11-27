const FIREBASE_LOG = 'https://sfsdfsf-c4c13-default-rtdb.asia-southeast1.firebasedatabase.app/api_logs.json';

export async function logApiHit(endpoint, req, extra = {}) {
  try {
    const entry = {
      endpoint,
      method: req.method,
      query: req.query || {},
      body: (typeof req.body === 'object' ? req.body : {}),
      time: new Date().toISOString(),
      userAgent: req.headers['user-agent'] || '',
      ...extra
    };
    fetch(FIREBASE_LOG, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    }).catch(() => {});
  } catch (e) {}
}
