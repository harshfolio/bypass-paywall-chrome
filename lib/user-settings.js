/**
 * UserSettings - Manages extension settings with sync support
 * Handles feature toggles, per-site overrides, performance settings
 */
class UserSettings {
  constructor() {
    this.settings = {
      features: {
        mediumRedirect: false,
        mediumRedirectTarget: 'freedium', // 'freedium' | 'scribe'
        ampRedirect: false,
        archiveRedirect: false,
        autoBypass: true
      },

      siteOverrides: {
        // domain → { disabled: boolean, redirect: boolean }
      },

      preferredRegion: 'global', // Will be auto-detected

      performance: {
        usageLearning: true,
        preloadCore: true
      }
    };

    this.loaded = false;
  }

  /**
   * Initialize settings from storage
   */
  async init() {
    try {
      let data = await ext_api.storage.sync.get('userSettings');

      if (data.userSettings) {
        // Merge with defaults (in case new settings were added)
        this.settings = this.deepMerge(this.settings, data.userSettings);
      } else {
        // First run - detect region
        this.settings.preferredRegion = this.detectRegion();
        await this.save();
      }

      this.loaded = true;
      console.log('[BPC] Settings loaded:', this.settings);

    } catch (e) {
      console.error('[BPC] Failed to load settings:', e);
      // Use defaults
      this.settings.preferredRegion = this.detectRegion();
      this.loaded = true;
    }
  }

  /**
   * Auto-detect user's region from browser locale
   */
  detectRegion() {
    try {
      let locale = ext_api.i18n.getUILanguage(); // e.g., 'en-IN', 'en-US'
      let region = locale.split('-')[1]?.toLowerCase();

      const supportedRegions = ['india', 'usa', 'europe'];
      const regionMap = {
        'in': 'india',
        'us': 'usa',
        'gb': 'europe',
        'uk': 'europe',
        'de': 'europe',
        'fr': 'europe',
        'es': 'europe',
        'it': 'europe'
      };

      let detected = regionMap[region] || 'global';
      console.log(`[BPC] Detected region: ${detected} (from locale: ${locale})`);

      return detected;
    } catch (e) {
      console.error('[BPC] Failed to detect region:', e);
      return 'global';
    }
  }

  /**
   * Save settings to storage
   */
  async save() {
    try {
      await ext_api.storage.sync.set({ userSettings: this.settings });
      console.log('[BPC] Settings saved');
    } catch (e) {
      console.error('[BPC] Failed to save settings:', e);
    }
  }

  /**
   * Get a setting value
   */
  get(path) {
    let parts = path.split('.');
    let value = this.settings;

    for (let part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Set a setting value
   */
  async set(path, value) {
    let parts = path.split('.');
    let obj = this.settings;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) {
        obj[parts[i]] = {};
      }
      obj = obj[parts[i]];
    }

    obj[parts[parts.length - 1]] = value;
    await this.save();
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(featureName) {
    return this.settings.features[featureName] === true;
  }

  /**
   * Check if a site is disabled
   */
  isSiteDisabled(domain) {
    return this.settings.siteOverrides[domain]?.disabled === true;
  }

  /**
   * Toggle a feature
   */
  async toggleFeature(featureName) {
    let current = this.settings.features[featureName];
    await this.set(`features.${featureName}`, !current);
    return !current;
  }

  /**
   * Toggle a site
   */
  async toggleSite(domain) {
    if (!this.settings.siteOverrides[domain]) {
      this.settings.siteOverrides[domain] = {};
    }

    let current = this.settings.siteOverrides[domain].disabled || false;
    this.settings.siteOverrides[domain].disabled = !current;

    await this.save();
    return !current;
  }

  /**
   * Deep merge two objects
   */
  deepMerge(target, source) {
    let result = { ...target };

    for (let key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  /**
   * Reset to defaults
   */
  async reset() {
    this.settings = {
      features: {
        mediumRedirect: false,
        mediumRedirectTarget: 'freedium',
        ampRedirect: false,
        archiveRedirect: false,
        autoBypass: true
      },
      siteOverrides: {},
      preferredRegion: this.detectRegion(),
      performance: {
        usageLearning: true,
        preloadCore: true
      }
    };

    await this.save();
    console.log('[BPC] Settings reset to defaults');
  }

  /**
   * Export settings
   */
  export() {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * Import settings
   */
  async import(json) {
    try {
      let imported = JSON.parse(json);
      this.settings = this.deepMerge(this.settings, imported);
      await this.save();
      console.log('[BPC] Settings imported');
      return true;
    } catch (e) {
      console.error('[BPC] Failed to import settings:', e);
      return false;
    }
  }
}

// Global user settings instance
if (typeof window !== 'undefined') {
  window.userSettings = new UserSettings();
} else if (typeof self !== 'undefined') {
  self.userSettings = new UserSettings();
}
