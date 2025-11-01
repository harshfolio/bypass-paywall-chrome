/**
 * HeaderRuleEngine - Pre-computed header modification rules
 * Eliminates repeated array searches and string generation
 */
class HeaderRuleEngine {
  constructor() {
    this.rules = new Map(); // domain → pre-computed rule object
  }

  /**
   * Build all header modification rules from site configs
   */
  buildRules(siteIndexes, navigator_ua_mobile) {
    const userAgents = {
      'googlebot': navigator_ua_mobile ?
        "Chrome/115.0.5790.171 Mobile Safari/537.36 (compatible ; Googlebot/2.1 ; +http://www.google.com/bot.html)" :
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      'bingbot': navigator_ua_mobile ?
        "Chrome/115.0.5790.171 Mobile Safari/537.36 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)" :
        "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      'facebookbot': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
    };

    // Iterate through all indexed domains
    for (let domain of siteIndexes.indexedDomains) {
      let config = siteIndexes.getSiteConfig(domain);
      if (!config) continue;

      let rule = {};

      // User agent override
      if (config.useragent) {
        if (typeof config.useragent === 'string' && userAgents[config.useragent]) {
          rule.userAgent = userAgents[config.useragent];
        } else if (typeof config.useragent === 'object') {
          rule.userAgent = config.useragent;
        }
      }

      // Referer override
      if (config.referer) {
        rule.referer = config.referer;
      }

      // Random IP
      if (config.random_ip) {
        rule.randomIP = this.generateIPPool();
      }

      // Only store if there are rules
      if (Object.keys(rule).length > 0) {
        this.rules.set(domain, rule);
      }
    }

    console.log(`[BPC] Built header rules for ${this.rules.size} domains`);
  }

  /**
   * Generate a pool of random IPs
   */
  generateIPPool(poolSize = 10) {
    return Array.from({length: poolSize}, () =>
      Array.from({length: 4}, () =>
        Math.floor(Math.random() * 255)
      ).join('.')
    );
  }

  /**
   * Apply header modifications for a domain
   */
  applyHeaders(domain, headers) {
    let rule = this.rules.get(domain);
    if (!rule) return headers;

    let modified = [...headers];
    let modified = false;

    // Remove existing headers that we'll override
    modified = modified.filter(header => {
      let name = header.name.toLowerCase();
      if (rule.userAgent && name === 'user-agent') return false;
      if (rule.referer && name === 'referer') return false;
      if (rule.randomIP && name === 'x-forwarded-for') return false;
      return true;
    });

    // Add our headers
    if (rule.userAgent) {
      modified.push({
        name: 'User-Agent',
        value: rule.userAgent
      });
    }

    if (rule.referer) {
      modified.push({
        name: 'Referer',
        value: rule.referer
      });
    }

    if (rule.randomIP) {
      // Rotate through pre-generated IPs
      let ip = rule.randomIP[Date.now() % rule.randomIP.length];
      modified.push({
        name: 'X-Forwarded-For',
        value: ip
      });
    }

    return modified;
  }

  /**
   * Check if domain has header rules
   */
  hasRules(domain) {
    return this.rules.has(domain);
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      totalRules: this.rules.size
    };
  }

  /**
   * Clear all rules
   */
  clear() {
    this.rules.clear();
  }
}

// Global header engine instance
if (typeof window !== 'undefined') {
  window.headerEngine = new HeaderRuleEngine();
} else if (typeof self !== 'undefined') {
  self.headerEngine = new HeaderRuleEngine();
}
