# Bypass Paywalls Clean - Performance Optimization Design

**Date:** 2025-01-11
**Version:** 4.0.0
**Status:** Approved for Implementation

## Executive Summary

This document outlines a comprehensive performance optimization strategy for the Bypass Paywalls Clean extension. The current implementation suffers from high memory usage, slow startup times, page load delays, and general browser lag due to inefficient data structures and loading strategies.

**Key Objectives:**
- Minimize browser impact (startup, memory, page loads, responsiveness)
- Maintain full site coverage (900+ domains)
- Preserve bypass effectiveness (no functionality reduction)
- Add user controls for feature toggles (Medium redirect, AMP, etc.)

**Expected Improvements:**
- Startup time: 500ms → <100ms (80% faster)
- Memory usage: 150MB → <50MB (67% reduction)
- Page load impact: 200ms → <50ms (75% faster)
- Cache hit rate: Target >80%

## Current Architecture Problems

### Problem 1: Monolithic Loading
- 96KB `sites.js` file loaded synchronously on startup
- All 900+ site configurations initialized immediately
- Blocks extension startup and browser initialization

### Problem 2: Inefficient Data Structures
- Flat arrays for domain lookups (O(n) searches)
- No indexing or hash maps
- Linear searches through 900+ entries for every request

### Problem 3: Repeated Computation
- Regex patterns re-compiled on every match attempt
- Header modifications computed per-request
- No caching of computed results

### Problem 4: Indiscriminate Content Script Injection
- Content scripts injected on ALL pages
- Massive config payloads sent to every tab
- DOMPurify loaded even when not needed

### Problem 5: No User Controls
- Features like Medium redirect are hardcoded
- No per-site enable/disable
- No performance settings exposed

## Solution Architecture: Indexed + Cached System

### 3-Layer Architecture

```
┌─────────────────────────────────────────────────┐
│           Layer 1: Index Layer                  │
│  - Hash maps for O(1) domain lookups            │
│  - Pre-compiled regex cache                     │
│  - Feature-specific indexes                     │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│      Layer 2: Lazy Loading Layer                │
│  - Core sites (regional + global)               │
│  - Site chunks (by region/category)             │
│  - Usage-based learning                         │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│         Layer 3: Caching Layer                  │
│  - Compiled regex results                       │
│  - Domain match results (LRU)                   │
│  - Pre-computed header rules                    │
└─────────────────────────────────────────────────┘
```

## Detailed Component Design

### 1. Index Layer - Data Structures

**Core Indexes:**

```javascript
const siteIndexes = {
  // Direct domain → config mapping
  domainMap: new Map(),           // O(1) lookup vs O(n) array search

  // Grouped domains (e.g., USA Gannett sites)
  groupMap: new Map(),             // domain → group name
  groupConfigs: new Map(),         // group name → shared config

  // Feature-specific indexes
  botUserAgents: new Map(),        // domain → 'googlebot'|'bingbot'
  cookieRules: new Map(),          // domain → cookie handling rules
  blockRules: new Map(),           // domain → compiled regex array

  // Cached patterns
  regexCache: new Map(),           // pattern string → RegExp object
  restrictionMap: new Map()        // domain → compiled restriction regex
};
```

**Build Process (one-time on startup):**

```javascript
function buildSiteIndexes(siteConfigs) {
  const startTime = performance.now();

  for (let [siteName, config] of Object.entries(siteConfigs)) {
    // Handle grouped domains
    if (config.group) {
      for (let domain of config.group) {
        siteIndexes.groupMap.set(domain, siteName);
      }
      siteIndexes.groupConfigs.set(siteName, config);
    }
    // Direct domain mapping
    else if (config.domain && !config.domain.startsWith('#')) {
      siteIndexes.domainMap.set(config.domain, config);
    }

    // Feature indexes
    if (config.useragent) {
      siteIndexes.botUserAgents.set(config.domain, config.useragent);
    }
    if (config.block_regex) {
      let compiled = regexCache.compile(config.block_regex);
      siteIndexes.blockRules.set(config.domain, compiled);
    }
  }

  perfMonitor.recordStartup(performance.now() - startTime);
}
```

**Performance Impact:**
- Domain lookup: O(n) → O(1) = ~900x faster
- Memory: ~2-3MB for indexes (one-time cost)
- Build time: ~10-20ms on startup

### 2. Lazy Loading Layer - Smart Chunking

**Regional Core Sites Strategy:**

```javascript
const coreSitesByRegion = {
  'global': [
    'reuters.com', 'bloomberg.com', 'economist.com', // Universal sites
  ],
  'india': [
    'economictimes.com', 'timesofindia.indiatimes.com',
    'hindustantimes.com', 'thehindu.com', 'indianexpress.com',
    'livemint.com', 'business-standard.com', 'ndtvprofit.com',
    // ... ~30-40 top Indian publications
  ],
  'usa': [
    'nytimes.com', 'wsj.com', 'washingtonpost.com', 'latimes.com',
    // ... ~30-40 top US publications
  ],
  'europe': [
    'ft.com', 'theguardian.com', 'telegraph.co.uk', 'lemonde.fr',
    // ... ~30-40 top European publications
  ]
};

async function getRegionalCoreSites() {
  // Auto-detect from browser locale
  let locale = chrome.i18n.getUILanguage(); // e.g., 'en-IN'
  let region = locale.split('-')[1]?.toLowerCase() || 'global';

  // User can override in settings
  let userRegion = await chrome.storage.local.get('preferredRegion');
  if (userRegion.preferredRegion) {
    region = userRegion.preferredRegion;
  }

  return [
    ...coreSitesByRegion.global,
    ...(coreSitesByRegion[region] || [])
  ];
}
```

**File Structure:**

```
sites/
├── sites-core.js         (~15KB) - Top 50 regional + global sites
├── sites-manifest.js     (~2KB)  - Chunk mapping metadata
├── chunks/
│   ├── sites-india.js            - Indian publications
│   ├── sites-usa-news.js         - US newspapers
│   ├── sites-usa-business.js     - US business publications
│   ├── sites-europe.js           - European publications
│   ├── sites-asia-pacific.js     - Asia/Pacific publications
│   └── sites-specialized.js      - Tech, sports, academic
```

**Lazy Loader with Caching:**

```javascript
const loadedChunks = new Set();
const siteToChunkMap = new Map(); // Built from manifest

async function ensureChunkLoaded(domain, retries = 3) {
  // Already in core?
  if (siteIndexes.domainMap.has(domain)) return true;

  // Find chunk
  let chunkName = siteToChunkMap.get(domain);
  if (!chunkName) return false; // Unknown site

  // Already loaded?
  if (loadedChunks.has(chunkName)) return true;

  // Load with retry
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const startTime = performance.now();
      await import(chrome.runtime.getURL(`sites/chunks/${chunkName}.js`));
      loadedChunks.add(chunkName);

      // Rebuild indexes with new sites
      buildSiteIndexes(window.loadedSiteChunk);

      perfMonitor.recordChunkLoad(chunkName, performance.now() - startTime);
      return true;
    } catch (e) {
      console.error(`[BPC] Chunk load failed (attempt ${attempt + 1}):`, e);
      if (attempt === retries - 1) {
        // Fallback: load all sites
        await loadAllSites();
        return true;
      }
    }
  }
  return false;
}
```

**Usage-Based Learning:**

```javascript
class UsageLearner {
  constructor() {
    this.visitCounts = new Map();
    this.promotionThreshold = 5;
  }

  async trackVisit(domain) {
    let count = this.visitCounts.get(domain) || 0;
    this.visitCounts.set(domain, count + 1);

    // Auto-promote to core if visited frequently
    if (count + 1 >= this.promotionThreshold) {
      await this.promoteToCore(domain);
    }

    // Persist usage data
    await chrome.storage.local.set({
      usageData: Object.fromEntries(this.visitCounts)
    });
  }

  async promoteToCore(domain) {
    console.log(`[BPC] Promoting ${domain} to core (${this.visitCounts.get(domain)} visits)`);

    // Ensure chunk loaded
    await ensureChunkLoaded(domain);

    // Add to core cache (kept in memory)
    let config = siteIndexes.domainMap.get(domain);
    if (config) {
      await chrome.storage.local.set({
        [`core_promoted_${domain}`]: config
      });
    }
  }
}

const usageLearner = new UsageLearner();
```

**Performance Impact:**
- Startup: 96KB → 15KB loaded = 84% faster
- Memory at startup: 3MB → 500KB = 83% reduction
- First-visit delay (non-core): ~10-30ms
- Subsequent visits: 0ms (cached)

### 3. Caching Layer - Regex & Results

**Regex Cache with Result Memoization:**

```javascript
class RegexCache {
  constructor() {
    this.cache = new Map();          // pattern → compiled RegExp
    this.matchResults = new Map();   // pattern+url → boolean (LRU)
    this.maxCacheSize = 1000;
  }

  compile(pattern) {
    if (pattern instanceof RegExp) {
      let key = pattern.source;
      if (!this.cache.has(key)) {
        this.cache.set(key, pattern);
      }
      return this.cache.get(key);
    }

    if (typeof pattern === 'string') {
      if (!this.cache.has(pattern)) {
        this.cache.set(pattern, new RegExp(pattern));
      }
      return this.cache.get(pattern);
    }

    return pattern;
  }

  test(pattern, url) {
    let compiled = this.compile(pattern);
    let cacheKey = `${compiled.source}::${url}`;

    // Check result cache
    if (this.matchResults.has(cacheKey)) {
      perfMonitor.recordCacheHit();
      return this.matchResults.get(cacheKey);
    }

    // Execute and cache
    perfMonitor.recordCacheMiss();
    let result = compiled.test(url);

    // LRU eviction
    if (this.matchResults.size >= this.maxCacheSize) {
      let firstKey = this.matchResults.keys().next().value;
      this.matchResults.delete(firstKey);
    }

    this.matchResults.set(cacheKey, result);
    return result;
  }

  clearMatchCache() {
    this.matchResults.clear();
  }
}

const regexCache = new RegexCache();
```

**Performance Impact:**
- Regex compilation: Once per unique pattern vs thousands of times
- Match results: Instant for repeated URL patterns
- Memory: ~100KB compiled + ~500KB match cache
- Speed: 50-100x faster for repeated patterns

### 4. Content Script Optimization

**Conditional Injection (only for paywall sites):**

```javascript
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'loading') return;

  let domain = extractDomain(tab.url);

  // Fast rejection: not a paywall site
  if (!siteIndexes.domainMap.has(domain) &&
      !siteIndexes.groupMap.has(domain)) {
    return; // No injection - saves 90% of page loads
  }

  // Ensure config loaded
  await ensureChunkLoaded(domain);

  // Track usage
  if (userSettings.performance.usageLearning) {
    usageLearner.trackVisit(domain);
  }

  // Get targeted config
  let config = getSiteConfig(domain);

  // Check if site is disabled
  if (userSettings.siteOverrides[domain]?.disabled) {
    return;
  }

  // Inject DOMPurify only if needed
  if (config.cs_dompurify) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['dompurify.min.js']
    });
  }

  // Inject content script
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['contentScript.js'],
    world: 'MAIN'
  });

  // Send minimal, targeted data
  chrome.tabs.sendMessage(tabId, {
    domain: domain,
    config: config, // Single site config only
    dompurify_loaded: !!config.cs_dompurify
  });
});
```

**Performance Impact:**
- 90% of page loads: No injection at all
- 10% of page loads: Tiny targeted config
- Memory per tab: 5MB → 200KB
- DOMPurify: Only ~80 sites vs all

### 5. Header Modification Engine

**Pre-computed Header Rules:**

```javascript
class HeaderRuleEngine {
  constructor() {
    this.rules = new Map(); // domain → pre-computed rule
  }

  buildRules(siteConfigs) {
    for (let [domain, config] of siteConfigs.entries()) {
      let rule = {};

      if (config.useragent) {
        rule.userAgent = this.getUserAgentString(config.useragent);
      }
      if (config.referer) {
        rule.referer = config.referer;
      }
      if (config.random_ip) {
        rule.randomIP = this.generateIPPool(domain);
      }

      if (Object.keys(rule).length > 0) {
        this.rules.set(domain, rule);
      }
    }
  }

  getUserAgentString(type) {
    const agents = {
      'googlebot': navigator_ua_mobile ? userAgentMobileG : userAgentDesktopG,
      'bingbot': navigator_ua_mobile ? userAgentMobileB : userAgentDesktopB,
      'facebookbot': userAgentDesktopF
    };
    return agents[type];
  }

  generateIPPool(domain) {
    // Pre-generate 10 random IPs per domain
    return Array.from({length: 10}, () =>
      Array.from({length: 4}, () =>
        Math.floor(Math.random() * 255)
      ).join('.')
    );
  }

  applyHeaders(domain, headers) {
    let rule = this.rules.get(domain);
    if (!rule) return headers;

    let modified = [...headers];

    if (rule.userAgent) {
      modified.push({ name: 'User-Agent', value: rule.userAgent });
    }
    if (rule.referer) {
      modified.push({ name: 'Referer', value: rule.referer });
    }
    if (rule.randomIP) {
      let ip = rule.randomIP[Date.now() % rule.randomIP.length];
      modified.push({ name: 'X-Forwarded-For', value: ip });
    }

    return modified;
  }
}

const headerEngine = new HeaderRuleEngine();
```

**Optimized Request Handler:**

```javascript
chrome.webRequest.onBeforeSendHeaders.addListener((details) => {
  let domain = extractDomain(details.url);

  // Single O(1) lookup, pre-computed rules
  let newHeaders = headerEngine.applyHeaders(domain, details.requestHeaders);

  return { requestHeaders: newHeaders };
},
{urls: ["<all_urls>"]},
["blocking", "requestHeaders", "extraHeaders"]);
```

**Performance Impact:**
- Header modification: 5+ array searches → 1 map lookup = 5x faster
- IP generation: Pre-computed vs on-demand
- Request overhead: 5ms → 0.5ms

### 6. User Controls & Settings UI

**Settings Data Structure:**

```javascript
const userSettings = {
  features: {
    mediumRedirect: true,        // Toggle Medium redirect
    mediumRedirectTarget: 'freedium', // 'freedium' | 'scribe' | 'custom'
    ampRedirect: true,           // Toggle AMP redirects
    archiveRedirect: true,       // Toggle archive.is fallback
    autoBypass: true             // Global enable/disable
  },

  siteOverrides: {
    // Per-site controls
    // 'nytimes.com': { disabled: false }
  },

  preferredRegion: 'india',     // Core sites region

  performance: {
    usageLearning: true,         // Auto-promote frequent sites
    preloadCore: true            // Load core at startup
  }
};
```

**Extension Popup (popup.html):**

```html
<div class="popup-container">
  <div class="header">
    <h3>Bypass Paywalls Clean</h3>
    <span class="status active">Active</span>
  </div>

  <div class="quick-toggles">
    <!-- Medium Redirect Toggle -->
    <div class="toggle-item">
      <label>
        <input type="checkbox" id="toggle-medium-redirect" checked>
        Medium Redirect
      </label>
      <select id="medium-redirect-target">
        <option value="freedium">Freedium.cfd</option>
        <option value="scribe">Scribe.rip</option>
      </select>
    </div>

    <!-- AMP Redirect Toggle -->
    <div class="toggle-item">
      <label>
        <input type="checkbox" id="toggle-amp-redirect" checked>
        AMP Redirects
      </label>
    </div>

    <!-- Archive Fallback Toggle -->
    <div class="toggle-item">
      <label>
        <input type="checkbox" id="toggle-archive" checked>
        Archive.is Fallback
      </label>
    </div>

    <div class="divider"></div>

    <!-- Current Site Toggle -->
    <div class="toggle-item">
      <label>
        <input type="checkbox" id="toggle-current-site" checked>
        Enable for <span id="current-domain">current site</span>
      </label>
    </div>
  </div>

  <div class="actions">
    <button id="open-settings">⚙️ Settings</button>
    <button id="clear-cache">🗑️ Clear Cache</button>
  </div>
</div>
```

**Redirect Handler with Toggle:**

```javascript
const redirectRules = {
  'medium.com': {
    enabled: () => userSettings.features.mediumRedirect,
    targets: {
      'freedium': 'https://freedium.cfd/',
      'scribe': 'https://scribe.rip/',
    },
    getRedirectUrl(originalUrl) {
      let target = userSettings.features.mediumRedirectTarget || 'freedium';
      return this.targets[target] + originalUrl;
    }
  }
};

chrome.webRequest.onBeforeRequest.addListener((details) => {
  let domain = extractDomain(details.url);

  if (domain === 'medium.com' || medium_custom_domains.includes(domain)) {
    let redirectConfig = redirectRules['medium.com'];

    if (redirectConfig.enabled()) {
      return { redirectUrl: redirectConfig.getRedirectUrl(details.url) };
    }
  }
},
{urls: ["*://*.medium.com/*", "*://medium.com/*"]},
["blocking"]);
```

### 7. Migration & Backward Compatibility

**Version Detection:**

```javascript
const EXTENSION_VERSION = '4.0.0';
const MIGRATION_KEY = 'bpc_migration_status';

async function checkAndMigrate() {
  let migration = await chrome.storage.local.get(MIGRATION_KEY);

  if (!migration[MIGRATION_KEY] || migration[MIGRATION_KEY] < EXTENSION_VERSION) {
    await runMigration();
  }
}
```

**Migration Process:**

```javascript
async function runMigration() {
  console.log('[BPC] Running migration to v4.0.0...');

  // 1. Backup existing settings
  let oldSettings = await chrome.storage.sync.get('sites');
  await chrome.storage.local.set({
    'settings_backup_v3': oldSettings,
    'backup_timestamp': Date.now()
  });

  // 2. Migrate to new structure
  let newSettings = {
    features: {
      mediumRedirect: true,
      ampRedirect: true,
      archiveRedirect: true,
      autoBypass: true
    },
    siteOverrides: {},
    preferredRegion: detectRegion(),
    performance: {
      usageLearning: true,
      preloadCore: true
    }
  };

  // Preserve user's disabled sites
  if (oldSettings.sites) {
    for (let [site, enabled] of Object.entries(oldSettings.sites)) {
      if (!enabled) {
        newSettings.siteOverrides[site] = { disabled: true };
      }
    }
  }

  await chrome.storage.sync.set({ userSettings: newSettings });

  // 3. Build indexes
  await buildAllIndexes();

  // 4. Mark complete
  await chrome.storage.local.set({
    [MIGRATION_KEY]: EXTENSION_VERSION,
    migration_completed: Date.now()
  });

  console.log('[BPC] Migration complete!');
}
```

**Graceful Degradation:**

```javascript
// Fallback if chunking fails
async function ensureChunkLoaded(domain, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await loadChunkForDomain(domain);
      return true;
    } catch (e) {
      console.error(`[BPC] Chunk load failed (attempt ${i+1}):`, e);
      if (i === retries - 1) {
        // Final fallback: load all sites (old behavior)
        console.warn('[BPC] Loading all sites as fallback');
        await loadAllSites();
        return true;
      }
    }
  }
  return false;
}
```

### 8. Performance Monitoring

**Metrics Tracking:**

```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      startupTime: 0,
      chunkLoads: [],
      indexLookups: [],
      cacheHits: 0,
      cacheMisses: 0
    };
  }

  recordStartup(timeMs) {
    this.metrics.startupTime = timeMs;
    console.log(`[BPC] Startup completed in ${timeMs}ms`);
  }

  recordChunkLoad(chunk, timeMs) {
    this.metrics.chunkLoads.push({
      chunk,
      timeMs,
      timestamp: Date.now()
    });
  }

  recordCacheHit() {
    this.metrics.cacheHits++;
  }

  recordCacheMiss() {
    this.metrics.cacheMisses++;
  }

  getCacheHitRate() {
    let total = this.metrics.cacheHits + this.metrics.cacheMisses;
    return total > 0 ? (this.metrics.cacheHits / total * 100).toFixed(2) : 0;
  }

  async exportMetrics() {
    return {
      ...this.metrics,
      cacheHitRate: this.getCacheHitRate() + '%',
      avgChunkLoadTime: this.getAvgChunkLoad()
    };
  }
}

const perfMonitor = new PerformanceMonitor();
```

## Implementation Plan

### Phase 1: Core Infrastructure (Week 1)
1. Create new data structures (Maps, caches)
2. Implement RegexCache class
3. Build indexing system
4. Add performance monitoring

### Phase 2: Lazy Loading (Week 1-2)
1. Split sites.js into core + chunks
2. Create site-to-chunk manifest
3. Implement chunk loader
4. Add usage-based learning

### Phase 3: Content Script Optimization (Week 2)
1. Implement conditional injection
2. Create targeted config messaging
3. Lazy load DOMPurify

### Phase 4: Header Optimization (Week 2)
1. Implement HeaderRuleEngine
2. Pre-compute all rules
3. Optimize request handlers

### Phase 5: User Controls (Week 3)
1. Design and implement popup UI
2. Create settings page
3. Add toggle handlers
4. Implement Medium redirect controls

### Phase 6: Migration & Testing (Week 3-4)
1. Create migration script
2. Add backward compatibility
3. Test with existing user data
4. Monitor performance metrics

### Phase 7: Rollout (Week 4)
1. Beta release to subset of users
2. Monitor crash reports and metrics
3. Adjust based on real-world data
4. Full release

## Success Criteria

### Performance Targets
- ✅ Startup time: < 100ms (vs current ~500ms)
- ✅ Memory usage: < 50MB (vs current ~150MB)
- ✅ Page load impact: < 50ms (vs current ~200ms)
- ✅ Cache hit rate: > 80%

### Functionality Targets
- ✅ All 900+ sites continue working
- ✅ Bypass effectiveness unchanged
- ✅ No new user-facing errors
- ✅ Settings migration 100% successful

### User Experience Targets
- ✅ Feature toggles work instantly
- ✅ Per-site controls functional
- ✅ Settings sync across devices
- ✅ Clear visual feedback

## Risk Mitigation

### Risk 1: Migration Failures
- **Mitigation:** Automatic backup, rollback option, fallback to old behavior

### Risk 2: Chunk Loading Failures
- **Mitigation:** Retry logic, fallback to load all sites, error reporting

### Risk 3: Cache Staleness
- **Mitigation:** Version-based cache invalidation, manual clear cache option

### Risk 4: Regional Core Mismatch
- **Mitigation:** User can override region, manual site selection in settings

## Future Enhancements

1. **Adaptive Learning:** ML-based site importance ranking
2. **Network-Aware Loading:** Defer chunks on slow connections
3. **Service Worker Optimization:** Use service worker cache API
4. **Prefetching:** Predict and preload likely-needed chunks
5. **Analytics Dashboard:** Show user their most-used sites, cache performance

## Conclusion

This indexed + cached architecture provides the best balance of performance improvements while maintaining full functionality and adding user controls. The phased implementation plan allows for iterative testing and validation.

Expected impact:
- **80% faster startup**
- **67% less memory**
- **75% faster page loads**
- **New user controls** (Medium redirect toggle, per-site enable/disable)
- **Zero functionality loss**
