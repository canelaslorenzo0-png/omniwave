const https = require('https');
const http = require('http');
const { URL } = require('url');
const { PROVIDERS } = require('./registry');

class ProviderAdapter {
  constructor() {
    this.requestLog = [];
  }

  async chatCompletion(providerId, model, body, credentials) {
    const provider = PROVIDERS[providerId];
    if (!provider) throw new Error(`Unknown provider: ${providerId}`);

    const url = this.buildUrl(providerId, provider, model, credentials);
    const headers = this.buildHeaders(providerId, provider, credentials);
    const payload = this.formatPayload(providerId, provider, body);

    const startTime = Date.now();
    try {
      const response = await this.httpRequest(url, headers, payload, body.stream);
      const latency = Date.now() - startTime;

      this.requestLog.push({
        provider: providerId, model, latency, status: response.status,
        timestamp: Date.now(),
      });
      if (this.requestLog.length > 500) this.requestLog.shift();

      return response;
    } catch (err) {
      const latency = Date.now() - startTime;
      this.requestLog.push({
        provider: providerId, model, latency, status: 'error', error: err.message,
        timestamp: Date.now(),
      });
      throw err;
    }
  }

  buildUrl(providerId, provider, model, credentials) {
    if (providerId === 'gemini') {
      const method = 'streamGenerateContent';
      return `${provider.baseUrl}/models/${model}:${credentials?.stream ? method : 'generateContent'}`;
    }
    if (providerId === 'custom') {
      return credentials?.url || provider.baseUrl;
    }
    return `${provider.baseUrl}/chat/completions`;
  }

  buildHeaders(providerId, provider, credentials) {
    const headers = { 'Content-Type': 'application/json' };
    const key = credentials?.key || '';

    if (provider.authPrefix) {
      headers[provider.authHeader] = `${provider.authPrefix}${key}`;
    } else {
      headers[provider.authHeader] = key;
    }

    if (provider.customHeaders) {
      Object.assign(headers, provider.customHeaders);
    }

    if (providerId === 'openrouter') {
      headers['HTTP-Referer'] = 'https://omniwave.local';
      headers['X-Title'] = 'OmniWave Gateway';
    }

    return headers;
  }

  formatPayload(providerId, provider, body) {
    if (provider.formatRequest) {
      return JSON.stringify(provider.formatRequest(body));
    }
    // Default: OpenAI-compatible format
    return JSON.stringify({
      model: body.model,
      messages: body.messages,
      max_tokens: body.max_tokens,
      temperature: body.temperature,
      stream: body.stream,
      top_p: body.top_p,
      frequency_penalty: body.frequency_penalty,
      presence_penalty: body.presence_penalty,
      stop: body.stop,
    });
  }

  httpRequest(url, headers, body, stream = false) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const transport = parsed.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers,
        timeout: 60000,
      };

      const req = transport.request(options, (res) => {
        if (stream) {
          resolve({
            status: res.statusCode,
            stream: res,
            headers: res.headers,
          });
          return;
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, data: parsed, headers: res.headers });
          } catch {
            resolve({ status: res.statusCode, data, headers: res.headers });
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
      req.write(body);
      req.end();
    });
  }

  getRequestLog(limit = 50) {
    return this.requestLog.slice(-limit).reverse();
  }
}

module.exports = ProviderAdapter;
