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

/**
 * Verwijder oude feedback voor een submission (bij re-analyse)
 * @param {number} submissionId - Submission ID
 * @returns {Promise<number>} - Aantal verwijderde records
 */
async function deletePreviousFeedback(submissionId) {
  try {
    const result = await db.query(
      `DELETE FROM feedback WHERE submission_id = $1 AND reviewer = 'ai'`,
      [submissionId]
    );
    return result.rowCount;
  } catch (error) {
    console.error('Fout bij verwijderen oude feedback:', error);
    throw error;
  }
}

/**
 * Sla AI feedback op in de database
 * @param {number} submissionId - Submission ID
 * @param {Array} feedbackItems - Array van feedback objecten
 * @returns {Promise<Array>} - Opgeslagen feedback records
 */
async function saveFeedback(submissionId, feedbackItems) {
  if (!feedbackItems || feedbackItems.length === 0) {
    return [];
  }

  try {
    // Verwijder eerst oude AI feedback
    await deletePreviousFeedback(submissionId);

    // Insert alle nieuwe feedback items
    const savedItems = [];

    for (const item of feedbackItems) {
      const result = await db.query(
        `INSERT INTO feedback (submission_id, content, reviewer, severity, line_number, suggestion, type)
         VALUES ($1, $2, 'ai', $3, $4, $5, $6)
         RETURNING id, submission_id, content, reviewer, severity, line_number, suggestion, type, created_at`,
        [
          submissionId,
          item.content,
          item.severity || 'low',
          item.line_number || null,
          item.suggestion || null,
          item.type || 'code_quality'
        ]
      );
      savedItems.push(result.rows[0]);
    }

    return savedItems;
  } catch (error) {
    console.error('Fout bij opslaan feedback:', error);
    throw error;
  }
}

/**
 * Update submission met AI score en status
 * @param {number} submissionId - Submission ID
 * @param {string} commitSha - Commit SHA
 * @param {number} aiScore - AI score (0-100)
 * @param {string} status - Nieuwe status
 * @returns {Promise<object>}
 */
async function updateSubmissionWithScore(submissionId, commitSha, aiScore, status) {
  try {
    const result = await db.query(
      `UPDATE submission
       SET commit_sha = $1, ai_score = $2, status = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING id, commit_sha, ai_score, status, updated_at`,
      [commitSha, aiScore, status, submissionId]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Fout bij updaten submission met score:', error);
    throw error;
  }
}

/**
 * Haal feedback op voor een submission
 * @param {number} submissionId - Submission ID
 * @param {object} filters - Filter opties
 * @param {string} filters.reviewer - Filter op reviewer: 'ai', 'teacher', 'all'
 * @param {string} filters.severity - Filter op severity
 * @returns {Promise<Array>}
 */
async function getFeedbackBySubmission(submissionId, filters = {}) {
  try {
    const { reviewer = 'all', severity } = filters;
    const params = [submissionId];
    let paramIndex = 2;

    let query = `
      SELECT id, submission_id, content, reviewer, severity, line_number, suggestion, type, created_at
      FROM feedback
      WHERE submission_id = $1
    `;

    // Filter op reviewer
    if (reviewer !== 'all') {
      query += ` AND reviewer = $${paramIndex}`;
      params.push(reviewer);
      paramIndex++;
    }

    // Filter op severity
    if (severity) {
      query += ` AND severity = $${paramIndex}`;
      params.push(severity);
    }

    query += ` ORDER BY severity DESC, line_number ASC NULLS LAST, created_at ASC`;

    const result = await db.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Fout bij ophalen feedback:', error);
    throw error;
  }
}

module.exports = {
  verifyWebhookSignature,
  findSubmissionByRepo,
  updateSubmissionStatus,
  getCourseSettings,
  createOrUpdateSubmission,
  logWebhookEvent,
  saveFeedback,
  updateSubmissionWithScore,
  getFeedbackBySubmission,
  deletePreviousFeedback
};
