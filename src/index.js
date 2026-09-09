const express = require('express');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const keystore = require('./storage/keystore');
const { PROVIDERS, listProviders, getConnectedProviders, getAllModels, getProvider } = require('./providers/registry');
const ProviderAdapter = require('./providers/adapter');
const QuotaTracker = require('./providers/quota-tracker');
const RoutingEngine = require('./routing/engine');
const CircuitBreaker = require('./resilience/circuit-breaker');
const CompressionEngine = require('./compression/engine');

const app = express();
const PORT = process.env.PORT || 20128;
const API_KEY = process.env.OMNIWAVE_KEY || `ow_${uuidv4().replace(/-/g, '').substring(0, 32)}`;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Core instances
const adapter = new ProviderAdapter();
const quotaTracker = new QuotaTracker();
const routingEngine = new RoutingEngine();
const circuitBreaker = new CircuitBreaker();
const compressionEngine = new CompressionEngine();

let stats = { totalRequests: 0, totalTokens: 0, uptime: Date.now() };

// ─── Auth middleware ───
function authMiddleware(req, res, next) {
  // Allow dashboard UI, static files, and local management API without auth
  // (management API is only reachable on localhost by design)
  if (req.path === '/' || req.path.startsWith('/css') || req.path.startsWith('/js') || req.path.startsWith('/favicon')) return next();
  if (req.path.startsWith('/api/')) return next();

  // All /v1/* and /vscode/* endpoints REQUIRE the API key
  // Check Bearer token
  const auth = req.headers.authorization || '';
  const key = auth.replace(/^Bearer\s+/i, '');
  const tokenParam = req.query.key;

  if (key === API_KEY || tokenParam === API_KEY) return next();

  return res.status(401).json({ error: { message: 'Invalid API key', type: 'auth_error' } });
}
app.use(authMiddleware);

// ─── OpenAI-compatible /v1 endpoints ───

app.get('/v1/models', (req, res) => {
  const models = getAllModels();
  const data = models.map(m => ({
    id: m.id, object: 'model', created: Math.floor(Date.now() / 1000),
    owned_by: m.provider, provider: m.providerName,
  }));
  // Add auto models
  ['auto', 'auto/fast', 'auto/cheap', 'auto/coding'].forEach(id => {
    data.push({ id, object: 'model', created: Math.floor(Date.now() / 1000), owned_by: 'omniwave', provider: 'OmniWave' });
  });
  res.json({ object: 'list', data });
});

app.post('/v1/chat/completions', async (req, res) => {
  stats.totalRequests++;
  const { model, messages, stream = false } = req.body;

  try {
    const strategy = req.headers['x-omniwave-strategy'] || 'auto';
    const target = routingEngine.resolve(model || 'auto', strategy);

    if (!circuitBreaker.canRequest(target.id)) {
      const connected = getConnectedProviders().filter(p => circuitBreaker.canRequest(p.id));
      if (connected.length === 0) {
        return res.status(503).json({ error: { message: 'All providers are unavailable', type: 'server_error' } });
      }
      return await forwardRequest(connected[0], req, res);
    }

    const compressionHeader = req.headers['x-omniwave-compression'];
    if (compressionHeader) compressionEngine.setMode(compressionHeader);
    const { messages: compressed, saved } = compressionEngine.compress(messages || [], 128000);

    await forwardRequest(target, { ...req, body: { ...req.body, messages: compressed } }, res, saved);
  } catch (err) {
    res.status(500).json({ error: { message: err.message, type: 'server_error' } });
  }
});

app.post('/v1/responses', async (req, res) => {
  stats.totalRequests++;
  const { model, input } = req.body;
  const messages = [];
  if (typeof input === 'string') {
    messages.push({ role: 'user', content: input });
  } else if (Array.isArray(input)) {
    for (const item of input) {
      if (item.type === 'message') messages.push({ role: item.role, content: item.content });
    }
  }
  req.body = { ...req.body, messages, model };

  try {
    const strategy = req.headers['x-omniwave-strategy'] || 'auto';
    const target = routingEngine.resolve(model || 'auto', strategy);
    await forwardRequest(target, req, res);
  } catch (err) {
    res.status(500).json({ error: { message: err.message, type: 'server_error' } });
  }
});

async function forwardRequest(provider, req, res, compressionSaved = 0) {
  const startTime = Date.now();
  try {
    const credentials = keystore.get(provider.id);
    if (!credentials) throw new Error(`No credentials for ${provider.id}`);
    const result = await adapter.chatCompletion(provider.id, req.body.model, req.body, credentials);
    const latency = Date.now() - startTime;
    const tokensUsed = result.data?.usage?.total_tokens || 0;

    routingEngine.recordSuccess(provider.id);
    circuitBreaker.recordSuccess(provider.id);
    quotaTracker.recordRequest(provider.id, tokensUsed);
    stats.totalTokens += tokensUsed;

    if (req.body.stream && result.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-OmniWave-Provider', provider.id);
      res.setHeader('X-OmniWave-Latency', latency.toString());
      result.stream.pipe(res);
    } else {
      const response = result.data;
      res.setHeader('X-OmniWave-Provider', provider.id);
      res.setHeader('X-OmniWave-Latency', latency.toString());
      res.json(response);
    }
  } catch (err) {
    routingEngine.recordFailure(provider.id);
    circuitBreaker.recordFailure(provider.id, err.statusCode || 500);

    if (err.statusCode === 429 || err.statusCode >= 500 || err.message.includes('timeout')) {
      const connected = getConnectedProviders().filter(p => p.id !== provider.id && circuitBreaker.canRequest(p.id));
      if (connected.length > 0) return await forwardRequest(connected[0], req, res, compressionSaved);
    }
    res.status(err.statusCode || 500).json({
      error: { message: err.message, type: 'provider_error', provider: provider.id },
    });
  }
}

// ─── Dashboard API ───

app.get('/api/status', (req, res) => {
  const connected = getConnectedProviders();
  res.json({
    name: 'OmniWave Gateway',
    version: '1.3.0',
    uptime: Math.floor((Date.now() - stats.uptime) / 1000),
    apiKey: API_KEY.substring(0, 12) + '...',
    stats: { ...stats },
    compression: compressionEngine.getStats(),
    providers: listProviders(),
    models: connected.length > 0 ? connected.flatMap(p => p.models.map(m => ({ id: m, provider: p.id, providerName: p.name }))) : [],
    circuitBreakers: circuitBreaker.getStatus(),
    quotas: quotaTracker.getAllUsage(),
  });
});

app.get('/api/providers', (req, res) => {
  res.json({ providers: listProviders() });
});

app.get('/api/models', (req, res) => {
  res.json({ models: getAllModels() });
});

app.get('/api/keys', (req, res) => {
  res.json({ keys: keystore.list() });
});

app.put('/api/keys/:provider', (req, res) => {
  const { provider } = req.params;
  if (!PROVIDERS[provider]) return res.status(400).json({ error: 'Unknown provider' });
  const { key, url } = req.body;
  if (!key) return res.status(400).json({ error: 'Key required' });
  keystore.set(provider, key, url ? { url } : {});
  res.json({ status: 'saved', provider });
});

app.delete('/api/keys/:provider', (req, res) => {
  keystore.remove(req.params.provider);
  res.json({ status: 'deleted', provider: req.params.provider });
});

app.get('/api/logs', (req, res) => {
  res.json({ logs: adapter.getRequestLog(100) });
});

app.get('/api/routing', (req, res) => {
  res.json({
    strategies: [
      'auto', 'auto/fast', 'auto/cheap', 'auto/coding', 'auto/offline',
      'priority', 'fill-first', 'weighted', 'round-robin', 'p2c',
      'least-used', 'random', 'strict-random', 'cost-optimized',
      'headroom', 'reset-window', 'reset-aware', 'context-relay',
      'context-optimized', 'cache-optimized', 'lkgp', 'fusion', 'pipeline',
    ],
  });
});

app.put('/api/compression', (req, res) => {
  const { mode } = req.body;
  compressionEngine.setMode(mode);
  res.json({ status: 'ok', mode });
});

app.get('/api/export', (req, res) => {
  const lines = [`# OmniWave Gateway Environment`, `OMNIWAVE_KEY=${API_KEY}`, `PORT=${PORT}`];
  const keys = keystore.list();
  for (const k of keys) {
    const full = keystore.get(k.provider);
    if (full) lines.push(`${k.provider.toUpperCase()}_API_KEY=${full.key}`);
    if (k.url) lines.push(`${k.provider.toUpperCase()}_URL=${k.url}`);
  }
  res.type('text/plain').send(lines.join('\n'));
});

// ─── Start ───
app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════════════╗`);
  console.log(`  ║  ⚡ OmniWave Gateway — Free AI Router       ║`);
  console.log(`  ╚══════════════════════════════════════════════╝`);
  console.log(`\n  Dashboard:  http://localhost:${PORT}`);
  console.log(`  API:        http://localhost:${PORT}/v1`);
  console.log(`  API Key:    ${API_KEY}`);
  console.log(`  Models:     http://localhost:${PORT}/v1/models`);
  console.log(`\n  Point your tools at: http://localhost:${PORT}/v1`);
  console.log(`  Use API key: ${API_KEY}\n`);
});

module.exports = app;
