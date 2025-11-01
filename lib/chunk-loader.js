/**
 * ChunkLoader - Lazy loads site configuration chunks on demand
 * Reduces initial load time and memory footprint
 */
class ChunkLoader {
  constructor() {
    this.loadedChunks = new Set();
    this.siteToChunkMap = new Map();  // domain → chunk name
    this.chunkManifest = {};          // chunk name → { file, domains }
    this.loading = new Map();         // chunk name → Promise (prevents duplicate loads)
  }

  /**
   * Initialize chunk manifest
   */
  async init(manifest) {
    this.chunkManifest = manifest;

    // Build reverse index: domain → chunk
    for (let [chunkName, chunkData] of Object.entries(manifest)) {
      if (chunkData.domains && Array.isArray(chunkData.domains)) {
        for (let domain of chunkData.domains) {
          this.siteToChunkMap.set(domain, chunkName);
        }
      }
    }

    console.log(`[BPC] Chunk loader initialized: ${Object.keys(manifest).length} chunks, ${this.siteToChunkMap.size} domains mapped`);
  }

  /**
   * Ensure chunk loaded for a domain
   */
  async ensureChunkLoaded(domain, retries = 3) {
    // Check if domain is already indexed (in core or loaded chunk)
    if (typeof siteIndexes !== 'undefined' && siteIndexes.hasDomain(domain)) {
      return true;
    }

    // Find which chunk contains this domain
    let chunkName = this.siteToChunkMap.get(domain);
    if (!chunkName) {
      // Domain not in any chunk
      return false;
    }

    // Already loaded?
    if (this.loadedChunks.has(chunkName)) {
      return true;
    }

    // Already loading? Wait for it
    if (this.loading.has(chunkName)) {
      return await this.loading.get(chunkName);
    }

    // Load the chunk
    let loadPromise = this.loadChunk(chunkName, retries);
    this.loading.set(chunkName, loadPromise);

    try {
      let result = await loadPromise;
      return result;
    } finally {
      this.loading.delete(chunkName);
    }
  }

  /**
   * Load a specific chunk
   */
  async loadChunk(chunkName, retries = 3) {
    let chunkData = this.chunkManifest[chunkName];
    if (!chunkData) {
      console.error(`[BPC] Unknown chunk: ${chunkName}`);
      return false;
    }

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const startTime = performance.now();

        // Import the chunk script
        await this.importScript(chunkData.file);

        this.loadedChunks.add(chunkName);

        // Rebuild indexes with new sites
        if (typeof window.loadedSiteChunk !== 'undefined' && typeof siteIndexes !== 'undefined') {
          siteIndexes.buildIndexes(window.loadedSiteChunk);
          delete window.loadedSiteChunk; // Clean up
        }

        const loadTime = performance.now() - startTime;
        if (typeof perfMonitor !== 'undefined') {
          perfMonitor.recordChunkLoad(chunkName, loadTime);
        }

        console.log(`[BPC] Loaded chunk "${chunkName}" (${chunkData.domains?.length || 0} domains) in ${loadTime.toFixed(2)}ms`);
        return true;

      } catch (e) {
        console.error(`[BPC] Chunk load failed (attempt ${attempt + 1}/${retries}):`, chunkName, e);

        if (attempt === retries - 1) {
          console.error(`[BPC] Failed to load chunk ${chunkName} after ${retries} attempts`);
          return false;
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
      }
    }

    return false;
  }

  /**
   * Import a script file
   */
  async importScript(scriptPath) {
    if (typeof importScripts === 'function') {
      // Service worker context
      importScripts(scriptPath);
    } else {
      // Browser context - use dynamic import
      await import(ext_api.runtime.getURL(scriptPath));
    }
  }

  /**
   * Preload specific chunks
   */
  async preloadChunks(chunkNames) {
    let promises = chunkNames.map(name => this.loadChunk(name));
    await Promise.all(promises);
  }

  /**
   * Get loader stats
   */
  getStats() {
    return {
      totalChunks: Object.keys(this.chunkManifest).length,
      loadedChunks: this.loadedChunks.size,
      mappedDomains: this.siteToChunkMap.size,
      loadedChunksList: Array.from(this.loadedChunks)
    };
  }

  /**
   * Check if chunk is loaded
   */
  isChunkLoaded(chunkName) {
    return this.loadedChunks.has(chunkName);
  }

  /**
   * Get chunk name for domain
   */
  getChunkForDomain(domain) {
    return this.siteToChunkMap.get(domain);
  }
}

// Global chunk loader instance
if (typeof window !== 'undefined') {
  window.chunkLoader = new ChunkLoader();
} else if (typeof self !== 'undefined') {
  self.chunkLoader = new ChunkLoader();
}
