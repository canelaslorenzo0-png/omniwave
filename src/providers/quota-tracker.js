class QuotaTracker {
  constructor() {
    this.quotas = new Map();
    this.requestLog = new Map();
  }

  recordRequest(providerId, tokens = 0) {
    const current = this.quotas.get(providerId) || {
      totalRequests: 0,
      totalTokens: 0,
      requestsToday: 0,
      tokensToday: 0,
      lastReset: Date.now(),
    };

    current.totalRequests++;
    current.totalTokens += tokens;
    current.requestsToday++;
    current.tokensToday += tokens;

    // Reset daily counter every 24h
    if (Date.now() - current.lastReset > 86400000) {
      current.requestsToday = 0;
      current.tokensToday = 0;
      current.lastReset = Date.now();
    }

    this.quotas.set(providerId, current);
  }

  getUsage(providerId) {
    return this.quotas.get(providerId) || {
      totalRequests: 0, totalTokens: 0, requestsToday: 0, tokensToday: 0,
    };
  }

  getAllUsage() {
    const result = {};
    for (const [id, q] of this.quotas) {
      result[id] = q;
    }
    return result;
  }

  getUsagePercentage(providerId, dailyLimit = 10000) {
    const usage = this.getUsage(providerId);
    return Math.min(100, (usage.requestsToday / dailyLimit) * 100);
  }
}

module.exports = QuotaTracker;
