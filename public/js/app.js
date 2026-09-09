/* ═══════════════════════════════════════════════════
   OmniWave Dashboard — Application Logic
   ═══════════════════════════════════════════════════ */

const PROVIDERS = {
  openai:       { name: 'OpenAI',       icon: '🤖', desc: 'GPT-4o, GPT-5, o1, o3',           free: false },
  anthropic:    { name: 'Anthropic',    icon: '🧠', desc: 'Claude Opus, Sonnet, Haiku',       free: false },
  gemini:       { name: 'Google Gemini', icon: '💎', desc: 'Gemini 2.5 Pro, Flash',            free: true  },
  openrouter:   { name: 'OpenRouter',   icon: '🔀', desc: '350+ models, multi-provider',      free: true  },
  groq:         { name: 'Groq',         icon: '⚡', desc: 'Llama, Mixtral, ultra-fast',       free: true  },
  deepseek:     { name: 'DeepSeek',     icon: '🐋', desc: 'DeepSeek Chat & Reasoner',         free: false },
  mistral:      { name: 'Mistral AI',   icon: '🌀', desc: 'Mistral Large, Codestral',         free: true  },
  together:     { name: 'Together AI',  icon: '🤝', desc: 'Open-source model hosting',        free: true  },
  fireworks:    { name: 'Fireworks AI', icon: '🎆', desc: 'Fast serverless inference',         free: true  },
  perplexity:   { name: 'Perplexity',   icon: '🔍', desc: 'Search-augmented LLMs',            free: false },
  cerebras:     { name: 'Cerebras',     icon: '🧊', desc: 'Ultra-fast wafer-scale inference',  free: true  },
  nvidia:       { name: 'NVIDIA NIM',   icon: '💚', desc: 'NVIDIA-hosted models',             free: true  },
  cohere:       { name: 'Cohere',       icon: '🔮', desc: 'Command R models',                 free: true  },
  siliconflow:  { name: 'SiliconFlow',  icon: '☁️', desc: 'DeepSeek, Qwen, GLM',              free: true  },
  opencodezen:  { name: 'OpenCode Zen', icon: '⚡', desc: 'Coding-optimized models',          free: true  },
  xkiro:        { name: 'Xkiro',        icon: '🛰️', desc: 'Aggregated model access',          free: true  },
  freebuff:     { name: 'FreeBuff Proxy', icon: '🛡️', desc: 'Proxied model routing',         free: true  },
  tokenrouter:  { name: 'Token Router', icon: '🔁', desc: 'Token-based API routing',           free: true  },
  custom:       { name: 'Custom Endpoint', icon: '🔗', desc: 'Your own API endpoint',         free: false },
};

const STRATEGIES = [
  { id: 'auto',              name: 'auto',              desc: 'Smart auto-combo — balanced 15-factor scoring' },
  { id: 'auto/fast',         name: 'auto/fast',         desc: 'Lowest latency first' },
  { id: 'auto/cheap',        name: 'auto/cheap',        desc: 'Cheapest per token first' },
  { id: 'auto/coding',       name: 'auto/coding',       desc: 'Code quality first' },
  { id: 'auto/offline',      name: 'auto/offline',      desc: 'Most quota/rate-limit headroom' },
  { id: 'priority',          name: 'priority',          desc: 'Ordered list — drain each target' },
  { id: 'fill-first',        name: 'fill-first',        desc: "Fill each target's quota fully" },
  { id: 'weighted',          name: 'weighted',          desc: 'Weighted random by per-target weight' },
  { id: 'round-robin',       name: 'round-robin',       desc: 'Cycle through targets in order' },
  { id: 'p2c',               name: 'p2c',               desc: 'Power-of-two-choices load balancing' },
  { id: 'least-used',        name: 'least-used',        desc: 'Pick the target with lowest load' },
  { id: 'random',            name: 'random',            desc: 'Uniform random pick' },
  { id: 'cost-optimized',    name: 'cost-optimized',    desc: 'Minimize cost per request' },
  { id: 'headroom',          name: 'headroom',          desc: 'Most remaining quota' },
  { id: 'strict-random',     name: 'strict-random',     desc: 'Uniform random with no repeats' },
  { id: 'reset-window',      name: 'reset-window',      desc: 'Window-aware quota reset' },
  { id: 'reset-aware',       name: 'reset-aware',       desc: 'Reset-aware with usage rate' },
  { id: 'context-relay',     name: 'context-relay',     desc: 'Relay context between calls' },
  { id: 'context-optimized', name: 'context-optimized', desc: 'Largest context models first' },
  { id: 'cache-optimized',   name: 'cache-optimized',   desc: 'Favor cacheable providers' },
  { id: 'lkgp',              name: 'lkgp',              desc: 'Last-Known-Good Path — sticky routing' },
  { id: 'fusion',            name: 'fusion',            desc: 'Fan out to panel + judge synthesizes' },
  { id: 'pipeline',          name: 'pipeline',          desc: 'Chain steps — each output feeds next' },
];

const COMPRESSION_MODES = [
  { id: 'off',        name: 'Off',        desc: 'No compression' },
  { id: 'lite',       name: 'Lite',       desc: 'Dedup + whitespace only' },
  { id: 'standard',   name: 'Standard',   desc: '+ Caveman truncation' },
  { id: 'aggressive', name: 'Aggressive',  desc: '+ Filler removal + truncate' },
  { id: 'ultra',      name: 'Ultra',      desc: 'All engines at max' },
];

let cachedStatus = null;
let cachedKeys = [];
let currentCompressionMode = 'standard';

/* ─── API Helpers ─── */
async function api(path, method = 'GET', body = null) {
  try {
    const opts = { method, headers: {} };
    if (body) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(path, opts);
    const text = await res.text();
    try { return JSON.parse(text); } catch { return text; }
  } catch (e) {
    console.error(`API ${method} ${path} failed:`, e);
    return null;
  }
}

/* ─── Tab Navigation ─── */
document.querySelectorAll('.nav-links li').forEach(li => {
  li.addEventListener('click', () => {
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    li.classList.add('active');
    const tab = document.getElementById(`tab-${li.dataset.tab}`);
    if (tab) tab.classList.add('active');
    // Refresh data for the tab
    const tabName = li.dataset.tab;
    if (tabName === 'overview') loadOverview();
    if (tabName === 'providers') loadProviders();
    if (tabName === 'models') loadModels();
    if (tabName === 'logs') loadLogs();
    if (tabName === 'resilience') loadResilience();
    if (tabName === 'compression') loadCompression();
    if (tabName === 'settings') loadSettings();
  });
});

/* ─── Overview ─── */
async function loadOverview() {
  const status = await api('/api/status');
  if (!status) return;
  cachedStatus = status;

  const connected = status.providers.filter(p => p.connected);
  const totalModels = connected.reduce((s, p) => s + (p.models?.length || 0), 0) + 4; // +4 auto models

  document.getElementById('overview-stats').innerHTML = `
    <div class="stat-card"><div class="stat-value">${status.stats.totalRequests.toLocaleString()}</div><div class="stat-label">Total Requests</div></div>
    <div class="stat-card"><div class="stat-value">${formatTokens(status.stats.totalTokens)}</div><div class="stat-label">Total Tokens</div></div>
    <div class="stat-card green"><div class="stat-value">${connected.length}</div><div class="stat-label">Connected Providers</div></div>
    <div class="stat-card purple"><div class="stat-value">${totalModels}</div><div class="stat-label">Available Models</div></div>
    <div class="stat-card yellow"><div class="stat-value">${formatTokens(status.compression.totalSaved)}</div><div class="stat-label">Tokens Saved</div></div>
    <div class="stat-card cyan"><div class="stat-value">${formatUptime(status.uptime)}</div><div class="stat-label">Uptime</div></div>
  `;

  document.getElementById('qs-apikey').textContent = status.apiKey;

  document.getElementById('overview-providers').innerHTML = status.providers.map(p => {
    const m = PROVIDERS[p.id] || {};
    return `<div class="provider-pill"><div class="dot ${p.connected ? 'on' : 'off'}"></div>${m.icon || '📡'} ${m.name || p.name}</div>`;
  }).join('');
}

/* ─── Providers ─── */
async function loadProviders() {
  const data = await api('/api/keys');
  if (!data) return;
  cachedKeys = data.keys;
  const keys = {};
  data.keys.forEach(k => keys[k.provider] = k);

  document.getElementById('provider-cards').innerHTML = Object.entries(PROVIDERS).map(([id, meta]) => {
    const connected = !!keys[id];
    const preview = keys[id]?.preview || '';
    return `
      <div class="provider-card">
        <div class="p-header">
          <div class="p-name">${meta.icon} ${meta.name}</div>
          <div style="display:flex;gap:0.4rem">
            ${meta.free ? '<span class="badge badge-free">Free Tier</span>' : ''}
            <span class="badge ${connected ? 'badge-connected' : 'badge-disconnected'}">${connected ? '● Connected' : '○ Disconnected'}</span>
          </div>
        </div>
        <div class="p-desc">${meta.desc}</div>
        <input type="password" class="key-input" id="key-${id}" placeholder="Enter ${meta.name} API key..." autocomplete="off">
        ${id === 'custom' ? '<input type="text" class="key-input" id="url-custom" placeholder="Custom endpoint URL (https://...)" style="margin-top:0.4rem">' : ''}
        <div class="p-actions">
          <button class="btn btn-primary" onclick="saveKey('${id}')">Save</button>
          <button class="btn btn-danger" onclick="removeKey('${id}')">Remove</button>
          ${connected ? `<span class="p-preview">${preview}</span>` : ''}
        </div>
      </div>`;
  }).join('');
}

async function saveKey(id) {
  const input = document.getElementById(`key-${id}`);
  const key = input.value.trim();
  if (!key) { toast('Enter a key first', 'error'); return; }

  const body = { key };
  const urlInput = document.getElementById('url-custom');
  if (urlInput && urlInput.value.trim()) body.url = urlInput.value.trim();

  const res = await api(`/api/keys/${id}`, 'PUT', body);
  if (res?.status === 'saved') {
    input.value = '';
    if (urlInput) urlInput.value = '';
    toast(`${PROVIDERS[id]?.name || id} connected successfully`, 'success');
    loadProviders();
  } else {
    toast(`Failed to save: ${res?.error || 'Unknown error'}`, 'error');
  }
}

async function removeKey(id) {
  const res = await api(`/api/keys/${id}`, 'DELETE');
  if (res?.status === 'deleted') {
    toast(`${PROVIDERS[id]?.name || id} disconnected`, 'success');
    loadProviders();
  }
}

/* ─── Models ─── */
let allModels = [];
async function loadModels() {
  const data = await api('/api/models');
  if (!data) return;

  allModels = [
    { id: 'auto', provider: 'omniwave', providerName: 'OmniWave' },
    { id: 'auto/fast', provider: 'omniwave', providerName: 'OmniWave' },
    { id: 'auto/cheap', provider: 'omniwave', providerName: 'OmniWave' },
    { id: 'auto/coding', provider: 'omniwave', providerName: 'OmniWave' },
    ...data.models,
  ];

  renderModels(allModels);

  document.getElementById('model-search').oninput = (e) => {
    const q = e.target.value.toLowerCase();
    renderModels(allModels.filter(m =>
      m.id.toLowerCase().includes(q) || m.providerName?.toLowerCase().includes(q) || m.provider?.toLowerCase().includes(q)
    ));
  };
}

function renderModels(models) {
  const container = document.getElementById('model-list');
  if (models.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">🧠</div><p>No models match your search. Connect providers to see their models.</p></div>';
    return;
  }
  container.innerHTML = models.map(m => {
    const meta = PROVIDERS[m.provider] || {};
    const isAuto = m.provider === 'omniwave';
    return `<div class="model-row">
      <span class="model-id">${m.id}</span>
      <span class="model-provider">${meta.icon || '📡'} ${m.providerName || m.provider}</span>
      ${isAuto ? '<span class="badge badge-free">Smart Routing</span>' : ''}
    </div>`;
  }).join('');
}

/* ─── Routing ─── */
function loadRouting() {
  document.getElementById('strategy-list').innerHTML = STRATEGIES.map(s =>
    `<div class="strategy-card ${s.id === 'auto' ? 'active' : ''}" data-strategy="${s.id}">
      <strong>${s.name}</strong><p>${s.desc}</p>
    </div>`
  ).join('');

  document.querySelectorAll('.strategy-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.strategy-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      document.getElementById('routing-strategy').value = card.dataset.strategy;
      toast(`Strategy set to ${card.dataset.strategy}`, 'info');
    });
  });

  document.getElementById('routing-strategy').addEventListener('change', (e) => {
    document.querySelectorAll('.strategy-card').forEach(c => {
      c.classList.toggle('active', c.dataset.strategy === e.target.value);
    });
    toast(`Strategy set to ${e.target.value}`, 'info');
  });
}

/* ─── Compression ─── */
async function loadCompression() {
  const modesEl = document.getElementById('compression-modes');
  modesEl.innerHTML = COMPRESSION_MODES.map(m =>
    `<button class="mode-btn ${m.id === currentCompressionMode ? 'active' : ''}" data-mode="${m.id}" title="${m.desc}">${m.name}</button>`
  ).join('');

  modesEl.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      modesEl.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCompressionMode = btn.dataset.mode;
      await api('/api/compression', 'PUT', { mode: btn.dataset.mode });
      toast(`Compression set to ${btn.dataset.mode}`, 'success');
      updateCompressionStats();
    });
  });

  updateCompressionStats();
}

async function updateCompressionStats() {
  const status = await api('/api/status');
  if (!status) return;
  const s = status.compression;
  document.getElementById('compression-stats').innerHTML =
    `Mode: <strong>${currentCompressionMode}</strong> · Saved: <strong>${formatTokens(s.totalSaved)} tokens</strong> across ${s.totalRequests} requests · Avg: ${formatTokens(s.avgSaved)} tokens/request`;
}

/* ─── Resilience ─── */
async function loadResilience() {
  const status = await api('/api/status');
  if (!status) return;
  const breakers = status.circuitBreakers || {};
  const container = document.getElementById('breaker-status');

  if (Object.keys(breakers).length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">🛡️</div><p>No circuit breaker events yet. They appear after failed requests to providers.</p></div>';
    return;
  }

  container.innerHTML = Object.entries(breakers).map(([id, b]) => {
    const meta = PROVIDERS[id] || {};
    const stateClass = b.state === 'closed' ? 'closed' : b.state === 'open' ? 'open' : 'half-open';
    return `<div class="breaker-row">
      <span>${meta.icon || '📡'} ${meta.name || id}</span>
      <span class="breaker-state ${stateClass}">${b.state}</span>
      <span class="muted">Failures: ${b.failures} · Cooldown: ${Math.ceil(b.cooldownRemaining / 1000)}s</span>
    </div>`;
  }).join('');
}

/* ─── Logs ─── */
async function loadLogs() {
  const data = await api('/api/logs');
  if (!data) return;
  const container = document.getElementById('log-list');

  if (!data.logs || data.logs.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>No logs yet. Logs appear after making requests through the gateway.</p></div>';
    return;
  }

  container.innerHTML = data.logs.map(l => {
    const meta = PROVIDERS[l.provider] || {};
    const time = new Date(l.timestamp).toLocaleTimeString();
    const statusColor = l.status === 'error' ? 'var(--red)' : l.status >= 200 && l.status < 300 ? 'var(--green)' : 'var(--text-dim)';
    return `<div class="log-row">
      <span class="muted">${time}</span>
      <span>${meta.icon || '📡'} ${l.provider}</span>
      <span class="model-id">${l.model || '-'}</span>
      <span style="color:${statusColor}">${l.status}</span>
      <span class="muted">${l.latency}ms</span>
    </div>`;
  }).join('');
}

/* ─── Settings ─── */
async function loadSettings() {
  const status = await api('/api/status');
  if (!status) return;
  const port = window.location.port || '20128';
  document.getElementById('settings-info').innerHTML = `
    <div class="settings-row"><span class="settings-label">Dashboard</span><span class="settings-value"><code>http://localhost:${port}</code></span></div>
    <div class="settings-row"><span class="settings-label">API Endpoint</span><span class="settings-value"><code>http://localhost:${port}/v1</code></span></div>
    <div class="settings-row"><span class="settings-label">API Key</span><span class="settings-value" id="settings-key"><code>${status.apiKey}</code></span></div>
    <div class="settings-row"><span class="settings-label">Port</span><span class="settings-value">${port}</span></div>
    <div class="settings-row"><span class="settings-label">Version</span><span class="settings-value">v${status.version}</span></div>
    <div class="settings-row"><span class="settings-label">Uptime</span><span class="settings-value">${formatUptime(status.uptime)}</span></div>
  `;
}

function copyApiKey() {
  const el = document.getElementById('settings-key');
  if (el) {
    const key = el.textContent.trim();
    navigator.clipboard.writeText(key).then(() => toast('API key copied', 'success'));
  }
}

function exportEnv() { window.open('/api/export', '_blank'); }

/* ─── Utilities ─── */
function formatUptime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function formatTokens(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = (type === 'success' ? '✓ ' : type === 'error' ? '✗ ' : 'ℹ ') + msg;
  el.className = `toast ${type} show`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2500);
}

/* ─── Init ─── */
loadOverview();
loadProviders();
loadModels();
loadRouting();
loadCompression();
loadResilience();
loadSettings();

// Auto-refresh overview + resilience every 8s
setInterval(() => {
  const active = document.querySelector('.nav-links li.active')?.dataset.tab;
  if (active === 'overview') loadOverview();
  if (active === 'resilience') loadResilience();
}, 8000);

/* ─── Termux / Mobile Support ─── */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

// Close sidebar on mobile when clicking a nav item
document.querySelectorAll('.nav-links li').forEach(li => {
  li.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.remove('open');
    }
  });
});

// Close sidebar on outside click (mobile)
document.addEventListener('click', (e) => {
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.querySelector('.mobile-menu-btn');
    if (sidebar && !sidebar.contains(e.target) && !menuBtn?.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  }
});

// Show Termux tip if on mobile
if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
  const tip = document.createElement('div');
  tip.className = 'termux-tip';
  tip.innerHTML = `
    <div class="icon">📱</div>
    <div>
      <strong>Running on Mobile?</strong>
      <p>This dashboard works great on phones! Use the menu ☰ to navigate.</p>
      <p>For the best experience, add this page to your home screen.</p>
    </div>
  `;
  const overview = document.getElementById('tab-overview');
  if (overview) overview.prepend(tip);
}

// Haptic feedback on mobile menu interactions
if (navigator.vibrate) {
  document.querySelectorAll('.nav-links li, .btn, .mobile-menu-btn').forEach(el => {
    el.addEventListener('click', () => navigator.vibrate(15));
  });
}
