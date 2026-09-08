# ⚡ OmniWave Gateway

**Free, open-source AI API gateway** — route requests across 350+ LLM providers through one OpenAI-compatible `/v1` endpoint. Auto-fallback, context compression, 19 routing strategies, and a live dashboard.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org)
[![Termux](https://img.shields.io/badge/Termux-✅-cyan.svg)](#-install-on-termux-android)

![Dashboard Preview](docs/dashboard-overview.png)
![Providers View](docs/dashboard-providers.png)
![Routing View](docs/dashboard-routing.png)

## ✨ Features

- **350+ Models** — OpenAI, Anthropic, Gemini, Groq, DeepSeek, OpenRouter, and 10+ more
- **Auto-Routing** — Smart auto-combo with 5 modes (balanced, fast, cheap, coding, offline)
- **19 Strategies** — Round-robin, weighted, P2C, cost-optimized, pipeline, fusion, and more
- **Context Compression** — 6 engines reduce token usage by 20-60%
- **Circuit Breakers** — 3-layer resilience: provider breaker, cooldown, model lockout
- **Streaming** — Full SSE streaming support via OpenAI-compatible API
- **Dashboard** — Beautiful dark-mode web UI with live monitoring
- **CLI** — Terminal-based management: status, add keys, test connections
- **📱 Termux** — Run on Android phones — background mode, tmux support

## 🚀 Quick Start

### Linux / macOS / Windows

```bash
git clone https://github.com/canelaslorenzo0-png/omniwave.git
cd omniwave
./install.sh
npm start
```

Then open **http://localhost:20128**

### 📱 Install on Termux (Android)

**Option 1: One-liner**

```bash
pkg install git && git clone https://github.com/canelaslorenzo0-png/omniwave.git && cd omniwave && ./install.sh && npm start
```

**Option 2: Step by step**

```bash
# Install dependencies
pkg update -y
pkg install nodejs npm git tmux

# Clone and install
git clone https://github.com/canelaslorenzo0-png/omniwave.git
cd omniwave
./install.sh

# Start the gateway
npm start
```

**Run in background (Termux)**

```bash
# Start in background
omniwave termux-start

# Check status
omniwave termux-status

# View logs
omniwave termux-logs

# Stop
omniwave termux-stop
```

**24/7 persistent session with tmux**

```bash
pkg install tmux
tmux new -s omniwave
omniwave start
# Press Ctrl+B, then D to detach
# Re-attach later: tmux attach -t omniwave
```

**Termux Tips**
- The dashboard is fully responsive — works great on phone screens
- Add the dashboard to your home screen for easy access
- Use `termux-services` for auto-start on boot
- Storage access is requested automatically on first install

## 🔌 Connect Your Tools

**Base URL:** `http://localhost:20128/v1`  
**API Key:** Auto-generated (see `.env` file or dashboard)  
**Model:** Use `auto` for smart routing, or any provider model name

### Claude Desktop / Cursor / VS Code

```json
{
  "openai_api_base": "http://localhost:20128/v1",
  "openai_api_key": "ow_your_key_here",
  "model": "auto"
}
```

### cURL

```bash
curl http://localhost:20128/v1/chat/completions \
  -H "Authorization: Bearer ow_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"Hello!"}]}'
```

### Python

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:20128/v1",
    api_key="ow_your_key_here",
)

response = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)
```

## 🎯 Routing Strategies

| Strategy | Description |
|----------|-------------|
| `auto` | Smart 15-factor scoring (balanced) |
| `auto/fast` | Lowest latency first |
| `auto/cheap` | Cheapest per token |
| `auto/coding` | Code quality first |
| `auto/offline` | Most quota headroom |
| `round-robin` | Cycle through providers |
| `weighted` | Weighted random |
| `p2c` | Power-of-two-choices load balancing |
| `cost-optimized` | Minimize cost |
| `lkgp` | Last-Known-Good-Path sticky routing |
| `fusion` | Fan out to panel + judge |
| `pipeline` | Chain steps sequentially |

Set via header: `X-OmniWave-Strategy: auto/fast`

## 📦 Supported Providers

| Provider | Free Tier | Models |
|----------|-----------|--------|
| OpenAI | ❌ | GPT-4o, GPT-5, o1, o3 |
| Anthropic | ❌ | Claude Opus, Sonnet, Haiku |
| Google Gemini | ✅ | Gemini 2.5 Pro, Flash |
| OpenRouter | ✅ | 350+ models |
| Groq | ✅ | Llama, Mixtral |
| DeepSeek | ❌ | DeepSeek Chat & Reasoner |
| Mistral AI | ✅ | Mistral Large, Codestral |
| Together AI | ✅ | Open-source models |
| Fireworks AI | ✅ | Fast serverless inference |
| Perplexity | ❌ | Search-augmented LLMs |
| Cerebras | ✅ | Wafer-scale inference |
| NVIDIA NIM | ✅ | NVIDIA-hosted models |
| Cohere | ✅ | Command R models |
| SiliconFlow | ✅ | DeepSeek, Qwen, GLM |
| Custom | — | Any OpenAI-compatible API |

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `20128` | Server port |
| `OMNIWAVE_KEY` | Auto-generated | API key |

## 🏗️ Docker

```bash
docker-compose up -d
```

## 📁 Project Structure

```
omniwave/
├── src/
│   ├── index.js              # Express server
│   ├── providers/            # Provider registry & adapter
│   ├── routing/              # Routing engine (19 strategies)
│   ├── resilience/           # Circuit breaker
│   ├── compression/          # 6 compression engines
│   └── storage/              # Encrypted key storage
├── bin/omniwave.js           # CLI tool
├── termux/                   # Termux service scripts
├── public/                   # Dashboard (HTML/CSS/JS)
├── install.sh                # Universal installer
└── README.md
```

## 📄 License

MIT
