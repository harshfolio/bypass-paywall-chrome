/**
 * PerformanceMonitor - Tracks extension performance metrics
 * Monitors startup time, chunk loads, cache hit rates, etc.
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      startupTime: 0,
      chunkLoads: [],
      indexBuildTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      requestsProcessed: 0
    };
    this.startTime = performance.now();
  }

  /**
   * Record extension startup time
   */
  recordStartup(timeMs) {
    this.metrics.startupTime = timeMs;
    console.log(`[BPC Performance] Startup completed in ${timeMs.toFixed(2)}ms`);
  }

  /**
   * Record index build time
   */
  recordIndexBuild(timeMs) {
    this.metrics.indexBuildTime = timeMs;
    console.log(`[BPC Performance] Indexes built in ${timeMs.toFixed(2)}ms`);
  }

  /**
   * Record chunk loading time
   */
  recordChunkLoad(chunkName, timeMs) {
    this.metrics.chunkLoads.push({
      chunk: chunkName,
      timeMs: timeMs,
      timestamp: Date.now()
    });
    console.log(`[BPC Performance] Chunk "${chunkName}" loaded in ${timeMs.toFixed(2)}ms`);
  }

  /**
   * Record cache hit
   */
  recordCacheHit() {
    this.metrics.cacheHits++;
  }

  /**
   * Record cache miss
   */
  recordCacheMiss() {
    this.metrics.cacheMisses++;
  }

  /**
   * Record request processed
   */
  recordRequest() {
    this.metrics.requestsProcessed++;
  }

  /**
   * Calculate cache hit rate
   */
  getCacheHitRate() {
    let total = this.metrics.cacheHits + this.metrics.cacheMisses;
    if (total === 0) return 0;
    return ((this.metrics.cacheHits / total) * 100).toFixed(2);
  }

  /**
   * Get average chunk load time
   */
  getAvgChunkLoadTime() {
    if (this.metrics.chunkLoads.length === 0) return 0;
    let total = this.metrics.chunkLoads.reduce((sum, load) => sum + load.timeMs, 0);
    return (total / this.metrics.chunkLoads.length).toFixed(2);
  }

  /**
   * Export all metrics
   */
  async exportMetrics() {
    return {
      ...this.metrics,
      cacheHitRate: this.getCacheHitRate() + '%',
      avgChunkLoadTime: this.getAvgChunkLoadTime() + 'ms',
      totalRuntime: (performance.now() - this.startTime).toFixed(2) + 'ms'
    };
  }

  /**
   * Log performance summary
   */
  async logSummary() {
    let metrics = await this.exportMetrics();
    console.log('[BPC Performance Summary]', metrics);
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics = {
      startupTime: 0,
      chunkLoads: [],
      indexBuildTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      requestsProcessed: 0
    };
    this.startTime = performance.now();
  }
}

// Global performance monitor instance
if (typeof window !== 'undefined') {
  window.perfMonitor = new PerformanceMonitor();
} else if (typeof self !== 'undefined') {
  self.perfMonitor = new PerformanceMonitor();
}
