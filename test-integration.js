#!/usr/bin/env node
/**
 * Integration Test Script
 *
 * Tests the full flow against real APIs and database:
 * 1. GitHub API access
 * 2. OpenAI API access
 * 3. Database connectivity
 * 4. Full webhook/AI analysis flow
 *
 * Usage: node test-integration.js
 *
 * Requires environment variables:
 * - DATABASE_URL
 * - OPENAI_API_KEY
 * - GITHUB_TOKEN (optional, for rate limiting)
 */

require('dotenv').config();

const axios = require('axios');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function success(message) {
  log(`✓ ${message}`, 'green');
}

function error(message) {
  log(`✗ ${message}`, 'red');
}

function info(message) {
  log(`  ${message}`, 'dim');
}

function header(message) {
  console.log();
  log(`═══ ${message} ═══`, 'blue');
}

// Track test results
const results = {
  passed: 0,
  failed: 0,
  skipped: 0
};

async function runTest(name, testFn) {
  try {
    await testFn();
    success(name);
    results.passed++;
    return true;
  } catch (err) {
    error(`${name}`);
    info(`Error: ${err.message}`);
    results.failed++;
    return false;
  }
}

// ============================================
// Environment Variable Tests
// ============================================
async function testEnvironmentVariables() {
  header('Environment Variables');

  await runTest('DATABASE_URL is set', async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL not found in environment');
    }
  });

  await runTest('OPENAI_API_KEY is set', async () => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not found in environment');
    }
  });

  await runTest('GITHUB_TOKEN is set (optional)', async () => {
    if (!process.env.GITHUB_TOKEN) {
      log('  ⚠ GITHUB_TOKEN not set - rate limiting may occur', 'yellow');
      results.skipped++;
      results.passed--; // Don't count as pass
    }
  });
}

// ============================================
// Database Tests
// ============================================
async function testDatabase() {
  header('Database Connectivity');

  const pool = require('./src/config/db');

  await runTest('Database connection works', async () => {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as time');
    client.release();
    if (!result.rows[0].time) {
      throw new Error('No timestamp returned');
    }
    info(`Server time: ${result.rows[0].time}`);
  });

  await runTest('User table exists', async () => {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'user'
      )
    `);
    if (!result.rows[0].exists) {
      throw new Error('User table not found');
    }
  });

  await runTest('Submission table exists', async () => {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'submission'
      )
    `);
    if (!result.rows[0].exists) {
      throw new Error('Submission table not found');
    }
  });

  await runTest('Feedback table exists', async () => {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'feedback'
      )
    `);
    if (!result.rows[0].exists) {
      throw new Error('Feedback table not found');
    }
  });

  await runTest('Course table exists', async () => {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'course'
      )
    `);
    if (!result.rows[0].exists) {
      throw new Error('Course table not found');
    }
  });

  await runTest('Assignment table exists', async () => {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'assignment'
      )
    `);
    if (!result.rows[0].exists) {
      throw new Error('Assignment table not found');
    }
  });

  // Check for test data
  await runTest('At least one student exists', async () => {
    const result = await pool.query(`
      SELECT COUNT(*) as count FROM "user" WHERE role = 'student'
    `);
    if (parseInt(result.rows[0].count) === 0) {
      throw new Error('No students found in database');
    }
    info(`Found ${result.rows[0].count} students`);
  });

  await runTest('At least one course exists', async () => {
    const result = await pool.query(`SELECT COUNT(*) as count FROM course`);
    if (parseInt(result.rows[0].count) === 0) {
      throw new Error('No courses found in database');
    }
    info(`Found ${result.rows[0].count} courses`);
  });

  await runTest('At least one assignment exists', async () => {
    const result = await pool.query(`SELECT COUNT(*) as count FROM assignment`);
    if (parseInt(result.rows[0].count) === 0) {
      throw new Error('No assignments found in database');
    }
    info(`Found ${result.rows[0].count} assignments`);
  });
}

// ============================================
// GitHub API Tests
// ============================================
async function testGitHubAPI() {
  header('GitHub API');

  const {
    checkRepositoryAccess,
    getLatestCommitSha,
    getRepositoryTree,
    filterCodeFiles
  } = require('./src/services/githubService');

  // Use a well-known public repo for testing
  const testOwner = 'expressjs';
  const testRepo = 'express';

  await runTest('Can access public repository', async () => {
    const result = await checkRepositoryAccess(testOwner, testRepo);
    if (!result.accessible) {
      throw new Error(result.error || 'Repository not accessible');
    }
    info(`Found: ${result.repoData.full_name}, branch: ${result.repoData.default_branch}`);
  });

  let commitSha = null;
  await runTest('Can get latest commit SHA', async () => {
    const result = await getLatestCommitSha(testOwner, testRepo);
    if (!result.success) {
      throw new Error(result.error || 'Could not get commit SHA');
    }
    commitSha = result.sha;
    info(`Latest commit: ${commitSha.substring(0, 7)}`);
  });

  await runTest('Can get repository tree', async () => {
    if (!commitSha) {
      throw new Error('No commit SHA available');
    }
    const result = await getRepositoryTree(testOwner, testRepo, commitSha);
    if (!result.success) {
      throw new Error(result.error || 'Could not get tree');
    }
    info(`Found ${result.files.length} files`);
  });

  await runTest('File filtering works correctly', async () => {
    const testFiles = [
      { path: 'src/index.js' },
      { path: 'node_modules/test.js' },
      { path: 'README.md' },
      { path: 'image.png' }
    ];
    const filtered = filterCodeFiles(testFiles);
    // Should include index.js and README.md, exclude node_modules and image.png
    if (filtered.length !== 2) {
      throw new Error(`Expected 2 files, got ${filtered.length}`);
    }
    info(`Filtered ${testFiles.length} files to ${filtered.length} code files`);
  });

  await runTest('Handles non-existent repository', async () => {
    const result = await checkRepositoryAccess('nonexistent-owner-12345', 'nonexistent-repo-12345');
    if (result.accessible) {
      throw new Error('Should not be accessible');
    }
    if (result.errorCode !== 'REPO_NOT_FOUND') {
      throw new Error(`Expected REPO_NOT_FOUND, got ${result.errorCode}`);
    }
  });
}

// ============================================
// OpenAI API Tests
// ============================================
async function testOpenAIAPI() {
  header('OpenAI API');

  const { analyzeFile, calculateScore, OPENAI_MODEL } = require('./src/services/aiService');

  await runTest(`Using model: ${OPENAI_MODEL}`, async () => {
    // Just checking the constant
    if (!OPENAI_MODEL) {
      throw new Error('Model not defined');
    }
  });

  await runTest('Can analyze simple code', async () => {
    const testCode = `
function add(a, b) {
  return a + b;
}
`;
    const feedback = await analyzeFile('test.js', testCode, 'javascript', {});
    // Should return array (even if empty for good code)
    if (!Array.isArray(feedback)) {
      throw new Error('Feedback should be an array');
    }
    info(`Received ${feedback.length} feedback items`);
  });

  await runTest('Can analyze code with issues', async () => {
    const badCode = `
function doSomething(x) {
  var y = x + 1
  if(y == "5") {
    console.log(y)
  }
  return y
}
`;
    const feedback = await analyzeFile('bad.js', badCode, 'javascript', {});
    if (!Array.isArray(feedback)) {
      throw new Error('Feedback should be an array');
    }
    // Should find some issues (== instead of ===, missing semicolons, etc.)
    info(`Received ${feedback.length} feedback items for problematic code`);
    if (feedback.length > 0) {
      info(`First issue: [${feedback[0].severity}] ${feedback[0].type}`);
    }
  });

  await runTest('Score calculation works', async () => {
    const feedback = [
      { severity: 'critical' },  // -20
      { severity: 'high' },      // -10
      { severity: 'medium' }     // -5
    ];
    const score = calculateScore(feedback);
    if (score !== 65) {
      throw new Error(`Expected score 65, got ${score}`);
    }
    info(`Score: ${score}/100`);
  });

  await runTest('Empty feedback gives score 100', async () => {
    const score = calculateScore([]);
    if (score !== 100) {
      throw new Error(`Expected score 100, got ${score}`);
    }
  });
}

// ============================================
// Full Flow Test (HTTP endpoints)
// ============================================
async function testHTTPEndpoints() {
  header('HTTP Endpoints (requires running server)');

  const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';

  info(`Testing against: ${baseUrl}`);

  await runTest('Health endpoint responds', async () => {
    try {
      const response = await axios.get(`${baseUrl}/health`, { timeout: 5000 });
      if (response.data.status !== 'OK') {
        throw new Error('Health check failed');
      }
      info(`Server uptime: ${Math.round(response.data.uptime)}s`);
    } catch (err) {
      if (err.code === 'ECONNREFUSED') {
        throw new Error(`Server not running at ${baseUrl}`);
      }
      throw err;
    }
  });

  await runTest('Direct test endpoint works', async () => {
    try {
      const response = await axios.post(
        `${baseUrl}/api/webhooks/test`,
        { github_url: 'https://github.com/expressjs/express' },
        { timeout: 120000 } // 2 minute timeout for AI analysis
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Test failed');
      }

      info(`Analyzed: ${response.data.data.repository}`);
      info(`Files: ${response.data.data.files_analyzed}`);
      info(`Score: ${response.data.data.score}/100`);
      info(`Feedback items: ${response.data.data.feedback.length}`);
    } catch (err) {
      if (err.code === 'ECONNREFUSED') {
        throw new Error(`Server not running at ${baseUrl}`);
      }
      throw err;
    }
  });
}

// ============================================
// Main
// ============================================
async function main() {
  console.log();
  log('╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║       StuReflect Backend - Integration Tests               ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');

  const startTime = Date.now();

  try {
    // Run test groups
    await testEnvironmentVariables();
    await testDatabase();
    await testGitHubAPI();
    await testOpenAIAPI();

    // Only run HTTP tests if server is specified
    if (process.env.BACKEND_URL || process.argv.includes('--with-server')) {
      await testHTTPEndpoints();
    } else {
      header('HTTP Endpoints');
      log('  ⚠ Skipped - set BACKEND_URL or use --with-server flag', 'yellow');
      results.skipped += 2;
    }

  } catch (err) {
    error(`Unexpected error: ${err.message}`);
    console.error(err);
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log();
  log('════════════════════════════════════════════════════════════', 'blue');
  console.log();

  if (results.failed === 0) {
    log(`All tests passed! (${results.passed} passed, ${results.skipped} skipped)`, 'green');
  } else {
    log(`Tests completed with failures`, 'red');
    log(`  Passed:  ${results.passed}`, 'green');
    log(`  Failed:  ${results.failed}`, 'red');
    log(`  Skipped: ${results.skipped}`, 'yellow');
  }

  console.log();
  info(`Duration: ${duration}s`);
  console.log();

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

main();
