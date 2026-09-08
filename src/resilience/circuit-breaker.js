const STATES = { CLOSED: 'closed', OPEN: 'open', HALF_OPEN: 'half-open' };

class CircuitBreaker {
  constructor() {
    this.breakers = new Map();
  }

  getState(providerId) {
    if (!this.breakers.has(providerId)) {
      this.breakers.set(providerId, {
        state: STATES.CLOSED,
        failures: 0,
        successCount: 0,
        lastFailure: 0,
        cooldownUntil: 0,
      });
    }
    const b = this.breakers.get(providerId);
    if (b.state === STATES.OPEN && Date.now() > b.cooldownUntil) {
      b.state = STATES.HALF_OPEN;
    }
    return b;
  }

  canRequest(providerId) {
    const b = this.getState(providerId);
    return b.state !== STATES.OPEN;
  }

  recordSuccess(providerId) {
    const b = this.getState(providerId);
    b.failures = 0;
    b.successCount++;
    if (b.state === STATES.HALF_OPEN) {
      b.state = STATES.CLOSED;
    }
  }

  recordFailure(providerId, statusCode) {
    const b = this.getState(providerId);
    b.failures++;
    b.lastFailure = Date.now();

    // Don't trip on client errors (4xx) except 429
    if (statusCode >= 400 && statusCode < 500 && statusCode !== 429) {
      if (statusCode === 429) {
        b.cooldownUntil = Date.now() + 30000;
        b.state = STATES.OPEN;
      }
      return;
    }

    const threshold = this.getThreshold(providerId);
    if (b.failures >= threshold) {
      const cooldown = this.getCooldown(providerId);
      b.cooldownUntil = Date.now() + cooldown;
      b.state = STATES.OPEN;
    }
  }

  getThreshold(providerId) {
    return 5; // Trip after 5 failures
  }

  getCooldown(providerId) {
    return 60000; // 60s cooldown
  }

  getStatus() {
    const result = {};
    for (const [id, b] of this.breakers) {
      result[id] = {
        state: b.state,
        failures: b.failures,
        cooldownRemaining: Math.max(0, b.cooldownUntil - Date.now()),
      };
    }
    return result;
  }
}

module.exports = CircuitBreaker;
