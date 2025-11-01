/**
 * UsageLearner - Tracks site visit frequency and auto-promotes frequently visited sites to core
 * Provides adaptive performance optimization based on actual usage patterns
 */
class UsageLearner {
  constructor(promotionThreshold = 5) {
    this.visitCounts = new Map();
    this.promotionThreshold = promotionThreshold;
    this.promotedSites = new Set();
    this.enabled = true;
  }

  /**
   * Initialize from stored data
   */
  async init() {
    try {
      let data = await ext_api.storage.local.get(['usageData', 'promotedSites']);

      if (data.usageData) {
        this.visitCounts = new Map(Object.entries(data.usageData));
      }

      if (data.promotedSites) {
        this.promotedSites = new Set(data.promotedSites);
      }

      console.log(`[BPC] Usage learner initialized: ${this.visitCounts.size} tracked sites, ${this.promotedSites.size} promoted`);
    } catch (e) {
      console.error('[BPC] Failed to load usage data:', e);
    }
  }

  /**
   * Track a site visit
   */
  async trackVisit(domain) {
    if (!this.enabled) return;

    let count = (this.visitCounts.get(domain) || 0) + 1;
    this.visitCounts.set(domain, count);

    // Check for promotion
    if (count >= this.promotionThreshold && !this.promotedSites.has(domain)) {
      await this.promoteToCore(domain);
    }

    // Persist periodically (every 10 visits to reduce storage writes)
    if (count % 10 === 0) {
      await this.persist();
    }
  }

  /**
   * Promote a domain to core (keep loaded in memory)
   */
  async promoteToCore(domain) {
    console.log(`[BPC] Promoting ${domain} to core (${this.visitCounts.get(domain)} visits)`);

    this.promotedSites.add(domain);

    // Store promoted status
    try {
      await ext_api.storage.local.set({
        promotedSites: Array.from(this.promotedSites)
      });
    } catch (e) {
      console.error('[BPC] Failed to save promoted sites:', e);
    }
  }

  /**
   * Check if a site is promoted
   */
  isPromoted(domain) {
    return this.promotedSites.has(domain);
  }

  /**
   * Get visit count for a domain
   */
  getVisitCount(domain) {
    return this.visitCounts.get(domain) || 0;
  }

  /**
   * Get top visited sites
   */
  getTopSites(limit = 20) {
    return Array.from(this.visitCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([domain, count]) => ({ domain, count }));
  }

  /**
   * Persist usage data to storage
   */
  async persist() {
    try {
      await ext_api.storage.local.set({
        usageData: Object.fromEntries(this.visitCounts),
        promotedSites: Array.from(this.promotedSites)
      });
    } catch (e) {
      console.error('[BPC] Failed to persist usage data:', e);
    }
  }

  /**
   * Enable/disable usage learning
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    console.log(`[BPC] Usage learning ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Reset all usage data
   */
  async reset() {
    this.visitCounts.clear();
    this.promotedSites.clear();

    try {
      await ext_api.storage.local.remove(['usageData', 'promotedSites']);
      console.log('[BPC] Usage data reset');
    } catch (e) {
      console.error('[BPC] Failed to reset usage data:', e);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    let totalVisits = Array.from(this.visitCounts.values()).reduce((a, b) => a + b, 0);

    return {
      trackedSites: this.visitCounts.size,
      promotedSites: this.promotedSites.size,
      totalVisits: totalVisits,
      avgVisitsPerSite: this.visitCounts.size > 0 ? (totalVisits / this.visitCounts.size).toFixed(2) : 0,
      promotionThreshold: this.promotionThreshold
    };
  }
}

// Global usage learner instance
if (typeof window !== 'undefined') {
  window.usageLearner = new UsageLearner();
} else if (typeof self !== 'undefined') {
  self.usageLearner = new UsageLearner();
}
