const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const app = express();

app.use(cors());
app.use(express.json());

const AUTH_KEY = process.env.GIGACHAT_AUTH_KEY;
if (!AUTH_KEY) {
  console.error('GIGACHAT_AUTH_KEY is not set');
  process.exit(1);
}

let tokenCache = { token: null, expiresAt: 0 };

async function getAccessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.token;
  }

  const rqUid = crypto.randomUUID();
  const body = new URLSearchParams({ scope: 'GIGACHAT_API_PERS' });

  const res = await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'RqUID': rqUid,
      'Authorization': `Basic ${AUTH_KEY}`
    },
    body: body.toString()
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token error ${res.status}: ${text}`);
  }

  const data = await res.json();
  tokenCache.token = data.access_token;
  tokenCache.expiresAt = data.expires_at;
  return data.access_token;
}

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, model } = req.body;
    const token = await getAccessToken();

    const response = await fetch('https://api.giga.chat/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        model: model || 'GigaChat-2',
        messages: messages,
        temperature: 0.8,
        max_tokens: 600
      })
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy running on ${PORT}`));
