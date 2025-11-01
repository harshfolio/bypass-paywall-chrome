/**
 * SiteIndexes - High-performance indexed data structures for site configs
 * Provides O(1) lookups instead of O(n) array searches
 */
class SiteIndexes {
  constructor() {
    // Core indexes
    this.domainMap = new Map();           // domain → config
    this.groupMap = new Map();             // domain → group name
    this.groupConfigs = new Map();         // group name → shared config

    // Feature-specific indexes
    this.botUserAgents = new Map();        // domain → 'googlebot'|'bingbot'|etc
    this.cookieRules = new Map();          // domain → cookie handling rules
    this.blockRules = new Map();           // domain → compiled regex array
    this.restrictionMap = new Map();       // domain → compiled restriction regex

    // Tracking
    this.totalSites = 0;
    this.indexedDomains = new Set();
  }

  /**
   * Build all indexes from site configurations
   */
  buildIndexes(siteConfigs) {
    const startTime = performance.now();

    for (let [siteName, config] of Object.entries(siteConfigs)) {
      // Skip metadata entries
      if (config.domain && config.domain.startsWith('#')) {
        continue;
      }

      // Handle grouped domains
      if (config.group && Array.isArray(config.group)) {
        for (let domain of config.group) {
          this.groupMap.set(domain, siteName);
          this.indexedDomains.add(domain);
        }
        this.groupConfigs.set(siteName, config);
        this.totalSites += config.group.length;
      }
      // Direct domain mapping
      else if (config.domain) {
        this.domainMap.set(config.domain, config);
        this.indexedDomains.add(config.domain);
        this.totalSites++;
      }

      // Index features for fast lookup
      this.indexFeatures(config);
    }

    const buildTime = performance.now() - startTime;
    if (typeof perfMonitor !== 'undefined') {
      perfMonitor.recordIndexBuild(buildTime);
    }

    console.log(`[BPC] Indexed ${this.totalSites} sites in ${buildTime.toFixed(2)}ms`);
  }

  /**
   * Index individual config features
   */
  indexFeatures(config) {
    if (!config.domain) return;

    let domains = config.group || [config.domain];

    for (let domain of domains) {
      // User agent override
      if (config.useragent) {
        this.botUserAgents.set(domain, config.useragent);
      }

      // Cookie rules
      if (config.allow_cookies) {
        this.cookieRules.set(domain, { type: 'allow' });
      } else if (config.remove_cookies) {
        this.cookieRules.set(domain, { type: 'remove' });
      }

      if (config.remove_cookies_select_hold) {
        let existing = this.cookieRules.get(domain) || {};
        existing.selectHold = config.remove_cookies_select_hold;
        this.cookieRules.set(domain, existing);
      }

      if (config.remove_cookies_select_drop) {
        let existing = this.cookieRules.get(domain) || {};
        existing.selectDrop = config.remove_cookies_select_drop;
        this.cookieRules.set(domain, existing);
      }

      // Block regex - pre-compile
      if (config.block_regex && typeof regexCache !== 'undefined') {
        let compiled = regexCache.compile(config.block_regex);
        if (compiled) {
          let existing = this.blockRules.get(domain) || [];
          existing.push(compiled);
          this.blockRules.set(domain, existing);
        }
      }
    }
  }

  /**
   * Get site config for a domain (handles both direct and grouped)
   */
  getSiteConfig(domain) {
    // Direct lookup
    if (this.domainMap.has(domain)) {
      return this.domainMap.get(domain);
    }

    // Grouped lookup
    if (this.groupMap.has(domain)) {
      let groupName = this.groupMap.get(domain);
      return this.groupConfigs.get(groupName);
    }

    return null;
  }

  /**
   * Check if domain is indexed
   */
  hasDomain(domain) {
    return this.indexedDomains.has(domain);
  }

  /**
   * Get user agent for domain
   */
  getUserAgent(domain) {
    return this.botUserAgents.get(domain);
  }

  /**
   * Get cookie rules for domain
   */
  getCookieRules(domain) {
    return this.cookieRules.get(domain);
  }

  /**
   * Get block rules for domain
   */
  getBlockRules(domain) {
    return this.blockRules.get(domain) || [];
  }

  /**
   * Check if URL should be blocked
   */
  shouldBlockRequest(domain, url) {
    let rules = this.getBlockRules(domain);
    if (!rules || rules.length === 0) return false;

    for (let pattern of rules) {
      if (typeof regexCache !== 'undefined') {
        if (regexCache.test(pattern, url)) {
          return true;
        }
      } else if (pattern.test(url)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get index statistics
   */
  getStats() {
    return {
      totalSites: this.totalSites,
      directDomains: this.domainMap.size,
      groupedDomains: this.groupMap.size,
      groups: this.groupConfigs.size,
      botUserAgents: this.botUserAgents.size,
      cookieRules: this.cookieRules.size,
      blockRules: this.blockRules.size
    };
  }

  /**
   * Clear all indexes
   */
  clear() {
    this.domainMap.clear();
    this.groupMap.clear();
    this.groupConfigs.clear();
    this.botUserAgents.clear();
    this.cookieRules.clear();
    this.blockRules.clear();
    this.restrictionMap.clear();
    this.indexedDomains.clear();
    this.totalSites = 0;
  }
}

// Global site indexes instance
if (typeof window !== 'undefined') {
  window.siteIndexes = new SiteIndexes();
} else if (typeof self !== 'undefined') {
  self.siteIndexes = new SiteIndexes();
}
