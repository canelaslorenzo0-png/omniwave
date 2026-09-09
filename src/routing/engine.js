const { getConnectedProviders } = require('../providers/registry');
const keystore = require('../storage/keystore');

class RoutingEngine {
  constructor() {
    this.roundRobinIndex = new Map();
    this.lastGoodPath = new Map();
    this.quotaUsage = new Map();
    this.requestCounts = new Map();
    this.healthScores = new Map();
  }

  resolve(model, strategy = 'auto') {
    const connected = getConnectedProviders();
    if (connected.length === 0) throw new Error('No providers connected');

    // auto-combo: resolve to best provider
    if (strategy === 'auto' || model === 'auto') {
      return this.autoCombo(connected, 'balanced');
    }
    if (model === 'auto/fast') return this.autoCombo(connected, 'fast');
    if (model === 'auto/cheap') return this.autoCombo(connected, 'cheap');
    if (model === 'auto/coding') return this.autoCombo(connected, 'coding');
    if (model === 'auto/offline') return this.autoCombo(connected, 'offline');

    // Find which providers have this model
    const candidates = connected.filter(p => p.models.includes(model));
    if (candidates.length === 0) {
      // Fallback: try all providers
      return this.applyStrategy(connected, strategy);
    }
    return this.applyStrategy(candidates, strategy, model);
  }

  applyStrategy(candidates, strategy, model) {
    switch (strategy) {
      case 'priority': return this.priority(candidates);
      case 'fill-first': return this.fillFirst(candidates);
      case 'weighted': return this.weighted(candidates);
      case 'round-robin': return this.roundRobin(candidates);
      case 'p2c': return this.p2c(candidates);
      case 'least-used': return this.leastUsed(candidates);
      case 'random': return this.randomPick(candidates);
      case 'strict-random': return this.strictRandom(candidates);
      case 'cost-optimized': return this.costOptimized(candidates);
      case 'headroom': return this.headroom(candidates);
      case 'reset-window': return this.resetWindow(candidates);
      case 'reset-aware': return this.resetAware(candidates);
      case 'context-relay': return this.contextRelay(candidates);
      case 'context-optimized': return this.contextOptimized(candidates);
      case 'cache-optimized': return this.cacheOptimized(candidates);
      case 'lkgp': return this.lkgp(candidates);
      case 'fusion': return this.fusion(candidates);
      case 'pipeline': return this.pipeline(candidates);
      default: return this.autoCombo(candidates, 'balanced');
    }
  }

  autoCombo(providers, mode) {
    const scored = providers.map(p => {
      let score = 50;
      const health = this.healthScores.get(p.id) ?? 1;
      const usage = this.quotaUsage.get(p.id) ?? 0;
      const latency = this.requestCounts.get(p.id) ?? 0;

      score += health * 20;
      score -= usage * 0.5;
      score -= latency * 0.1;

      if (mode === 'fast') score += (100 - Math.min(latency / 10, 100));
      if (mode === 'cheap') score += p.freeTier ? 30 : 10;
      if (mode === 'coding') score += this.isCodingModel(p) ? 20 : 0;
      if (mode === 'offline') score += (100 - usage);

      // LKGP bonus
      if (this.lastGoodPath.get('auto') === p.id) score += 15;

      return { provider: p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].provider;
  }

  priority(providers) {
    return providers[0];
  }

  fillFirst(providers) {
    for (const p of providers) {
      const usage = this.quotaUsage.get(p.id) ?? 0;
      if (usage < 80) return p;
    }
    return providers[0];
  }

  weighted(providers) {
    const weights = providers.map((p, i) => (providers.length - i) * 10);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < providers.length; i++) {
      r -= weights[i];
      if (r <= 0) return providers[i];
    }
    return providers[providers.length - 1];
  }

  roundRobin(providers) {
    const key = providers.map(p => p.id).join(',');
    const idx = this.roundRobinIndex.get(key) ?? 0;
    const chosen = providers[idx % providers.length];
    this.roundRobinIndex.set(key, idx + 1);
    return chosen;
  }

  p2c(providers) {
    const a = providers[Math.floor(Math.random() * providers.length)];
    const b = providers[Math.floor(Math.random() * providers.length)];
    const scoreA = (this.healthScores.get(a.id) ?? 1) * 50 - (this.quotaUsage.get(a.id) ?? 0);
    const scoreB = (this.healthScores.get(b.id) ?? 1) * 50 - (this.quotaUsage.get(b.id) ?? 0);
    return scoreA >= scoreB ? a : b;
  }

  leastUsed(providers) {
    return providers.reduce((min, p) => {
      const usage = this.quotaUsage.get(p.id) ?? 0;
      const minUsage = this.quotaUsage.get(min.id) ?? 0;
      return usage < minUsage ? p : min;
    });
  }

  randomPick(providers) {
    return providers[Math.floor(Math.random() * providers.length)];
  }

  strictRandom(providers) {
    // True uniform random — every provider equally likely regardless of order
    const idx = Math.floor(Math.random() * providers.length);
    return providers[idx];
  }

  costOptimized(providers) {
    const free = providers.filter(p => {
      const creds = keystore.get(p.id);
      return creds?.freeTier || p.freeTier;
    });
    return free.length > 0 ? free[0] : providers[providers.length - 1];
  }

  headroom(providers) {
    return providers.reduce((best, p) => {
      const usage = this.quotaUsage.get(p.id) ?? 0;
      const bestUsage = this.quotaUsage.get(best.id) ?? 0;
      return usage < bestUsage ? p : best;
    });
  }

  resetWindow(providers) {
    // Prefer providers with free-tier quotas (which reset on their billing window),
    // falling back to the least-used provider.
    const free = providers.filter(p => {
      const creds = keystore.get(p.id);
      return p.freeTier || creds?.freeTier;
    });
    const pool = free.length > 0 ? free : providers;
    return pool.reduce((best, p) => {
      const usage = this.quotaUsage.get(p.id) ?? 0;
      const bestUsage = this.quotaUsage.get(best.id) ?? 0;
      return usage < bestUsage ? p : best;
    });
  }

  resetAware(providers) {
    // Picks the provider with the lowest usage *rate* (requests per quota), which
    // tends to be one most likely to have refilled since its last reset window.
    return providers.reduce((best, p) => {
      const usage = this.quotaUsage.get(p.id) ?? 0;
      const count = this.requestCounts.get(p.id) ?? 0;
      const rate = count > 0 ? usage / count : (usage > 0 ? 1 : 0);
      const bestUsage = this.quotaUsage.get(best.id) ?? 0;
      const bestCount = this.requestCounts.get(best.id) ?? 0;
      const bestRate = bestCount > 0 ? bestUsage / bestCount : (bestUsage > 0 ? 1 : 0);
      return rate < bestRate ? p : best;
    });
  }

  contextRelay(providers) {
    // Routes via the last-good-path for continuity (relay) when available.
    const lastId = this.lastGoodPath.get('context-relay');
    return lastId ? providers.find(p => p.id === lastId) || providers[0] : providers[0];
  }

  contextOptimized(providers) {
    // Prefer providers with long-context models (>= 128k in the model slug).
    const longContext = providers.filter(p =>
      p.models.some(m => /(128k|200k|1m|256k|1\.5m)/i.test(m))
    );
    return longContext.length > 0 ? longContext[0] : providers[providers.length - 1];
  }

  cacheOptimized(providers) {
    // Prefer providers with prompt-caching support.
    const cache = ['openai', 'anthropic', 'deepseek', 'openrouter', 'cerebras', 'nvidia', 'groq'];
    const cached = providers.filter(p => cache.includes(p.id));
    return cached.length > 0 ? cached[0] : providers[0];
  }

  lkgp(providers) {
    const lastId = this.lastGoodPath.get('lkgp');
    const last = providers.find(p => p.id === lastId);
    return last || providers[0];
  }

  fusion(providers) {
    return providers[0]; // Returns primary; fan-out handled at higher level
  }

  pipeline(providers) {
    // Pipeline: use provider with best health, bumping on failure.
    const healthy = providers.filter(p => (this.healthScores.get(p.id) ?? 1) > 0.3);
    const pool = healthy.length > 0 ? healthy : providers;
    return pool.reduce((best, p) => {
      const health = this.healthScores.get(p.id) ?? 1;
      const bestHealth = this.healthScores.get(best.id) ?? 1;
      return health > bestHealth ? p : best;
    });
  }

  isCodingModel(p) {
    const codingKeywords = ['code', 'codestral', 'gpt-4', 'claude', 'deepseek'];
    return p.models.some(m => codingKeywords.some(k => m.toLowerCase().includes(k)));
  }

  recordSuccess(providerId) {
    const prev = this.healthScores.get(providerId) ?? 1;
    this.healthScores.set(providerId, Math.min(prev + 0.1, 1));
    this.lastGoodPath.set('auto', providerId);
    this.lastGoodPath.set('lkgp', providerId);
  }

  recordFailure(providerId) {
    const prev = this.healthScores.get(providerId) ?? 1;
    this.healthScores.set(providerId, Math.max(prev - 0.3, 0));
  }

  incrementQuota(providerId) {
    this.quotaUsage.set(providerId, (this.quotaUsage.get(providerId) ?? 0) + 0.1);
  }
}

module.exports = RoutingEngine;
