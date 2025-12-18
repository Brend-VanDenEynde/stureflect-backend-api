/**
 * Centralized logging utility voor StuReflect Backend
 * Gebruik deze logger voor consistente en gestructureerde logs
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

const getTimestamp = () => new Date().toISOString();

const logger = {
  // Info logging
  info: (category, message, data = null) => {
    console.log(`${colors.blue}[INFO] [${getTimestamp()}] [${category}]${colors.reset} ${message}`);
    if (data) console.log('[INFO]    Data:', JSON.stringify(data, null, 2));
  },

  // Success logging
  success: (category, message, data = null) => {
    console.log(`${colors.green}[SUCCESS] [${getTimestamp()}] [${category}]${colors.reset} ${message}`);
    if (data) console.log('[SUCCESS]    Data:', JSON.stringify(data, null, 2));
  },

  // Warning logging
  warn: (category, message, data = null) => {
    console.warn(`${colors.yellow}[WARNING] [${getTimestamp()}] [${category}]${colors.reset} ${message}`);
    if (data) console.warn('[WARNING]    Data:', JSON.stringify(data, null, 2));
  },

  // Error logging
  error: (category, message, error = null) => {
    console.error(`${colors.red}[ERROR] [${getTimestamp()}] [${category}]${colors.reset} ${message}`);
    if (error) {
      console.error('[ERROR]    Error:', error.message);
      // Stack traces removed for security - only in development mode
      if (process.env.NODE_ENV === 'development' && error.stack) {
        console.error('[ERROR]    Stack:', error.stack);
      }
      if (error.code) console.error('[ERROR]    Code:', error.code);
    }
  },

  // Debug logging (alleen in development)
  debug: (category, message, data = null) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`${colors.magenta}[DEBUG] [${getTimestamp()}] [${category}]${colors.reset} ${message}`);
      if (data) console.log('[DEBUG]    Data:', JSON.stringify(data, null, 2));
    }
  },

  // HTTP Request logging
  request: (method, url, statusCode, duration = null) => {
    const statusPrefix = statusCode >= 400 ? '[ERROR]' : statusCode >= 300 ? '[INFO]' : '[SUCCESS]';
    const durationStr = duration ? ` (${duration}ms)` : '';
    console.log(`${colors.cyan}[REQUEST] [${getTimestamp()}] [HTTP]${colors.reset} ${method} ${url} ${statusPrefix} ${statusCode}${durationStr}`);
  },

  // Database query logging
  query: (operation, table, duration = null) => {
    const durationStr = duration ? ` (${duration}ms)` : '';
    console.log(`${colors.cyan}[QUERY] [${getTimestamp()}] [DB]${colors.reset} ${operation} on ${table}${durationStr}`);
  },

  // Authentication logging
  auth: (action, userId, success = true) => {
    const prefix = success ? '[SUCCESS]' : '[ERROR]';
    const color = success ? colors.green : colors.red;
    console.log(`${color}[AUTH] [${getTimestamp()}]${colors.reset} ${action} for user ${userId} - ${success ? 'SUCCESS' : 'FAILED'}`);
  },

  // Separator voor visuele structuur
  separator: (title = '') => {
    console.log('\n' + '='.repeat(50));
    if (title) console.log(`${colors.bright}${title}${colors.reset}`);
    console.log('='.repeat(50) + '\n');
  },

  // Structured event logging voor audit trails
  event: (eventType, data) => {
    const logEntry = {
      timestamp: getTimestamp(),
      level: 'EVENT',
      event: eventType,
      ...data
    };
    
    console.log(JSON.stringify(logEntry));
  }
};

module.exports = logger;
