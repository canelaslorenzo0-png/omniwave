/* ═══════════════════════════════════════════════════
   OmniWave Dashboard — Premium Application Logic
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
let providerFilter = 'all';
let allModels = [];

/* ─── API Helpers ─── */
async function api(path, method = 'GET', body = null) {
  try {
    const opts = { method, headers: {} };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
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
    const tab = document.getElementById('tab-' + li.dataset.tab);
    if (tab) { tab.classList.add('active'); tab.style.animation = 'none'; tab.offsetHeight; tab.style.animation = ''; }
    const loaders = { overview: loadOverview, providers: loadProviders, models: loadModels, routing: loadRouting, compression: loadCompression, resilience: loadResilience, logs: loadLogs, settings: loadSettings };
    loaders[li.dataset.tab]?.();
  });
});

/* ─── Animated Counter ─── */
function animateValue(el, start, end, duration = 800) {
  const startTime = performance.now();
  const update = (now) => {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(start + (end - start) * eased);
    el.textContent = formatTokens(current);
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

/* ─── Toast System ─── */
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'} ${msg}`;
  container.appendChild(el);
  requestAnimationFrame(() => { el.classList.add('show'); });
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 350);
  }, 2800);
}

/* ─── Copy Text ─── */
function copyText(text) {
  navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard', 'success')).catch(() => toast('Copy failed', 'error'));
}

/* ─── Overview ─── */
async function loadOverview() {
  const status = await api('/api/status');
  if (!status) return;
  cachedStatus = status;
  const p = status.providers || [];
  const connected = p.filter(x => x.connected).length;
  const totalModels = status.models?.length || 0;

  document.getElementById('overview-stats').innerHTML = `
    <div class="stat-card green"><div class="stat-value" data-count="${connected}">${connected}</div><div class="stat-label">Providers</div></div>
    <div class="stat-card"><div class="stat-value" data-count="${totalModels}">${totalModels}</div><div class="stat-label">Models</div></div>
    <div class="stat-card purple"><div class="stat-value" data-count="${status.stats?.totalRequests || 0}">${formatTokens(status.stats?.totalRequests || 0)}</div><div class="stat-label">Requests</div></div>
    <div class="stat-card yellow"><div class="stat-value">${formatUptime(status.uptime || 0)}</div><div class="stat-label">Uptime</div></div>
  `;

  document.getElementById('overview-updated').textContent = 'Updated ' + new Date().toLocaleTimeString();

  const pl = document.getElementById('overview-providers');
  pl.innerHTML = p.map(x => {
    const meta = PROVIDERS[x.id] || {};
    return `<div class="provider-list-item">
      <div class="provider-list-dot ${x.connected ? 'on' : 'off'}"></div>
      <span>${meta.icon || '📡'}</span>
      <span style="flex:1">${x.name}</span>
      <span class="muted">${x.models?.length || 0} models</span>
    </div>`;
  }).join('');

  // Health score
  const healthPct = connected > 0 ? Math.min(100, Math.round((connected / p.length) * 100)) : 0;
  const healthColor = healthPct >= 80 ? 'var(--green)' : healthPct >= 50 ? 'var(--yellow)' : 'var(--red)';
  document.getElementById('health-score').innerHTML = `
    <div class="health-ring">
      <svg viewBox="0 0 120 120">
        <circle class="ring-bg" cx="60" cy="60" r="50"/>
        <circle class="ring-fill" cx="60" cy="60" r="50" style="stroke:${healthColor};stroke-dashoffset:${314 - (314 * healthPct / 100)}"/>
      </svg>
      <div class="health-score-text" style="color:${healthColor}">${healthPct}%</div>
    </div>
    <div class="health-details">${connected} of ${p.length} providers connected · ${totalModels} models available</div>
  `;

  const qsEndpoint = document.getElementById('qs-endpoint');
  if (qsEndpoint) qsEndpoint.textContent = `http://localhost:${window.location.port || '20128'}/v1`;
  const qsKey = document.getElementById('qs-apikey');
  if (qsKey && status.apiKey) qsKey.textContent = status.apiKey.substring(0, 20) + '...';
}

/* ─── Providers ─── */
async function loadProviders() {
  const data = await api('/api/providers');
  if (!data) return;
  cachedKeys = data.keys || [];

  renderProviders(data.providers || []);
}

function renderProviders(providers) {
  const container = document.getElementById('provider-cards');
  const search = document.getElementById('provider-search')?.value?.toLowerCase() || '';

  const filtered = providers.filter(p => {
    const meta = PROVIDERS[p.id] || {};
    if (search && !p.name.toLowerCase().includes(search) && !meta.desc?.toLowerCase().includes(search)) return false;
    if (providerFilter === 'connected' && !p.connected) return false;
    if (providerFilter === 'free' && !meta.free) return false;
    return true;
  });

  container.innerHTML = filtered.map((p, i) => {
    const meta = PROVIDERS[p.id] || {};
    const key = cachedKeys.find(k => k.provider === p.id);
    return `<div class="provider-card ${p.connected ? 'connected' : ''}" style="animation: staggerIn 0.4s ease ${i * 0.04}s both">
      <div class="provider-header">
        <div class="provider-icon">${meta.icon || '📡'}</div>
        <div class="provider-info">
          <div class="provider-name">${p.name}</div>
          <div class="provider-desc">${meta.desc || ''}</div>
        </div>
        <span class="provider-status ${p.connected ? 'connected' : 'disconnected'}">${p.connected ? 'Connected' : 'Offline'}</span>
      </div>
      <div class="provider-models">${p.models?.length || 0} models${meta.free ? ' · <span class="model-free">Free Tier</span>' : ''}</div>
      <div class="provider-actions">
        ${p.connected
          ? `<button class="btn btn-danger btn-sm" onclick="removeProvider('${p.id}')">Remove</button>`
          : `<button class="btn btn-primary btn-sm" onclick="addProvider('${p.id}')">Add Key</button>`
        }
        ${key ? `<span class="muted" style="align-self:center;font-size:0.7rem">${key.preview}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

function filterProviders(value) { loadProviders(); }
function setProviderFilter(filter, btn) {
  providerFilter = filter;
  document.querySelectorAll('#provider-filters .pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  loadProviders();
}

async function addProvider(id) {
  const key = prompt(`Enter API key for ${PROVIDERS[id]?.name || id}:`);
  if (!key) return;
  await api(`/api/keys/${id}`, 'PUT', { key });
  toast(`${PROVIDERS[id]?.name || id} connected!`, 'success');
  loadProviders();
}

async function removeProvider(id) {
  if (!confirm(`Remove ${PROVIDERS[id]?.name || id}?`)) return;
  await api(`/api/keys/${id}`, 'DELETE');
  toast(`${PROVIDERS[id]?.name || id} removed`, 'info');
  loadProviders();
}

/* ─── Models ─── */
async function loadModels() {
  const status = await api('/api/status');
  if (!status) return;
  allModels = status.models || [];
  renderModels(allModels);
}

function renderModels(models) {
  const container = document.getElementById('model-list');
  const count = document.getElementById('model-count');
  if (count) count.textContent = `${models.length} models`;

  if (models.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">🧠</div><p>No models available. Connect a provider first.</p></div>';
    return;
  }

  container.innerHTML = `<div class="model-row" style="color:var(--text-muted);font-weight:600;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.05em">
    <span>Model</span><span>Provider</span><span>Status</span>
  </div>` + models.map(m => {
    const meta = PROVIDERS[m.provider] || {};
    return `<div class="model-row">
      <span class="model-id">${m.id}</span>
      <span class="model-provider">${meta.icon || ''} ${m.providerName || m.provider}</span>
      <span class="model-free">Available</span>
    </div>`;
  }).join('');
}

function filterModels(value) {
  const q = value.toLowerCase();
  const filtered = allModels.filter(m =>
    m.id.toLowerCase().includes(q) || (m.providerName || m.provider || '').toLowerCase().includes(q)
  );
  renderModels(filtered);
}

/* ─── Routing ─── */
async function loadRouting() {
  const container = document.getElementById('strategy-list');
  container.innerHTML = STRATEGIES.map((s, i) => `
    <div class="strategy-card" style="--i:${i}" onclick="selectStrategy('${s.id}')">
      <div class="strategy-name">${s.name}</div>
      <div class="strategy-desc">${s.desc}</div>
    </div>
  `).join('');

  document.getElementById('routing-strategy').addEventListener('change', (e) => {
    toast(`Strategy set to ${e.target.value}`, 'info');
    loadRouting();
  });
}

function selectStrategy(id) {
  document.getElementById('routing-strategy').value = id;
  document.querySelectorAll('.strategy-card').forEach(c => c.classList.remove('active'));
  event.currentTarget.classList.add('active');
  toast(`Strategy: ${id}`, 'info');
}

/* ─── Compression ─── */
async function loadCompression() {
  const status = await api('/api/status');
  if (!status?.compression) return;

  const comp = status.compression;
  currentCompressionMode = comp.mode || 'standard';

  const modes = document.getElementById('compression-modes');
  modes.innerHTML = COMPRESSION_MODES.map(m => `
    <button class="compression-mode ${m.id === currentCompressionMode ? 'active' : ''}"
      onclick="setCompression('${m.id}')" title="${m.desc}">
      ${m.name}
    </button>
  `).join('');

  document.getElementById('compression-stats').innerHTML = `
    <div><span class="muted">Mode</span><br><strong>${comp.mode}</strong></div>
    <div><span class="muted">Requests</span><br><strong>${comp.totalRequests}</strong></div>
    <div><span class="muted">Saved</span><br><strong>${formatTokens(comp.totalSaved)}</strong></div>
    <div><span class="muted">Avg Saved</span><br><strong>${comp.avgSaved?.toFixed(1) || 0}%</strong></div>
  `;
}

async function setCompression(mode) {
  await api('/api/compression', 'PUT', { mode });
  currentCompressionMode = mode;
  toast(`Compression: ${mode}`, 'success');
  loadCompression();
}

/* ─── Resilience ─── */
async function loadResilience() {
  const status = await api('/api/status');
  if (!status) return;

  const container = document.getElementById('breaker-status');
  const breakers = status.circuitBreakers || {};
  const keys = Object.entries(breakers);

  if (keys.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">🛡️</div><p>All circuits healthy. No breaker events.</p></div>';
    return;
  }

  container.innerHTML = keys.map(([id, b]) => {
    const stateColor = b.state === 'OPEN' ? 'var(--red)' : b.state === 'HALF_OPEN' ? 'var(--yellow)' : 'var(--green)';
    return `<div class="layer-card">
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
        <div style="width:10px;height:10px;border-radius:50%;background:${stateColor}"></div>
        <strong>${id}</strong>
      </div>
      <p>State: <span style="color:${stateColor}">${b.state}</span> · Failures: ${b.failures || 0}</p>
    </div>`;
  }).join('');
}

/* ─── Logs ─── */
async function loadLogs() {
  const data = await api('/api/logs');
  const container = document.getElementById('log-list');
  if (!data?.logs?.length) {
    container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>No logs yet. Logs appear after making requests.</p></div>';
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
      <span class="log-latency">${l.latency}ms</span>
    </div>`;
  }).join('');
}

function clearLogs() { toast('Logs cleared (session only)', 'info'); document.getElementById('log-list').innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>Logs cleared.</p></div>'; }

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
  document.getElementById('sb-version').textContent = 'v' + status.version;
}

function copyApiKey() {
  const el = document.getElementById('settings-key');
  if (el) copyText(el.textContent.trim());
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

/* ─── Particles ─── */
function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let w, h, particles = [];

  function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 50; i++) {
    particles.push({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.5, a: Math.random() * 0.3 + 0.1,
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(77, 159, 255, ${p.a})`;
      ctx.fill();
    });

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(77, 159, 255, ${0.06 * (1 - dist / 120)})`;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
}

/* ─── Command Palette ─── */
function initCommandPalette() {
  const overlay = document.getElementById('cmd-overlay');
  const input = document.getElementById('cmd-input');
  const results = document.getElementById('cmd-results');

  const commands = [
    { icon: '📊', label: 'Overview', action: () => clickTab('overview') },
    { icon: '🌐', label: 'Providers', action: () => clickTab('providers') },
    { icon: '🧠', label: 'Models', action: () => clickTab('models') },
    { icon: '🔀', label: 'Routing', action: () => clickTab('routing') },
    { icon: '🗜️', label: 'Compression', action: () => clickTab('compression') },
    { icon: '🛡️', label: 'Resilience', action: () => clickTab('resilience') },
    { icon: '📋', label: 'Logs', action: () => clickTab('logs') },
    { icon: '⚙️', label: 'Settings', action: () => clickTab('settings') },
    { icon: '📋', label: 'Copy API Key', shortcut: '', action: () => { copyApiKey(); closeCmd(); } },
    { icon: '📥', label: 'Export .env', action: () => { exportEnv(); closeCmd(); } },
    { icon: '↻', label: 'Refresh Dashboard', action: () => { loadOverview(); closeCmd(); } },
  ];

  function renderCmd(query = '') {
    const q = query.toLowerCase();
    const filtered = commands.filter(c => c.label.toLowerCase().includes(q));
    results.innerHTML = filtered.map((c, i) => `
      <div class="cmd-item ${i === 0 ? 'active' : ''}" data-idx="${i}">
        <span class="cmd-item-icon">${c.icon}</span>
        <span class="cmd-item-label">${c.label}</span>
        ${c.shortcut ? `<span class="cmd-item-shortcut">${c.shortcut}</span>` : ''}
      </div>
    `).join('');

    results.querySelectorAll('.cmd-item').forEach((el, i) => {
      el.addEventListener('click', () => { filtered[i]?.action(); closeCmd(); });
    });
  }

  function openCmd() {
    overlay.classList.add('open');
    input.value = '';
    renderCmd();
    setTimeout(() => input.focus(), 50);
  }

  function closeCmd() { overlay.classList.remove('open'); }

  input.addEventListener('input', () => renderCmd(input.value));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeCmd(); });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openCmd(); }
    if (e.key === 'Escape') closeCmd();
  });

  window._openCmd = openCmd;
  window._closeCmd = closeCmd;
}

function clickTab(name) {
  const li = document.querySelector(`[data-tab="${name}"]`);
  if (li) li.click();
}

/* ─── Keyboard Shortcuts ─── */
function initKeyboardShortcuts() {
  const tabKeys = { '1': 'overview', '2': 'providers', '3': 'models', '4': 'routing', '5': 'compression', '6': 'resilience', '7': 'logs', '8': 'settings' };
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'r' || e.key === 'R') {
      const active = document.querySelector('.nav-links li.active')?.dataset.tab;
      const loaders = { overview: loadOverview, providers: loadProviders, models: loadModels, routing: loadRouting, compression: loadCompression, resilience: loadResilience, logs: loadLogs, settings: loadSettings };
      loaders[active]?.();
    }
    if (tabKeys[e.key]) clickTab(tabKeys[e.key]);
  });
}

/* ─── Mobile ─── */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

document.querySelectorAll('.nav-links li').forEach(li => {
  li.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.remove('open');
    }
  });
});

document.addEventListener('click', (e) => {
  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.querySelector('.mobile-menu-btn');
    if (sidebar && !sidebar.contains(e.target) && !menuBtn?.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  }
});

if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
  const tip = document.createElement('div');
  tip.className = 'termux-tip';
  tip.innerHTML = `<div class="icon">📱</div><div><strong>Running on Mobile?</strong><p>Use the menu ☰ to navigate. Add to home screen for best experience.</p></div>`;
  const overview = document.getElementById('tab-overview');
  if (overview) overview.prepend(tip);
}

if (navigator.vibrate) {
  document.querySelectorAll('.nav-links li, .btn, .mobile-menu-btn').forEach(el => {
    el.addEventListener('click', () => navigator.vibrate(12));
  });
}

/* ─── Init ─── */
initParticles();
initCommandPalette();
initKeyboardShortcuts();
loadOverview();
loadProviders();
loadModels();
loadRouting();
loadCompression();
loadResilience();
loadSettings();

setInterval(() => {
  const active = document.querySelector('.nav-links li.active')?.dataset.tab;
  if (active === 'overview') loadOverview();
  if (active === 'resilience') loadResilience();
}, 8000);
