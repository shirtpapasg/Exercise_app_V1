// Vercel serverless function. Your API key lives here as an environment variable,
// never in the HTML — anything in index.html is readable by every visitor.
//
// Setup:
//   1. Keep this file at api/vision.js in your repository.
//   2. Deploy the repo on vercel.com (GitHub Pages cannot run this — it serves
//      static files only).
//   3. Vercel → your project → Settings → Environment Variables:
//        ANTHROPIC_API_KEY = sk-ant-...
//   4. Redeploy. The app calls /api/vision automatically.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set in Vercel' });
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: body.model || 'claude-sonnet-4-5',
        max_tokens: body.max_tokens || 1500,
        system: body.system,
        messages: body.messages
      })
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: (data.error && data.error.message) || 'upstream error' });
    }
    // The app expects plain text back.
    const text = (data.content || []).map(c => c.text || '').join('').trim();
    return res.status(200).json({ text });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
