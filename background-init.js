/**
 * Background Initialization for Bypass Paywalls Clean v4.0
 * Loads and initializes all performance optimization modules
 */

'use strict';

// Import all optimization modules
self.importScripts(
  'lib/performance-monitor.js',
  'lib/regex-cache.js',
  'lib/site-indexes.js',
  'lib/header-engine.js',
  'lib/chunk-loader.js',
  'lib/usage-learner.js',
  'lib/user-settings.js',
  'lib/migration.js'
);

// Global initialization flag
var bpcInitialized = false;
var bpcInitializing = false;

/**
 * Initialize all BPC v4.0 optimization systems
 * NOTE: sites.js is already loaded by background.js before this runs
 */
function initializeBPC() {
  if (bpcInitialized || bpcInitializing) return;
  bpcInitializing = true;

  const overallStart = performance.now();
  console.log('[BPC v4.0] Starting initialization...');

  try {
    // sites.js is already loaded by background.js - just build indexes

    // Step 1: Build indexes from already-loaded sites
    const indexStart = performance.now();
    siteIndexes.buildIndexes(defaultSites);
    console.log(`[BPC] Indexes built in ${(performance.now() - indexStart).toFixed(2)}ms`);

    // Step 2: Build header modification rules
    const headerStart = performance.now();
    headerEngine.buildRules(siteIndexes, navigator_ua_mobile);
    console.log(`[BPC] Header rules built in ${(performance.now() - headerStart).toFixed(2)}ms`);

    // Step 3: Initialize chunk loader (for future lazy loading)
    // TODO: Initialize with chunk manifest when sites are split
    // chunkLoader.init(chunkManifest);

    // Record total startup time
    const totalTime = performance.now() - overallStart;
    perfMonitor.recordStartup(totalTime);

    bpcInitialized = true;
    bpcInitializing = false;

    console.log(`[BPC v4.0] ✓ Initialization complete in ${totalTime.toFixed(2)}ms`);
    console.log('[BPC v4.0] Stats:', {
      sites: siteIndexes.getStats(),
      headers: headerEngine.getStats()
    });

    return true;

  } catch (error) {
    console.error('[BPC v4.0] Initialization failed:', error);
    bpcInitializing = false;
    throw error;
  }
}

// determineCoreSites function removed - not needed in synchronous init

/**
 * Handle message passing for cache clearing and other commands
 */
ext_api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'clearCache') {
    // Clear all performance caches
    regexCache.clearAll();
    console.log('[BPC] Performance caches cleared');
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'getPerformanceStats') {
    perfMonitor.exportMetrics().then(metrics => {
      sendResponse(metrics);
    });
    return true;
  }

  if (message.action === 'resetUsageData') {
    usageLearner.reset().then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

/**
 * Optimized domain extraction
 */
function extractDomain(url) {
  try {
    let hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch (e) {
    return '';
  }
}

/**
 * Check if site config exists (O(1) lookup)
 */
function hasSiteConfig(domain) {
  return siteIndexes.hasDomain(domain);
}

/**
 * Get site config (O(1) lookup)
 */
function getSiteConfig(domain) {
  return siteIndexes.getSiteConfig(domain);
}

/**
 * Check if request should be blocked (with caching)
 */
function shouldBlockRequest(domain, url) {
  return siteIndexes.shouldBlockRequest(domain, url);
}

/**
 * Apply header modifications (pre-computed rules)
 */
function applyHeaderModifications(domain, headers) {
  return headerEngine.applyHeaders(domain, headers);
}

/**
 * Track site visit for usage learning
 */
async function trackSiteVisit(domain) {
  if (userSettings.get('performance.usageLearning')) {
    await usageLearner.trackVisit(domain);
  }
}

// Initialize on extension load (synchronous)
initializeBPC();

console.log('[BPC v4.0] Background initialization script loaded');
