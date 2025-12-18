/**
 * Caching service for statistics and other expensive queries
 * Provides in-memory caching with TTL and invalidation support
 */

// In-memory cache for expensive statistics queries
// Structure: { cacheKey: { data: any, timestamp: number } }
const statsCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

/**
 * Get data from cache if still valid
 * @param {string} key - Cache key
 * @returns {any|null} Cached data or null if expired/missing
 */
function getCachedData(key) {
  const cached = statsCache.get(key);
  if (!cached) return null;
  
  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL) {
    statsCache.delete(key);
    return null;
  }
  
  console.log(`✅ Cache HIT for ${key} (age: ${Math.round(age/1000)}s)`);
  return cached.data;
}

/**
 * Store data in cache
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 */
function setCachedData(key, data) {
  statsCache.set(key, {
    data,
    timestamp: Date.now()
  });
  console.log(`💾 Cache SET for ${key}`);
}

/**
 * Invalidate all cache entries for a specific course
 * @param {number} courseId - Course ID
 */
function invalidateCourseCache(courseId) {
  let deletedCount = 0;
  for (const key of statsCache.keys()) {
    if (key.startsWith(`course:${courseId}:`)) {
      statsCache.delete(key);
      deletedCount++;
    }
  }
  if (deletedCount > 0) {
    console.log(`🗑️  Invalidated ${deletedCount} cache entries for course ${courseId}`);
  }
}

/**
 * Invalidate cache for a specific assignment
 * @param {number} assignmentId - Assignment ID
 */
function invalidateAssignmentCache(assignmentId) {
  const key = `assignment:${assignmentId}:statistics`;
  if (statsCache.has(key)) {
    statsCache.delete(key);
    console.log(`🗑️  Invalidated cache for assignment ${assignmentId}`);
  }
}

/**
 * Clear all cache entries
 */
function clearAllCache() {
  const count = statsCache.size;
  statsCache.clear();
  console.log(`🗑️  Cleared all ${count} cache entries`);
}

/**
 * Get cache statistics
 * @returns {object} Cache statistics
 */
function getCacheStats() {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;
  
  for (const [key, value] of statsCache.entries()) {
    const age = now - value.timestamp;
    if (age > CACHE_TTL) {
      expiredEntries++;
    } else {
      validEntries++;
    }
  }
  
  return {
    totalEntries: statsCache.size,
    validEntries,
    expiredEntries,
    ttlSeconds: CACHE_TTL / 1000
  };
}

module.exports = {
  getCachedData,
  setCachedData,
  invalidateCourseCache,
  invalidateAssignmentCache,
  clearAllCache,
  getCacheStats
};
