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

// Initialize default settings if they don't exist
ext_api.storage.sync.get('userSettings').then(data => {
  if (!data.userSettings) {
    // First time - set defaults with Medium redirect OFF
    const defaultSettings = {
      features: {
        mediumRedirect: false, // OFF by default - user must enable
        mediumRedirectTarget: 'freedium',
        ampRedirect: false,
        archiveRedirect: false,
        autoBypass: true
      },
      siteOverrides: {},
      preferredRegion: 'global',
      performance: {
        usageLearning: true,
        preloadCore: true
      }
    };

    ext_api.storage.sync.set({ userSettings: defaultSettings });
    console.log('[BPC v4.0] Default settings initialized (Medium redirect: OFF)');
  }

  // Setup Medium redirect for MV3 using declarativeNetRequest
  if (ext_manifest_version === 3) {
    setupMediumRedirect(data.userSettings || {});
  }
});

// Listen for settings changes and update redirect rules
if (ext_manifest_version === 3) {
  ext_api.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.userSettings) {
      setupMediumRedirect(changes.userSettings.newValue || {});
    }
  });
}

/**
 * Setup Medium redirect using declarativeNetRequest (MV3)
 */
async function setupMediumRedirect(settings) {
  const MEDIUM_RULE_ID = 90000; // High ID to avoid conflicts

  try {
    // Always remove existing rule first
    await ext_api.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [MEDIUM_RULE_ID]
    });

    // If redirect is enabled, add the rule
    if (settings.features?.mediumRedirect === true) {
      const target = settings.features?.mediumRedirectTarget || 'freedium';
      const redirectUrl = target === 'scribe' ? 'https://scribe.rip/' : 'https://freedium.cfd/';

      await ext_api.declarativeNetRequest.updateDynamicRules({
        addRules: [{
          id: MEDIUM_RULE_ID,
          priority: 100,
          action: {
            type: 'redirect',
            redirect: {
              regexSubstitution: redirectUrl + '\\0'
            }
          },
          condition: {
            regexFilter: '(https?://([^/]*\\.)?medium\\.com/.*|https?://([^/]*\\.)?towardsdatascience\\.com/.*|https?://([^/]*\\.)?betterprogramming\\.pub/.*)',
            resourceTypes: ['main_frame']
          }
        }]
      });

      console.log(`[BPC v4.0] Medium redirect enabled (target: ${target})`);
    } else {
      console.log('[BPC v4.0] Medium redirect disabled');
    }
  } catch (error) {
    console.error('[BPC] Failed to setup Medium redirect:', error);
  }
}

console.log('[BPC v4.0] Background initialization script loaded');
