const crypto = require('crypto');
const db = require('../config/db');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const { invalidateAssignmentCache, invalidateCourseCache } = require('../services/cachingService');

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
 * Zoek submission op basis van GitHub URL en optioneel branch
 * @param {string} repoFullName - Repository full name (owner/repo)
 * @param {string} branch - Branch naam (optioneel)
 * @returns {Promise<object|null>}
 */
async function findSubmissionByRepo(repoFullName, branch = null) {
  try {
    const githubUrl = `https://github.com/${repoFullName}`;

    // Query zonder branch filter (backwards compatible)
    let query = `
      SELECT
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
      ORDER BY s.updated_at DESC LIMIT 1
    `;

    let result = await db.query(query, [githubUrl]);

    // Fallback: case-insensitive zoeken
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
        ORDER BY s.updated_at DESC LIMIT 1`,
        [githubUrl]
      );
    }

    // Voeg branch toe aan result als het meegegeven is (voor latere gebruik)
    if (result.rows.length > 0) {
      result.rows[0].branch = branch;
    }

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('[API] Error searching submission:', error.message);
    throw error;
  }
}

/**
 * Haal alle submissions op voor een repository (alle branches)
 * @param {string} repoFullName - Repository full name (owner/repo)
 * @returns {Promise<Array>}
 */
async function getSubmissionsByRepo(repoFullName) {
  try {
    const githubUrl = `https://github.com/${repoFullName}`;

    const result = await db.query(
      `SELECT
        s.id,
        s.assignment_id,
        s.user_id,
        s.github_url,
        s.commit_sha,
        s.status,
        s.ai_score,
        s.created_at,
        s.updated_at,
        a.course_id,
        a.title as assignment_title
      FROM submission s
      JOIN assignment a ON s.assignment_id = a.id
      WHERE LOWER(s.github_url) = LOWER($1)
      ORDER BY s.updated_at DESC`,
      [githubUrl]
    );

    return result.rows;
  } catch (error) {
    console.error('[API] Error fetching submissions for repo:', error.message);
    throw error;
  }
}

/**
 * Update submission status en commit SHA
 * @param {number} submissionId - Submission ID
 * @param {string} commitSha - Nieuwe commit SHA
 * @param {string} status - Nieuwe status
 * @param {string} branch - Branch naam (voor logging, niet opgeslagen zonder migration)
 * @returns {Promise<object>}
 */
async function updateSubmissionStatus(submissionId, commitSha, status, branch = null) {
  try {
    // Get old status first for logging
    const oldStatusResult = await db.query(
      'SELECT status, assignment_id, user_id FROM submission WHERE id = $1',
      [submissionId]
    );
    const oldStatus = oldStatusResult.rows[0]?.status;
    const assignmentId = oldStatusResult.rows[0]?.assignment_id;
    const userId = oldStatusResult.rows[0]?.user_id;
    
    // Simpele update zonder branch kolom (backwards compatible)
    const result = await db.query(
      `UPDATE submission
       SET commit_sha = $1, status = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, commit_sha, status, updated_at`,
      [commitSha, status, submissionId]
    );

    // Voeg branch toe aan result voor logging
    if (result.rows[0] && branch) {
      result.rows[0].branch = branch;
    }
    
    // Get course ID for logging
    const courseResult = await db.query(
      'SELECT course_id FROM assignment WHERE id = $1',
      [assignmentId]
    );
    const courseId = courseResult.rows[0]?.course_id;
    
    // Structured event log
    logger.event('submission_status_changed', {
      courseId,
      assignmentId,
      submissionId,
      userId,
      actorId: null,
      oldStatus,
      newStatus: status,
      metadata: {
        commitSha,
        branch: branch || null
      }
    });

    // Invalidate cache for assignment and course statistics
    if (assignmentId) {
      invalidateAssignmentCache(assignmentId);
    }
    if (courseId) {
      invalidateCourseCache(courseId);
    }

    return result.rows[0];
  } catch (error) {
    console.error('[API] Error updating submission:', error.message);
    throw error;
  }
}

/**
 * Atomisch proberen om processing te starten (race condition preventie)
 * Alleen succesvol als submission NIET al in 'processing' status is
 * @param {number} submissionId - Submission ID
 * @param {string} commitSha - Nieuwe commit SHA
 * @param {string} branch - Branch naam (optioneel)
 * @returns {Promise<{success: boolean, submission?: object, alreadyProcessing?: boolean}>}
 */
async function tryStartProcessing(submissionId, commitSha, branch = null) {
  try {
    // Atomic check-and-set: alleen updaten als status NIET 'processing' is
    const result = await db.query(
      `UPDATE submission
       SET commit_sha = $1, status = 'processing', updated_at = NOW()
       WHERE id = $2 AND status != 'processing'
       RETURNING id, commit_sha, status, updated_at`,
      [commitSha, submissionId]
    );

    if (result.rows.length === 0) {
      // Geen rows geüpdatet = submission is al in processing
      return { success: false, alreadyProcessing: true };
    }

    const submission = result.rows[0];
    if (branch) {
      submission.branch = branch;
    }

    return { success: true, submission };
  } catch (error) {
    console.error('[API] Error trying to start processing:', error.message);
    throw error;
  }
}

/**
 * Haal assignment settings op (rubric, guidelines)
 * @param {number} assignmentId - Assignment ID
 * @returns {Promise<object|null>}
 */
async function getAssignmentSettings(assignmentId) {
  try {
    const result = await db.query(
      `SELECT rubric, ai_guidelines
       FROM assignment
       WHERE id = $1`,
      [assignmentId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('[API] Error fetching assignment settings:', error.message);
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

    // Invalidate cache for assignment statistics
    if (assignmentId) {
      invalidateAssignmentCache(assignmentId);
      
      // Get course ID and invalidate course cache too
      const courseResult = await db.query(
        'SELECT course_id FROM assignment WHERE id = $1',
        [assignmentId]
      );
      if (courseResult.rows.length > 0) {
        invalidateCourseCache(courseResult.rows[0].course_id);
      }
    }

    return result.rows[0];
  } catch (error) {
    console.error('[API] Error creating/updating submission:', error.message);
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
  console.log(`[API] WEBHOOK ${timestamp} | ${event} | ${repoFullName} | ${status} | ${message}`);
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
    console.error('[API] Error deleting old feedback:', error.message);
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

    // Get submission and course info for event
    if (savedItems.length > 0) {
      const submissionResult = await db.query(
        `SELECT s.id, s.user_id, s.assignment_id, a.course_id
         FROM submission s
         JOIN assignment a ON s.assignment_id = a.id
         WHERE s.id = $1`,
        [submissionId]
      );
      
      if (submissionResult.rows.length > 0) {
        const sub = submissionResult.rows[0];
        
        // Calculate average severity
        const severityMap = { low: 1, medium: 2, high: 3, critical: 4 };
        const avgSeverity = savedItems.reduce((sum, item) => 
          sum + (severityMap[item.severity] || 0), 0
        ) / savedItems.length;
        
        // Emit real-time event for SSE clients
        notificationService.emitFeedbackAdded(sub.course_id, {
          submissionId: sub.id,
          studentId: sub.user_id,
          assignmentId: sub.assignment_id,
          feedbackCount: savedItems.length,
          avgSeverity: Math.round(avgSeverity * 100) / 100
        });
        
        // Structured event log
        logger.event('feedback_added', {
          courseId: sub.course_id,
          assignmentId: sub.assignment_id,
          submissionId: sub.id,
          userId: sub.user_id,
          actorId: null,
          oldStatus: null,
          newStatus: null,
          metadata: {
            feedbackCount: savedItems.length,
            avgSeverity: Math.round(avgSeverity * 100) / 100,
            reviewer: 'ai'
          }
        });
      }
    }

    return savedItems;
  } catch (error) {
    console.error('[API] Error saving feedback:', error.message);
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
       RETURNING id, commit_sha, ai_score, status, updated_at, assignment_id, user_id`,
      [commitSha, aiScore, status, submissionId]
    );

    const submission = result.rows[0];
    
    // Get course ID for the event
    const courseResult = await db.query(
      'SELECT course_id FROM assignment WHERE id = $1',
      [submission.assignment_id]
    );
    
    if (courseResult.rows.length > 0) {
      const courseId = courseResult.rows[0].course_id;
      
      // Emit real-time event for SSE clients
      notificationService.emitSubmissionAnalyzed(courseId, {
        submissionId: submission.id,
        studentId: submission.user_id,
        assignmentId: submission.assignment_id,
        aiScore: aiScore
      });
      
      // Invalidate cache for assignment and course statistics
      invalidateAssignmentCache(submission.assignment_id);
      invalidateCourseCache(courseId);
      
      // Structured event log
      logger.event('submission_analyzed', {
        courseId,
        assignmentId: submission.assignment_id,
        submissionId: submission.id,
        userId: submission.user_id,
        actorId: null,
        oldStatus: null,
        newStatus: status,
        metadata: {
          aiScore,
          commitSha
        }
      });
    }

    return submission;
  } catch (error) {
    console.error('[API] Error updating submission with score:', error.message);
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
    console.error('[API] Error fetching feedback:', error.message);
    throw error;
  }
}

/**
 * Markeer submission als failed met error details
 * @param {number} submissionId - Submission ID
 * @param {string} commitSha - Commit SHA
 * @param {string} errorMessage - Error bericht
 * @param {string} errorCode - Error code
 * @returns {Promise<object>}
 */
async function markSubmissionFailed(submissionId, commitSha, errorMessage, errorCode = 'UNKNOWN_ERROR') {
  try {
    // We slaan error details op in een JSON string in de status kolom
    // Format: "failed:ERROR_CODE:message"
    const statusWithError = `failed`;

    const result = await db.query(
      `UPDATE submission
       SET commit_sha = $1, status = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, commit_sha, status, updated_at`,
      [commitSha, statusWithError, submissionId]
    );

    // Log de error voor debugging
    console.error(`[API] Submission ${submissionId} failed: ${errorCode} - ${errorMessage}`);

    return result.rows[0];
  } catch (error) {
    console.error('[API] Error marking submission as failed:', error.message);
    throw error;
  }
}

/**
 * Haal failed submissions op die opnieuw geprobeerd kunnen worden
 * @param {number} maxAge - Maximum leeftijd in uren (default: 24)
 * @returns {Promise<Array>}
 */
async function getFailedSubmissions(maxAge = 24) {
  try {
    // Valideer maxAge is een nummer tussen 1 en 168 (1 week)
    const safeMaxAge = Math.min(Math.max(parseInt(maxAge) || 24, 1), 168);

    const result = await db.query(
      `SELECT
        s.id,
        s.assignment_id,
        s.user_id,
        s.github_url,
        s.commit_sha,
        s.status,
        s.webhook_secret,
        s.updated_at,
        a.course_id
      FROM submission s
      JOIN assignment a ON s.assignment_id = a.id
      WHERE s.status = 'failed'
        AND s.updated_at > NOW() - INTERVAL '1 hour' * $1
      ORDER BY s.updated_at DESC`,
      [safeMaxAge]
    );

    return result.rows;
  } catch (error) {
    console.error('[API] Error fetching failed submissions:', error.message);
    throw error;
  }
}

/**
 * Haal submission op by ID voor retry
 * @param {number} submissionId - Submission ID
 * @returns {Promise<object|null>}
 */
async function getSubmissionForRetry(submissionId) {
  try {
    const result = await db.query(
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
      WHERE s.id = $1`,
      [submissionId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('[API] Error fetching submission for retry:', error.message);
    throw error;
  }
}

module.exports = {
  verifyWebhookSignature,
  findSubmissionByRepo,
  getSubmissionsByRepo,
  updateSubmissionStatus,
  tryStartProcessing,
  getAssignmentSettings,
  createOrUpdateSubmission,
  logWebhookEvent,
  saveFeedback,
  updateSubmissionWithScore,
  getFeedbackBySubmission,
  deletePreviousFeedback,
  markSubmissionFailed,
  getFailedSubmissions,
  getSubmissionForRetry
};