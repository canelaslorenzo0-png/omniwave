class CompressionEngine {
  constructor() {
    this.mode = 'standard'; // off, lite, standard, aggressive, ultra
    this.stats = { totalSaved: 0, totalRequests: 0 };
  }

  setMode(mode) {
    if (['off', 'lite', 'standard', 'aggressive', 'ultra'].includes(mode)) {
      this.mode = mode;
    }
  }

  compress(messages, contextWindow = 128000) {
    if (this.mode === 'off') return { messages, saved: 0 };

    let compressed = JSON.parse(JSON.stringify(messages));
    let originalTokens = this.estimateTokens(compressed);
    let saved = 0;

    // Engine 1: Strip redundant system messages
    if (this.mode !== 'off') {
      compressed = this.deduplicateSystem(compressed);
    }

    // Engine 2: Truncate long tool outputs (Caveman)
    if (['standard', 'aggressive', 'ultra'].includes(this.mode)) {
      compressed = this.cavemanCompress(compressed);
    }

    // Engine 3: Remove filler patterns
    if (['aggressive', 'ultra'].includes(this.mode)) {
      compressed = this.removeFiller(compressed);
    }

    // Engine 4: Condense whitespace
    compressed = this.condenseWhitespace(compressed);

    // Engine 5: Merge consecutive same-role messages
    compressed = this.mergeConsecutive(compressed);

    // Engine 6: Truncate old context if over budget
    if (['aggressive', 'ultra'].includes(this.mode)) {
      compressed = this.truncateToFit(compressed, contextWindow);
    }

    let compressedTokens = this.estimateTokens(compressed);
    saved = originalTokens - compressedTokens;

    this.stats.totalRequests++;
    this.stats.totalSaved += saved;

    return { messages: compressed, saved, mode: this.mode };
  }

  deduplicateSystem(messages) {
    const seen = new Set();
    return messages.filter(m => {
      if (m.role === 'system') {
        const key = m.content?.substring(0, 100);
        if (seen.has(key)) return false;
        seen.add(key);
      }
      return true;
    });
  }

  cavemanCompress(messages) {
    return messages.map(m => {
      if (m.role !== 'user' || !m.content) return m;
      // Truncate very long tool-result blocks
      if (typeof m.content === 'string' && m.content.length > 5000) {
        return { ...m, content: m.content.substring(0, 3000) + '\n...[truncated]...' };
      }
      if (Array.isArray(m.content)) {
        return {
          ...m,
          content: m.content.map(part => {
            if (part.type === 'text' && part.text?.length > 5000) {
              return { ...part, text: part.text.substring(0, 3000) + '\n...[truncated]...' };
            }
            return part;
          }),
        };
      }
      return m;
    });
  }

  removeFiller(messages) {
    const fillerPatterns = [
      /\b(um|uh|like|you know|basically|actually|just|really|very)\b/gi,
      /\s{2,}/g,
    ];
    return messages.map(m => {
      if (m.role === 'system') return m;
      let content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      for (const pattern of fillerPatterns) {
        content = content.replace(pattern, '');
      }
      return { ...m, content };
    });
  }

  condenseWhitespace(messages) {
    return messages.map(m => {
      if (typeof m.content === 'string') {
        return { ...m, content: m.content.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() };
      }
      return m;
    });
  }

  mergeConsecutive(messages) {
    const result = [];
    for (const m of messages) {
      const last = result[result.length - 1];
      if (last && last.role === m.role && typeof last.content === 'string' && typeof m.content === 'string') {
        last.content += '\n\n' + m.content;
      } else {
        result.push({ ...m });
      }
    }
    return result;
  }

  truncateToFit(messages, contextWindow) {
    const reserve = Math.floor(contextWindow * 0.25);
    let total = this.estimateTokens(messages);
    while (total > contextWindow - reserve && messages.length > 2) {
      // Remove oldest non-system message
      const idx = messages.findIndex(m => m.role !== 'system' && m.role !== m[0]?.role);
      if (idx > 0) {
        messages.splice(idx, 1);
        total = this.estimateTokens(messages);
      } else break;
    }
    return messages;
  }

  estimateTokens(messages) {
    let chars = 0;
    for (const m of messages) {
      chars += typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content || '').length;
    }
    return Math.ceil(chars / 4);
  }

  getStats() {
    return {
      ...this.stats,
      avgSaved: this.stats.totalRequests > 0 ? Math.round(this.stats.totalSaved / this.stats.totalRequests) : 0,
    };
  }
}

module.exports = CompressionEngine;
