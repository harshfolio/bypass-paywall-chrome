// Enhanced popup features for v4.0 optimization
const ext_api = (typeof browser === 'object') ? browser : chrome;

// Initialize enhanced features
(async function initEnhancedFeatures() {
  try {
    // Load settings with proper defaults
    let data = await ext_api.storage.sync.get('userSettings');

    // Define default settings (OFF by default - user must enable)
    const defaultSettings = {
      features: {
        mediumRedirect: false,
        mediumRedirectTarget: 'freedium',
        ampRedirect: false,
        archiveRedirect: false
      }
    };

    // Deep merge helper (reused from UserSettings pattern)
    function deepMerge(target, source) {
      let result = { ...target };
      for (let key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = deepMerge(target[key] || {}, source[key]);
        } else if (source[key] !== undefined) {
          result[key] = source[key];
        }
      }
      return result;
    }

    // Merge defaults with loaded settings
    let settings = deepMerge(defaultSettings, data.userSettings || {});

    // Set toggle states
    const mediumRedirectToggle = document.getElementById('toggle-medium-redirect');
    const mediumRedirectTarget = document.getElementById('medium-redirect-target');
    const ampRedirectToggle = document.getElementById('toggle-amp-redirect');
    const archiveToggle = document.getElementById('toggle-archive');

    if (mediumRedirectToggle) {
      mediumRedirectToggle.checked = settings.features.mediumRedirect;
    }
    if (mediumRedirectTarget) {
      mediumRedirectTarget.value = settings.features.mediumRedirectTarget;
    }
    if (ampRedirectToggle) {
      ampRedirectToggle.checked = settings.features.ampRedirect;
    }
    if (archiveToggle) {
      archiveToggle.checked = settings.features.archiveRedirect;
    }

    // Medium redirect toggle handler
    if (mediumRedirectToggle) {
      mediumRedirectToggle.addEventListener('change', async (e) => {
        settings.features.mediumRedirect = e.target.checked;
        await ext_api.storage.sync.set({ userSettings: settings });
        console.log(`[BPC] Medium redirect ${e.target.checked ? 'enabled' : 'disabled'}`);
      });
    }

    // Medium redirect target handler
    if (mediumRedirectTarget) {
      mediumRedirectTarget.addEventListener('change', async (e) => {
        settings.features.mediumRedirectTarget = e.target.value;
        await ext_api.storage.sync.set({ userSettings: settings });
        console.log(`[BPC] Medium redirect target: ${e.target.value}`);
      });
    }

    // AMP redirect toggle handler
    if (ampRedirectToggle) {
      ampRedirectToggle.addEventListener('change', async (e) => {
        settings.features.ampRedirect = e.target.checked;
        await ext_api.storage.sync.set({ userSettings: settings });
        console.log(`[BPC] AMP redirect ${e.target.checked ? 'enabled' : 'disabled'}`);
      });
    }

    // Archive fallback toggle handler
    if (archiveToggle) {
      archiveToggle.addEventListener('change', async (e) => {
        settings.features.archiveRedirect = e.target.checked;
        await ext_api.storage.sync.set({ userSettings: settings });
        console.log(`[BPC] Archive fallback ${e.target.checked ? 'enabled' : 'disabled'}`);
      });
    }

    // Clear cache button
    const clearCacheBtn = document.getElementById('clear_cache');
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', async () => {
        try {
          await ext_api.runtime.sendMessage({ action: 'clearCache' });
          console.log('[BPC] Cache cleared successfully');

          // Visual feedback
          clearCacheBtn.textContent = '✓ Cleared!';
          setTimeout(() => {
            clearCacheBtn.textContent = 'clear cache';
          }, 2000);
        } catch (e) {
          console.error('[BPC] Failed to clear cache:', e);
        }
      });
    }

  } catch (e) {
    console.error('[BPC] Failed to initialize enhanced features:', e);
  }
})();
