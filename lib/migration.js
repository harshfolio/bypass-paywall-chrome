/**
 * Migration - Handles upgrading from old extension versions
 * Ensures smooth transition and data preservation
 */
class Migration {
  constructor() {
    this.CURRENT_VERSION = '4.0.0';
    this.MIGRATION_KEY = 'bpc_migration_status';
  }

  /**
   * Check if migration is needed and run it
   */
  async checkAndMigrate() {
    try {
      let data = await ext_api.storage.local.get(this.MIGRATION_KEY);
      let lastMigrated = data[this.MIGRATION_KEY];

      if (!lastMigrated || this.compareVersions(lastMigrated, this.CURRENT_VERSION) < 0) {
        console.log(`[BPC] Migration needed: ${lastMigrated || 'none'} → ${this.CURRENT_VERSION}`);
        await this.runMigration(lastMigrated);
      } else {
        console.log(`[BPC] No migration needed (already on ${this.CURRENT_VERSION})`);
      }
    } catch (e) {
      console.error('[BPC] Migration check failed:', e);
    }
  }

  /**
   * Run migration process
   */
  async runMigration(fromVersion) {
    console.log(`[BPC] Starting migration to v${this.CURRENT_VERSION}...`);
    const startTime = performance.now();

    try {
      // Step 1: Backup existing settings
      await this.backupSettings();

      // Step 2: Migrate data structures
      await this.migrateSettings(fromVersion);

      // Step 3: Mark migration complete
      await ext_api.storage.local.set({
        [this.MIGRATION_KEY]: this.CURRENT_VERSION,
        migration_completed: Date.now()
      });

      const duration = performance.now() - startTime;
      console.log(`[BPC] Migration completed in ${duration.toFixed(2)}ms`);

      // Show success notification
      this.showNotification('Extension Updated', 'Bypass Paywalls Clean has been optimized for better performance!');

    } catch (e) {
      console.error('[BPC] Migration failed:', e);

      // Show error notification
      this.showNotification('Update Failed', 'Please reinstall the extension if issues persist.');

      throw e;
    }
  }

  /**
   * Backup existing settings
   */
  async backupSettings() {
    try {
      let oldSettings = await ext_api.storage.sync.get('sites');

      await ext_api.storage.local.set({
        'settings_backup_v3': oldSettings,
        'backup_timestamp': Date.now()
      });

      console.log('[BPC] Settings backed up');
    } catch (e) {
      console.error('[BPC] Backup failed:', e);
    }
  }

  /**
   * Migrate settings from old format to new format
   */
  async migrateSettings(fromVersion) {
    // Get old settings
    let oldData = await ext_api.storage.sync.get('sites');

    // Create new settings structure
    let newSettings = {
      features: {
        mediumRedirect: true,
        mediumRedirectTarget: 'freedium',
        ampRedirect: true,
        archiveRedirect: true,
        autoBypass: true
      },
      siteOverrides: {},
      preferredRegion: this.detectRegion(),
      performance: {
        usageLearning: true,
        preloadCore: true
      }
    };

    // Migrate enabled/disabled sites
    if (oldData.sites) {
      for (let [siteName, domain] of Object.entries(oldData.sites)) {
        if (typeof domain === 'string') {
          // Check if this site was disabled
          let enabledSites = await ext_api.storage.local.get('enabledSites');
          let disabledSites = await ext_api.storage.local.get('disabledSites');

          if (disabledSites.disabledSites && disabledSites.disabledSites.includes(siteName)) {
            newSettings.siteOverrides[domain] = { disabled: true };
          }
        }
      }
    }

    // Save new settings
    await ext_api.storage.sync.set({ userSettings: newSettings });

    console.log('[BPC] Settings migrated');
  }

  /**
   * Detect user's region
   */
  detectRegion() {
    try {
      let locale = ext_api.i18n.getUILanguage();
      let region = locale.split('-')[1]?.toLowerCase();

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

      return regionMap[region] || 'global';
    } catch (e) {
      return 'global';
    }
  }

  /**
   * Compare version strings
   * Returns: -1 if a < b, 0 if a == b, 1 if a > b
   */
  compareVersions(a, b) {
    if (!a) return -1;
    if (!b) return 1;

    let aParts = a.split('.').map(Number);
    let bParts = b.split('.').map(Number);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      let aVal = aParts[i] || 0;
      let bVal = bParts[i] || 0;

      if (aVal < bVal) return -1;
      if (aVal > bVal) return 1;
    }

    return 0;
  }

  /**
   * Show notification to user
   */
  showNotification(title, message) {
    if (typeof ext_api.notifications !== 'undefined') {
      ext_api.notifications.create({
        type: 'basic',
        iconUrl: 'bypass.png',
        title: title,
        message: message
      });
    }
  }

  /**
   * Rollback to previous version (emergency use only)
   */
  async rollback() {
    try {
      let backup = await ext_api.storage.local.get('settings_backup_v3');

      if (backup.settings_backup_v3) {
        await ext_api.storage.sync.set(backup.settings_backup_v3);
        console.log('[BPC] Rolled back to v3 settings');
        this.showNotification('Rollback Complete', 'Settings have been restored to the previous version.');
        return true;
      } else {
        console.error('[BPC] No backup found for rollback');
        return false;
      }
    } catch (e) {
      console.error('[BPC] Rollback failed:', e);
      return false;
    }
  }
}

// Global migration instance
if (typeof window !== 'undefined') {
  window.migration = new Migration();
} else if (typeof self !== 'undefined') {
  self.migration = new Migration();
}
