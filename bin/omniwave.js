#!/usr/bin/env node
const http = require('http');
const readline = require('readline');
const { execSync } = require('child_process');
const path = require('path');

const BASE_URL = process.env.OMNIWAVE_URL || 'http://localhost:20128';
const args = process.argv.slice(2);
const cmd = args[0];

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

function print(text) { console.log(text); }
function printHeader(text) { print(`\n  ⚡ ${text}\n`); }
function printErr(text) { console.error(`  ✗ ${text}`); }
function printOk(text) { console.log(`  ✓ ${text}`); }

function apiRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname, port: url.port, path: url.pathname,
      method, headers: { 'Content-Type': 'application/json' },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function showStatus() {
  printHeader('OmniWave Gateway Status');
  try {
    const status = await apiRequest('/api/status');
    print(`  Version:   v${status.version}`);
    print(`  Uptime:    ${status.uptime}s`);
    print(`  API Key:   ${status.apiKey}`);
    print(`  Requests:  ${status.stats.totalRequests}`);
    print(`  Tokens:    ${status.stats.totalTokens}`);
    print(`  Providers: ${status.providers.filter(p => p.connected).length}/${status.providers.length}`);
    print(`  Compression: ${status.compression.mode} (${status.compression.totalSaved} tokens saved)`);
    print('');
    print('  Connected providers:');
    for (const p of status.providers) {
      if (p.connected) print(`    ✓ ${p.name}`);
    }
  } catch (e) {
    printErr(`Gateway not running at ${BASE_URL}`);
    print('  Start with: omniwave start');
  }
}

async function showProviders() {
  printHeader('Providers');
  try {
    const data = await apiRequest('/api/providers');
    for (const p of data.providers) {
      const status = p.connected ? '✓ Connected' : '○ Not connected';
      const free = p.freeTier ? ' [Free]' : '';
      print(`  ${p.connected ? '●' : '○'} ${p.name}${free} — ${status}`);
      print(`    Models: ${p.models.slice(0, 5).join(', ')}${p.models.length > 5 ? ` (+${p.models.length - 5})` : ''}`);
    }
  } catch (e) {
    printErr('Failed to load providers');
  }
}

async function addKey() {
  printHeader('Add API Key');
  const providers = ['openai', 'anthropic', 'gemini', 'openrouter', 'groq', 'deepseek', 'mistral', 'together', 'fireworks', 'perplexity', 'cerebras', 'nvidia', 'cohere', 'siliconflow', 'custom'];
  print('  Available providers:');
  providers.forEach((p, i) => print(`    ${i + 1}. ${p}`));
  const idx = parseInt(await ask('\n  Provider #: ')) - 1;
  const provider = providers[idx];
  if (!provider) { printErr('Invalid selection'); return; }

  const key = await ask(`  API Key for ${provider}: `);
  if (!key.trim()) { printErr('No key provided'); return; }

  let url = null;
  if (provider === 'custom') {
    url = await ask('  Custom endpoint URL: ');
  }

  try {
    await apiRequest(`/api/keys/${provider}`, 'PUT', { key: key.trim(), url });
    printOk(`${provider} key saved`);
  } catch (e) {
    printErr(`Failed to save: ${e.message}`);
  }
}

async function showModels() {
  printHeader('Available Models');
  try {
    const data = await apiRequest('/api/models');
    print('  Auto-routing models:');
    print('    • auto          — Smart balanced routing');
    print('    • auto/fast     — Lowest latency');
    print('    • auto/cheap    — Cheapest per token');
    print('    • auto/coding   — Code quality first');
    print('');
    print('  Provider models:');
    let currentProvider = '';
    for (const m of data.models) {
      if (m.provider !== currentProvider) {
        currentProvider = m.provider;
        print(`\n    [${m.providerName}]`);
      }
      print(`      ${m.id}`);
    }
  } catch (e) {
    printErr('Failed to load models');
  }
}

async function testConnection() {
  printHeader('Test Connection');
  try {
    const status = await apiRequest('/api/status');
    printOk(`Gateway is running at ${BASE_URL}`);
    print(`  Key: ${status.apiKey}`);
  } catch (e) {
    printErr(`Cannot connect to ${BASE_URL}`);
    print('  Make sure the gateway is running: omniwave start');
  }
}

function termuxCommand(action) {
  const scriptDir = path.join(__dirname, '..', 'termux');
  const script = path.join(scriptDir, `${action}.sh`);
  try {
    execSync(`bash "${script}"`, { stdio: 'inherit', cwd: scriptDir });
  } catch (e) {
    printErr(`Termux ${action} failed`);
  }
}

async function showHelp() {
  printHeader('OmniWave CLI');
  print('  Commands:');
  print('    omniwave status          Show gateway status');
  print('    omniwave providers       List providers');
  print('    omniwave add             Add an API key');
  print('    omniwave models          List available models');
  print('    omniwave test            Test gateway connection');
  print('    omniwave start           Start the gateway');
  print('');
  print('  Termux Commands:');
  print('    omniwave termux-start    Start in background');
  print('    omniwave termux-stop     Stop background process');
  print('    omniwave termux-status   Check running status');
  print('    omniwave termux-logs     View recent logs');
  print('    omniwave termux-install  Install Termux deps');
  print('');
  print('  Environment:');
  print(`    OMNIWAVE_URL=${BASE_URL}`);
  print(`    PORT=20128`);
  print('');
  print('  Dashboard: http://localhost:20128');
}

async function main() {
  switch (cmd) {
    case 'status': await showStatus(); break;
    case 'providers': await showProviders(); break;
    case 'add': await addKey(); break;
    case 'models': await showModels(); break;
    case 'test': await testConnection(); break;
    case 'start': {
      const serverPath = path.join(__dirname, '..', 'src', 'index.js');
      try { execSync(`node ${serverPath}`, { stdio: 'inherit' }); }
      catch (e) { printErr(`Failed to start: ${e.message}`); }
      break;
    }
    case 'termux-start': termuxCommand('start'); break;
    case 'termux-stop': termuxCommand('stop'); break;
    case 'termux-status': termuxCommand('status'); break;
    case 'termux-logs': termuxCommand('logs'); break;
    case 'termux-install': termuxCommand('install-deps'); break;
    case 'help': case '--help': case '-h': default: await showHelp(); break;
  }
  rl.close();
}

main().catch(e => { printErr(e.message); rl.close(); });
