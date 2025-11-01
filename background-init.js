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
 */
async function initializeBPC() {
  if (bpcInitialized || bpcInitializing) return;
  bpcInitializing = true;

  const overallStart = performance.now();
  console.log('[BPC v4.0] Starting initialization...');

  try {
    // Step 1: Check and run migration if needed
    await migration.checkAndMigrate();

    // Step 2: Initialize user settings
    await userSettings.init();

    // Step 3: Initialize usage learner
    await usageLearner.init();

    // Step 4: Determine which sites to load in core
    const coreStites = await determineCoreSites();

    // Step 5: Load core site configurations
    const coreStart = performance.now();
    self.importScripts('sites.js'); // Load default sites temporarily
    console.log(`[BPC] Core sites loaded in ${(performance.now() - coreStart).toFixed(2)}ms`);

    // Step 6: Build indexes from core sites
    const indexStart = performance.now();
    siteIndexes.buildIndexes(defaultSites);
    console.log(`[BPC] Indexes built in ${(performance.now() - indexStart).toFixed(2)}ms`);

    // Step 7: Build header modification rules
    const headerStart = performance.now();
    headerEngine.buildRules(siteIndexes, navigator_ua_mobile);
    console.log(`[BPC] Header rules built in ${(performance.now() - headerStart).toFixed(2)}ms`);

    // Step 8: Initialize chunk loader (for future lazy loading)
    // TODO: Initialize with chunk manifest when sites are split
    // await chunkLoader.init(chunkManifest);

    // Record total startup time
    const totalTime = performance.now() - overallStart;
    perfMonitor.recordStartup(totalTime);

    bpcInitialized = true;
    bpcInitializing = false;

    console.log(`[BPC v4.0] ✓ Initialization complete in ${totalTime.toFixed(2)}ms`);
    console.log('[BPC v4.0] Stats:', {
      sites: siteIndexes.getStats(),
      headers: headerEngine.getStats(),
      usage: usageLearner.getStats()
    });

    return true;

  } catch (error) {
    console.error('[BPC v4.0] Initialization failed:', error);
    bpcInitializing = false;
    throw error;
  }
}

/**
 * Determine which sites should be in core based on region and usage
 */
async function determineCoreSites() {
  const region = userSettings.get('preferredRegion') || 'global';
  console.log(`[BPC] Region: ${region}`);

  // TODO: When sites are split into chunks, load regional core here
  // For now, we load all sites (backward compatible)

  return [];
}

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

// Initialize on extension load
initializeBPC().catch(error => {
  console.error('[BPC v4.0] Critical initialization error:', error);
});

console.log('[BPC v4.0] Background initialization script loaded');
