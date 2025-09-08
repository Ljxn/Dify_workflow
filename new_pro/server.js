const path = require('path');
const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Proxy endpoint to call Dify workflow
app.post('/api/run', async (req, res) => {
  try {
    const { event, main_point } = req.body || {};
    if (!event || typeof event !== 'string') {
      return res.status(400).json({ error: 'Missing required field: event' });
    }
    if (!main_point || typeof main_point !== 'string') {
      return res.status(400).json({ error: 'Missing required field: main_point' });
    }

    const difyUrl = process.env.DIFY_WORKFLOW_URL || 'http://你的ip/v1/workflows/run';
    const difyApiKey = process.env.DIFY_API_KEY || '你的密钥';

    const payload = {
      inputs: { event, main_point },
      response_mode: 'blocking',
      user: 'web-user'
    };

    const response = await axios.post(difyUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${difyApiKey}`
      },
      timeout: 60000
    });

    // Attempt to extract text output from common Dify response shapes
    let articleText = null;
    const data = response.data;

    if (data && data.data && data.data.outputs) {
      // Try common keys
      const outputs = data.data.outputs;
      if (typeof outputs === 'string') {
        articleText = outputs;
      } else if (outputs.result) {
        articleText = outputs.result;
      } else if (outputs.output) {
        articleText = outputs.output;
      } else if (outputs.text) {
        articleText = outputs.text;
      }
    }

    if (!articleText && data && data.data && data.data.text) {
      articleText = data.data.text;
    }

    if (!articleText && typeof data === 'string') {
      articleText = data;
    }

    if (!articleText) {
      return res.status(200).json({ raw: data });
    }

    return res.json({ article: articleText });
  } catch (error) {
    const status = error.response ? error.response.status : 500;
    const payload = error.response ? error.response.data : { message: error.message };
    return res.status(status).json({ error: 'Failed to run workflow', details: payload });
  }
});

// Fallback to index.html for root
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
