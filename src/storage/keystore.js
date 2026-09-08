const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const KEYS_FILE = path.join(DATA_DIR, 'keys.enc');
const SALT_FILE = path.join(DATA_DIR, '.salt');
const ALGO = 'aes-256-gcm';

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getKey() {
  ensureDir();
  if (!fs.existsSync(SALT_FILE)) {
    fs.writeFileSync(SALT_FILE, crypto.randomBytes(32).toString('hex'), 'utf8');
  }
  return crypto.scryptSync(fs.readFileSync(SALT_FILE, 'utf8').trim(), 'omniwave-keys', 32);
}

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  let enc = cipher.update(text, 'utf8', 'hex');
  enc += cipher.final('hex');
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc}`;
}

function decrypt(payload) {
  const [ivHex, tagHex, data] = payload.split(':');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let dec = decipher.update(data, 'hex', 'utf8');
  dec += decipher.final('utf8');
  return dec;
}

function loadAll() {
  ensureDir();
  if (!fs.existsSync(KEYS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(KEYS_FILE, 'utf8')); } catch { return {}; }
}

function saveAll(store) {
  ensureDir();
  fs.writeFileSync(KEYS_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function set(provider, apiKey, extra = {}) {
  const store = loadAll();
  store[provider] = { key: encrypt(apiKey), ...extra, updatedAt: Date.now() };
  saveAll(store);
}

function get(provider) {
  const store = loadAll();
  const entry = store[provider];
  if (!entry) return null;
  try { return { ...entry, key: decrypt(entry.key) }; } catch { return null; }
}

function remove(provider) {
  const store = loadAll();
  delete store[provider];
  saveAll(store);
}

function list() {
  const store = loadAll();
  return Object.entries(store).map(([provider, entry]) => {
    let preview = '';
    try {
      const k = decrypt(entry.key);
      preview = `${k.substring(0, 8)}...${k.substring(k.length - 4)}`;
    } catch { preview = '???'; }
    return { provider, preview, url: entry.url || null, updatedAt: entry.updatedAt };
  });
}

module.exports = { set, get, remove, list, loadAll };
