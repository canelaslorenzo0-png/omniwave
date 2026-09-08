const keystore = require('../storage/keystore');

const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o3-mini', 'gpt-5', 'gpt-5-mini'],
    freeTier: false,
  },
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    authHeader: 'x-api-key',
    authPrefix: '',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
    freeTier: false,
    customHeaders: { 'anthropic-version': '2023-06-01' },
    formatRequest: (body) => ({
      model: body.model,
      messages: body.messages,
      max_tokens: body.max_tokens || 4096,
      stream: body.stream,
      temperature: body.temperature,
    }),
  },
  gemini: {
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    authHeader: 'x-goog-api-key',
    authPrefix: '',
    models: ['gemini-2.0-flash', 'gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    freeTier: true,
    formatRequest: (body) => ({
      contents: body.messages?.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })) || [],
      generationConfig: {
        temperature: body.temperature,
        maxOutputTokens: body.max_tokens,
      },
    }),
  },
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    models: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-2.0-flash', 'meta-llama/llama-3.1-405b-instruct', 'mistralai/mixtral-8x22b-instruct', 'deepseek/deepseek-chat'],
    freeTier: true,
  },
  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    freeTier: true,
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    freeTier: false,
  },
  mistral: {
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'open-mixtral-8x22b', 'open-mixtral-8x7b', 'codestral-latest'],
    freeTier: true,
  },
  together: {
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    models: ['meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo', 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'mistralai/Mixtral-8x22B-Instruct-v0.1', 'deepseek-ai/DeepSeek-V3'],
    freeTier: true,
  },
  fireworks: {
    name: 'Fireworks AI',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    models: ['accounts/fireworks/models/llama-v3p1-405b-instruct', 'accounts/fireworks/models/mixtral-8x22b-instruct', 'accounts/fireworks/models/deepseek-v3'],
    freeTier: true,
  },
  perplexity: {
    name: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    models: ['llama-3.1-sonar-large-128k-online', 'llama-3.1-sonar-small-128k-online', 'llama-3.1-sonar-huge-128k-online'],
    freeTier: false,
  },
  cerebras: {
    name: 'Cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    models: ['llama3.3-70b', 'llama3.1-8b'],
    freeTier: true,
  },
  nvidia: {
    name: 'NVIDIA NIM',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    models: ['nvidia/llama-3.3-nemotron-super-49b-v1', 'nvidia/llama-3.1-nemotron-70b-instruct'],
    freeTier: true,
  },
  cohere: {
    name: 'Cohere',
    baseUrl: 'https://api.cohere.com/v2',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    models: ['command-r-plus', 'command-r', 'command-light'],
    freeTier: true,
  },
  siliconflow: {
    name: 'SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    models: ['deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct', 'THUDM/glm-4-9b-chat'],
    freeTier: true,
  },
  custom: {
    name: 'Custom Endpoint',
    baseUrl: null,
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
    models: [],
    freeTier: false,
  },
};

function getProvider(id) {
  return PROVIDERS[id] || null;
}

function listProviders() {
  return Object.entries(PROVIDERS).map(([id, p]) => ({
    id, name: p.name, models: p.models, freeTier: p.freeTier,
    connected: !!keystore.get(id),
  }));
}

function getConnectedProviders() {
  return Object.entries(PROVIDERS)
    .filter(([id]) => keystore.get(id))
    .map(([id, p]) => ({ id, ...p, credentials: keystore.get(id) }));
}

function getAllModels() {
  const connected = getConnectedProviders();
  const models = [];
  for (const p of connected) {
    for (const m of p.models) {
      models.push({ id: m, provider: p.id, providerName: p.name });
    }
  }
  return models;
}

module.exports = { PROVIDERS, getProvider, listProviders, getConnectedProviders, getAllModels };
