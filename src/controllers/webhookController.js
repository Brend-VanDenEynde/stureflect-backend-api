const crypto = require('crypto');
const db = require('../config/db');

/**
 * Valideer GitHub webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - X-Hub-Signature-256 header
 * @param {string} secret - Webhook secret
 * @returns {boolean}
 */
function verifyWebhookSignature(payload, signature, secret) {
  if (!signature || !secret) {
    return false;
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    return false;
  }
}

/**
 * Zoek submission op basis van GitHub URL
 * @param {string} repoFullName - Repository full name (owner/repo)
 * @returns {Promise<object|null>}
 */
async function findSubmissionByRepo(repoFullName) {
  try {
    const githubUrl = `https://github.com/${repoFullName}`;

    // Zoek eerst exact match, dan case-insensitive als fallback
    let result = await db.query(
      `SELECT
        s.id,
        s.assignment_id,
        s.user_id,
        s.github_url,
        s.commit_sha,
        s.status,
        s.webhook_secret,
        a.course_id
      FROM submission s
      JOIN assignment a ON s.assignment_id = a.id
      WHERE s.github_url = $1
      ORDER BY s.created_at DESC
      LIMIT 1`,
      [githubUrl]
    );

    // Fallback: case-insensitive zoeken (voor oude data of variaties)
    if (result.rows.length === 0) {
      result = await db.query(
        `SELECT
          s.id,
          s.assignment_id,
          s.user_id,
          s.github_url,
          s.commit_sha,
          s.status,
          s.webhook_secret,
          a.course_id
        FROM submission s
        JOIN assignment a ON s.assignment_id = a.id
        WHERE LOWER(s.github_url) = LOWER($1)
        ORDER BY s.created_at DESC
        LIMIT 1`,
        [githubUrl]
      );
    }

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Fout bij zoeken submission:', error);
    throw error;
  }
}

/**
 * Update submission status en commit SHA
 * @param {number} submissionId - Submission ID
 * @param {string} commitSha - Nieuwe commit SHA
 * @param {string} status - Nieuwe status
 * @returns {Promise<object>}
 */
async function updateSubmissionStatus(submissionId, commitSha, status) {
  try {
    const result = await db.query(
      `UPDATE submission
       SET commit_sha = $1, status = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, commit_sha, status, updated_at`,
      [commitSha, status, submissionId]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Fout bij updaten submission:', error);
    throw error;
  }
}

/**
 * Haal course settings op (rubric, guidelines)
 * @param {number} courseId - Course ID
 * @returns {Promise<object|null>}
 */
async function getCourseSettings(courseId) {
  try {
    const result = await db.query(
      `SELECT rubric, ai_guidelines
       FROM course_settings
       WHERE course_id = $1`,
      [courseId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('Fout bij ophalen course settings:', error);
    throw error;
  }
}

/**
 * Maak een nieuwe submission aan of update bestaande voor nieuwe commit
 * @param {number} assignmentId - Assignment ID
 * @param {number} userId - User ID
 * @param {string} githubUrl - GitHub URL
 * @param {string} commitSha - Commit SHA
 * @returns {Promise<object>}
 */
async function createOrUpdateSubmission(assignmentId, userId, githubUrl, commitSha) {
  try {
    // Probeer eerst te updaten, anders insert
    const result = await db.query(
      `INSERT INTO submission (assignment_id, user_id, github_url, commit_sha, status)
       VALUES ($1, $2, $3, $4, 'processing')
       ON CONFLICT (assignment_id, user_id, commit_sha)
       DO UPDATE SET status = 'processing', updated_at = NOW()
       RETURNING id, assignment_id, user_id, github_url, commit_sha, status`,
      [assignmentId, userId, githubUrl, commitSha]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Fout bij aanmaken/updaten submission:', error);
    throw error;
  }
}

/**
 * Log webhook event voor debugging
 * @param {string} event - Event type
 * @param {string} repoFullName - Repository name
 * @param {string} status - Status (success, error, skipped)
 * @param {string} message - Log message
 */
function logWebhookEvent(event, repoFullName, status, message) {
  const timestamp = new Date().toISOString();
  console.log(`[WEBHOOK ${timestamp}] ${event} | ${repoFullName} | ${status} | ${message}`);
}

module.exports = {
  verifyWebhookSignature,
  findSubmissionByRepo,
  updateSubmissionStatus,
  getCourseSettings,
  createOrUpdateSubmission,
  logWebhookEvent
};
