/**
 * Retry utility voor foutafhandeling bij externe API calls
 */

/**
 * Voer een functie uit met automatische retry bij falen
 * @param {Function} fn - Async functie om uit te voeren
 * @param {object} options - Retry opties
 * @param {number} options.maxRetries - Maximum aantal pogingen (default: 3)
 * @param {number} options.initialDelay - Initiële delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {number} options.backoffMultiplier - Multiplier voor exponential backoff (default: 2)
 * @param {Function} options.shouldRetry - Functie die bepaalt of retry nodig is (default: altijd bij error)
 * @param {Function} options.onRetry - Callback bij elke retry poging
 * @returns {Promise<any>}
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    shouldRetry = () => true,
    onRetry = () => {},
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check of we moeten retrien
      if (attempt >= maxRetries || !shouldRetry(error, attempt)) {
        throw error;
      }

      // Callback voor logging
      onRetry(error, attempt, delay);

      // Wacht voor volgende poging
      await sleep(delay);

      // Exponential backoff
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Sleep utility
 * @param {number} ms - Milliseconden om te wachten
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Bepaal of een error retryable is voor GitHub API
 * @param {Error} error - De error
 * @returns {boolean}
 */
function isGitHubRetryable(error) {
  if (!error.response) {
    // Network error - retry
    return true;
  }

  const status = error.response.status;

  // Retry bij rate limiting, server errors, of timeouts
  return (
    status === 429 || // Rate limited
    status === 502 || // Bad gateway
    status === 503 || // Service unavailable
    status === 504 || // Gateway timeout
    status >= 500
  ); // Server errors
}

/**
 * Bepaal of een error retryable is voor OpenAI API
 * @param {Error} error - De error
 * @returns {boolean}
 */
function isOpenAIRetryable(error) {
  if (!error.response) {
    // Network error - retry
    return true;
  }

  const status = error.response.status;

  // Retry bij rate limiting, server errors, of overload
  return (
    status === 429 || // Rate limited
    status === 500 || // Server error
    status === 502 || // Bad gateway
    status === 503 || // Service unavailable (overloaded)
    status === 504
  ); // Gateway timeout
}

/**
 * Haal retry-after header op indien beschikbaar
 * @param {Error} error - De error met response
 * @returns {number|null} - Delay in ms of null
 */
function getRetryAfter(error) {
  if (!error.response?.headers) return null;

  const retryAfter = error.response.headers["retry-after"];
  if (!retryAfter) return null;

  // Kan seconds of HTTP-date zijn
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }

  // Probeer als date te parsen
  const date = new Date(retryAfter);
  if (!isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }

  return null;
}

module.exports = {
  withRetry,
  sleep,
  isGitHubRetryable,
  isOpenAIRetryable,
  getRetryAfter,
};
