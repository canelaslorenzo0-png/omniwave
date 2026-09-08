const PROVIDER_META = {
  openai: { name: 'OpenAI', icon: '🤖', desc: 'GPT-4o, GPT-5, o1, o3' },
  anthropic: { name: 'Anthropic', icon: '🧠', desc: 'Claude Opus, Sonnet, Haiku' },
  gemini: { name: 'Google Gemini', icon: '💎', desc: 'Gemini 2.5 Pro, Flash' },
  openrouter: { name: 'OpenRouter', icon: '🔀', desc: '350+ models, multi-provider' },
  groq: { name: 'Groq', icon: '⚡', desc: 'Llama, Mixtral, ultra-fast' },
  deepseek: { name: 'DeepSeek', icon: '🐋', desc: 'DeepSeek Chat & Reasoner' },
  mistral: { name: 'Mistral AI', icon: '🌀', desc: 'Mistral Large, Codestral' },
  together: { name: 'Together AI', icon: '🤝', desc: 'Open-source models' },
  fireworks: { name: 'Fireworks AI', icon: '🎆', desc: 'Fast inference' },
  perplexity: { name: 'Perplexity', icon: '🔍', desc: 'Search-augmented LLMs' },
  cerebras: { name: 'Cerebras', icon: '🧠', desc: 'Ultra-fast inference' },
  nvidia: { name: 'NVIDIA NIM', icon: '💚', desc: 'NVIDIA-hosted models' },
  cohere: { name: 'Cohere', icon: '🔮', desc: 'Command R models' },
  siliconflow: { name: 'SiliconFlow', icon: '☁️', desc: 'DeepSeek, Qwen, GLM' },
  custom: { name: 'Custom Endpoint', icon: '🔗', desc: 'Your own API endpoint' },
};

const STRATEGIES = [
  { id: 'auto', name: 'auto', desc: 'Smart auto-combo — balanced LKGP scoring across 15 factors' },
  { id: 'auto/fast', name: 'auto/fast', desc: 'Lowest latency first' },
  { id: 'auto/cheap', name: 'auto/cheap', desc: 'Cheapest per token first' },
  { id: 'auto/coding', name: 'auto/coding', desc: 'Quality-first for code generation' },
  { id: 'auto/offline', name: 'auto/offline', desc: 'Most quota/rate-limit headroom' },
  { id: 'priority', name: 'priority', desc: 'Drain each target before the next' },
  { id: 'fill-first', name: 'fill-first', desc: "Fill each target's quota fully before moving on" },
  { id: 'weighted', name: 'weighted', desc: 'Weighted random by per-target weight' },
  { id: 'round-robin', name: 'round-robin', desc: 'Cycle through targets in order' },
  { id: 'p2c', name: 'p2c', desc: 'Power-of-two-choices random load balancing' },
  { id: 'least-used', name: 'least-used', desc: 'Pick target with lowest current load' },
  { id: 'random', name: 'random', desc: 'Uniform random pick' },
  { id: 'strict-random', name: 'strict-random', desc: 'Random without deduplication' },
  { id: 'cost-optimized', name: 'cost-optimized', desc: 'Minimize cost per request' },
  { id: 'headroom', name: 'headroom', desc: 'Most remaining quota' },
  { id: 'reset-window', name: 'reset-window', desc: 'Quota window resets soonest' },
  { id: 'context-relay', name: 'context-relay', desc: 'Hand off context across targets' },
  { id: 'cache-optimized', name: 'cache-optimized', desc: 'Pin prompt prefixes for cache hits' },
  { id: 'lkgp', name: 'lkgp', desc: 'Last-Known-Good Path — sticky to last success' },
  { id: 'fusion', name: 'fusion', desc: 'Fan out to panel + judge synthesizes' },
  { id: 'pipeline', name: 'pipeline', desc: "Chain steps — each output feeds next" },
];

// ─── Tab Navigation ───
document.querySelectorAll('.nav-links li').forEach(li => {
  li.addEventListener('click', () => {
    document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    li.classList.add('active');
    document.getElementById(`tab-${li.dataset.tab}`).classList.add('active');
  });
});

// ─── Load Overview ───
async function loadOverview() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    document.getElementById('stat-requests').textContent = data.stats.totalRequests.toLocaleString();
    document.getElementById('stat-tokens').textContent = data.stats.totalTokens.toLocaleString();
    document.getElementById('stat-providers').textContent = data.providers.filter(p => p.connected).length;
    document.getElementById('stat-models').textContent = data.models?.length || data.providers.reduce((s, p) => s + (p.models?.length || 0), 0);
    document.getElementById('stat-saved').textContent = data.compression?.totalSaved?.toLocaleString() || '0';
    document.getElementById('stat-uptime').textContent = formatUptime(data.uptime);
    document.getElementById('qs-apikey').textContent = data.apiKey;

    const container = document.getElementById('overview-providers');
    container.innerHTML = data.providers.map(p => {
      const meta = PROVIDER_META[p.id] || {};
      return `<div class="provider-pill"><span class="dot ${p.connected ? 'on' : 'off'}"></span>${meta.icon || '📡'} ${p.name}</div>`;
    }).join('');
  } catch (e) {
    console.error('Failed to load overview:', e);
  }
}

// ─── Load Providers ───
async function loadProviders() {
  try {
    const res = await fetch('/api/keys');
    const data = await res.json();
    const keys = {};
    data.keys.forEach(k => keys[k.provider] = k);

    const container = document.getElementById('provider-cards');
    container.innerHTML = Object.entries(PROVIDER_META).map(([id, meta]) => {
      const connected = !!keys[id];
      const keyPreview = keys[id]?.preview || '';
      return `
        <div class="provider-card">
          <div class="p-header">
            <span class="p-name">${meta.icon} ${meta.name}</span>
            <div>
              ${meta.free ? '<span class="badge free">Free Tier</span>' : ''}
              <span class="badge ${connected ? 'connected' : ''}">${connected ? '● Connected' : '○ Not connected'}</span>
            </div>
          </div>
          <div class="p-models">${meta.desc}</div>
          <input type="password" id="key-${id}" placeholder="Enter ${meta.name} API key..." autocomplete="off">
          ${id === 'custom' ? '<input type="text" id="url-custom" placeholder="Custom endpoint URL (https://...)" style="margin-top:0.4rem;">' : ''}
          <div class="p-actions">
            <button class="btn btn-primary" onclick="saveProviderKey('${id}')">Save</button>
            <button class="btn btn-danger" onclick="removeProviderKey('${id}')">Remove</button>
            ${connected ? `<span class="muted" style="margin-left:auto;font-size:0.7rem">${keyPreview}</span>` : ''}
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    console.error('Failed to load providers:', e);
  }
}

async function saveProviderKey(id) {
  const input = document.getElementById(`key-${id}`);
  const key = input.value.trim();
  if (!key) return toast('Enter a key first', true);

  const body = { key };
  const urlInput = document.getElementById('url-custom');
  if (urlInput && urlInput.value.trim()) body.url = urlInput.value.trim();

  try {
    const res = await fetch(`/api/keys/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.status === 'saved') {
      input.value = '';
      toast(`${PROVIDER_META[id]?.name || id} connected`);
      loadProviders();
      loadOverview();
    }
  } catch (e) {
    toast('Failed to save key', true);
  }
}

async function removeProviderKey(id) {
  await fetch(`/api/keys/${id}`, { method: 'DELETE' });
  toast(`${PROVIDER_META[id]?.name || id} disconnected`);
  loadProviders();
  loadOverview();
}

// ─── Load Models ───
async function loadModels() {
  try {
    const res = await fetch('/api/models');
    const data = await res.json();

    const allModels = [
      { id: 'auto', provider: 'OmniWave', providerName: 'OmniWave' },
      { id: 'auto/fast', provider: 'OmniWave', providerName: 'OmniWave' },
      { id: 'auto/cheap', provider: 'OmniWave', providerName: 'OmniWave' },
      { id: 'auto/coding', provider: 'OmniWave', providerName: 'OmniWave' },
      ...data.models,
    ];

    renderModels(allModels);

    document.getElementById('model-search').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      renderModels(allModels.filter(m =>
        m.id.toLowerCase().includes(q) || m.providerName.toLowerCase().includes(q)
      ));
    });
  } catch (e) {
    console.error('Failed to load models:', e);
  }
}

function renderModels(models) {
  document.getElementById('model-list').innerHTML = models.map(m => {
    const meta = PROVIDER_META[m.provider] || {};
    const isAuto = m.provider === 'OmniWave';
    return `<div class="model-row">
      <span><strong>${m.id}</strong></span>
      <span class="muted">${meta.icon || '📡'} ${m.providerName || m.provider}</span>
      ${isAuto ? '<span class="badge" style="background:#1a1a2e;color:var(--purple)">Smart Routing</span>' : ''}
    </div>`;
  }).join('');
}

// ─── Load Routing ───
function loadRouting() {
  document.getElementById('strategy-list').innerHTML = STRATEGIES.map(s =>
    `<div class="strategy-card"><strong>${s.name}</strong><p>${s.desc}</p></div>`
  ).join('');
}

// ─── Load Compression ───
async function loadCompression() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const stats = data.compression;
    document.getElementById('compression-stats').innerHTML = `
      <p class="muted">Mode: <strong>${data.mode || 'standard'}</strong> · Saved: <strong>${stats.totalSaved.toLocaleString()} tokens</strong> across ${stats.totalRequests} requests · Avg: ${stats.avgSaved} tokens/request</p>
    `;
  } catch (e) {}

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await fetch('/api/compression', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: btn.dataset.mode }),
      });
      toast(`Compression set to ${btn.dataset.mode}`);
    });
  });
}

// ─── Load Resilience ───
async function loadResilience() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const breakers = data.circuitBreakers || {};
    const container = document.getElementById('breaker-status');

    if (Object.keys(breakers).length === 0) {
      container.innerHTML = '<p class="muted">No circuit breaker events yet</p>';
      return;
    }

    container.innerHTML = Object.entries(breakers).map(([id, b]) => {
      const meta = PROVIDER_META[id] || {};
      const stateClass = b.state === 'closed' ? 'closed' : b.state === 'open' ? 'open' : 'half-open';
      return `<div class="breaker-row">
        <span>${meta.icon || '📡'} ${meta.name || id}</span>
        <span class="breaker-state ${stateClass}">${b.state}</span>
        <span class="muted">Failures: ${b.failures} · Cooldown: ${Math.ceil(b.cooldownRemaining / 1000)}s</span>
      </div>`;
    }).join('');
  } catch (e) {}
}

// ─── Load Logs ───
async function loadLogs() {
  try {
    const res = await fetch('/api/logs');
    const data = await res.json();
    document.getElementById('log-list').innerHTML = data.logs.map(l => {
      const meta = PROVIDER_META[l.provider] || {};
      const time = new Date(l.timestamp).toLocaleTimeString();
      return `<div class="log-row">
        <span>${time}</span>
        <span>${meta.icon || ''} ${l.provider}</span>
        <span>${l.model || '-'}</span>
        <span>${l.latency}ms</span>
        <span>${l.status === 'error' ? `<span style="color:var(--red)">${l.error || 'error'}</span>` : l.status}</span>
      </div>`;
    }).join('') || '<p class="muted">No logs yet</p>';
  } catch (e) {}
}

// ─── Settings ───
function loadSettings() {
  document.getElementById('set-endpoint').textContent = `http://localhost:${window.location.port}/v1`;
  document.getElementById('set-port').textContent = window.location.port;
}

function copyApiKey() {
  const text = document.getElementById('set-apikey')?.textContent;
  if (text) navigator.clipboard.writeText(text);
  toast('Copied');
}

function exportEnv() { window.open('/api/export', '_blank'); }

// ─── Utilities ───
function formatUptime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function toast(msg, isError = false) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  el.style.background = isError ? 'var(--red)' : 'var(--green)';
  document.body.appendChild(el);
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
  setTimeout(() => el.remove(), 2500);
}

// ─── Init ───
loadOverview();
loadProviders();
loadModels();
loadRouting();
loadCompression();
loadResilience();
loadSettings();

// Auto-refresh
setInterval(loadOverview, 5000);
setInterval(loadResilience, 10000);
