const db = require('../config/db');

/**
 * Haal alle cursussen op waar de student is ingeschreven
 * @param {number} studentId - ID van de student
 * @returns {Promise<Array>}
 */
async function getStudentCourses(studentId) {
  try {
    const result = await db.query(
      `SELECT
        c.id,
        c.title,
        c.description,
        COUNT(a.id) as assignment_count
      FROM course c
      JOIN enrollment e ON c.id = e.course_id
      LEFT JOIN assignment a ON c.id = a.course_id
      WHERE e.user_id = $1
      GROUP BY c.id, c.title, c.description
      ORDER BY c.title ASC`,
      [studentId]
    );
    return result.rows;
  } catch (error) {
    console.error('[API] Error fetching student courses:', error.message);
    throw error;
  }
}

/**
 * Haal alle opdrachten op voor een cursus met submission status
 * @param {number} studentId - ID van de student
 * @param {number} courseId - ID van de cursus
 * @param {object} options - Filter en sort opties
 * @param {string} options.status - Filter op status: 'submitted', 'pending', 'all'
 * @param {string} options.sortBy - Sorteer op: 'due_date', 'title', 'created_at'
 * @param {string} options.order - Sorteerrichting: 'asc', 'desc'
 * @returns {Promise<Array>}
 */
async function getCourseAssignments(studentId, courseId, options = {}) {
  try {
    const { status = 'all', sortBy = 'due_date', order = 'asc' } = options;

    // Valideer sortBy en order om SQL injection te voorkomen
    const validSortFields = ['due_date', 'title', 'created_at'];
    const validOrders = ['asc', 'desc'];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'due_date';
    const safeOrder = order && validOrders.includes(order.toLowerCase()) ? order.toUpperCase() : 'ASC';

    let query = `
      SELECT
        a.id,
        a.title,
        a.description,
        a.due_date,
        a.created_at,
        s.id as submission_id,
        CASE
          WHEN s.id IS NOT NULL THEN 'submitted'
          ELSE 'pending'
        END as submission_status
      FROM assignment a
      LEFT JOIN submission s ON a.id = s.assignment_id AND s.user_id = $1
      WHERE a.course_id = $2
    `;

    // Filter op status
    if (status === 'submitted') {
      query += ' AND s.id IS NOT NULL';
    } else if (status === 'pending') {
      query += ' AND s.id IS NULL';
    }

    // Sorteer
    query += ` ORDER BY a.${safeSortBy} ${safeOrder}`;

    const result = await db.query(query, [studentId, courseId]);
    return result.rows;
  } catch (error) {
    console.error('[API] Error fetching course assignments:', error.message);
    throw error;
  }
}

/**
 * Haal alle submissions op van een student
 * @param {number} studentId - ID van de student
 * @param {object} filters - Filter opties
 * @param {number} filters.courseId - Filter op cursus (optioneel)
 * @param {string} filters.status - Filter op status: 'pending', 'completed', 'graded' (optioneel)
 * @param {string} filters.branch - Filter op branch naam (optioneel)
 * @returns {Promise<Array>}
 */
async function getStudentSubmissions(studentId, filters = {}) {
  try {
    const { courseId, status } = filters;
    const params = [studentId];
    let paramIndex = 2;

    let query = `
      SELECT
        s.id,
        s.assignment_id,
        a.title as assignment_title,
        c.id as course_id,
        c.title as course_title,
        s.github_url,
        s.commit_sha,
        s.status,
        s.ai_score,
        s.manual_score,
        s.created_at,
        s.updated_at,
        a.due_date
      FROM submission s
      JOIN assignment a ON s.assignment_id = a.id
      JOIN course c ON a.course_id = c.id
      WHERE s.user_id = $1
    `;

    // Filter op courseId
    if (courseId) {
      query += ` AND c.id = $${paramIndex}`;
      params.push(courseId);
      paramIndex++;
    }

    // Filter op status (whitelist validation)
    const validStatuses = ['pending', 'completed', 'graded', 'processing', 'analyzed', 'failed'];
    if (status && validStatuses.includes(status)) {
      query += ` AND s.status = $${paramIndex}`;
      params.push(status);
    }

    query += ` ORDER BY s.updated_at DESC`;

    const result = await db.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('[API] Error fetching student submissions:', error.message);
    throw error;
  }
}

/**
 * Haal detail van een specifieke submission op inclusief feedback
 * @param {number} submissionId - ID van de submission
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function getSubmissionDetail(submissionId) {
  try {
    // Haal submission, assignment en course op
    const submissionResult = await db.query(
      `SELECT
        s.id,
        s.github_url,
        s.commit_sha,
        s.status,
        s.ai_score,
        s.manual_score,
        s.user_id,
        s.created_at,
        s.updated_at,
        a.id as assignment_id,
        a.title as assignment_title,
        a.description as assignment_description,
        a.due_date,
        c.id as course_id,
        c.title as course_title
      FROM submission s
      JOIN assignment a ON s.assignment_id = a.id
      JOIN course c ON a.course_id = c.id
      WHERE s.id = $1`,
      [submissionId]
    );

    if (submissionResult.rows.length === 0) {
      return { success: false, error: 'NOT_FOUND' };
    }

    // Haal feedback op
    const feedbackResult = await db.query(
      `SELECT
        id,
        submission_id,
        content,
        reviewer,
        severity,
        line_number,
        suggestion,
        type,
        created_at
      FROM feedback
      WHERE submission_id = $1
      ORDER BY severity DESC, line_number ASC NULLS LAST, created_at ASC`,
      [submissionId]
    );

    const row = submissionResult.rows[0];
    return {
      success: true,
      data: {
        submission: {
          id: row.id,
          github_url: row.github_url,
          commit_sha: row.commit_sha,
          status: row.status,
          ai_score: row.ai_score,
          manual_score: row.manual_score,
          user_id: row.user_id,
          created_at: row.created_at,
          updated_at: row.updated_at
        },
        assignment: {
          id: row.assignment_id,
          title: row.assignment_title,
          description: row.assignment_description,
          due_date: row.due_date
        },
        course: {
          id: row.course_id,
          title: row.course_title
        },
        feedback: feedbackResult.rows
      }
    };
  } catch (error) {
    console.error('[API] Error fetching submission detail:', error.message);
    throw error;
  }
}

/**
 * Controleer of een student is ingeschreven in een cursus
 * @param {number} studentId - ID van de student
 * @param {number} courseId - ID van de cursus
 * @returns {Promise<boolean>}
 */
async function isStudentEnrolledInCourse(studentId, courseId) {
  try {
    const result = await db.query(
      'SELECT id FROM enrollment WHERE user_id = $1 AND course_id = $2',
      [studentId, courseId]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('[API] Error checking enrollment:', error.message);
    throw error;
  }
}

/**
 * Haal een assignment op met course info
 * @param {number} assignmentId - ID van de assignment
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function getAssignmentWithCourse(assignmentId) {
  try {
    const result = await db.query(
      `SELECT
        a.id,
        a.title,
        a.description,
        a.due_date,
        a.course_id,
        c.title as course_title
      FROM assignment a
      JOIN course c ON a.course_id = c.id
      WHERE a.id = $1`,
      [assignmentId]
    );
    if (result.rows.length === 0) {
      return { success: false, error: 'NOT_FOUND' };
    }
    return { success: true, data: result.rows[0] };
  } catch (error) {
    console.error('[API] Error fetching assignment:', error.message);
    throw error;
  }
}

/**
 * Check of een student al een submission heeft voor een assignment
 * @param {number} studentId - ID van de student
 * @param {number} assignmentId - ID van de assignment
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function getExistingSubmission(studentId, assignmentId) {
  try {
    const result = await db.query(
      `SELECT id, github_url, commit_sha, status, created_at
       FROM submission
       WHERE user_id = $1 AND assignment_id = $2`,
      [studentId, assignmentId]
    );
    if (result.rows.length === 0) {
      return { success: false, error: 'NOT_FOUND' };
    }
    return { success: true, data: result.rows[0] };
  } catch (error) {
    console.error('[API] Error checking existing submission:', error.message);
    throw error;
  }
}

/**
 * Maak een nieuwe submission aan
 * @param {object} data - Submission data
 * @param {number} data.assignmentId - ID van de assignment
 * @param {number} data.userId - ID van de student
 * @param {string} data.githubUrl - GitHub repository URL
 * @param {string} data.commitSha - Commit SHA
 * @returns {Promise<object>} - Aangemaakte submission
 */
async function createSubmission({ assignmentId, userId, githubUrl, commitSha }) {
  try {
    const result = await db.query(
      `INSERT INTO submission (assignment_id, user_id, github_url, commit_sha, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, assignment_id, user_id, github_url, commit_sha, status, created_at`,
      [assignmentId, userId, githubUrl, commitSha]
    );
    return result.rows[0];
  } catch (error) {
    console.error('[API] Error creating submission:', error.message);
    throw error;
  }
}

/**
 * Update submission met webhook informatie
 * @param {number} submissionId - ID van de submission
 * @param {string} webhookId - GitHub webhook ID
 * @param {string} webhookSecret - Webhook secret voor signature verificatie
 * @returns {Promise<object>} - Bijgewerkte submission
 */
async function updateSubmissionWebhook(submissionId, webhookId, webhookSecret) {
  try {
    const result = await db.query(
      `UPDATE submission
       SET webhook_id = $1, webhook_secret = $2
       WHERE id = $3
       RETURNING id, webhook_id, webhook_secret`,
      [webhookId, webhookSecret, submissionId]
    );
    return result.rows[0];
  } catch (error) {
    console.error('[API] Error updating submission webhook:', error.message);
    throw error;
  }
}

/**
 * Schrijf een student in voor een cursus met join code
 * @param {number} studentId - ID van de student
 * @param {string} joinCode - Join code van de cursus
 * @returns {Promise<object>} - Object met resultaat: { success, course, error }
 */
async function joinCourseByCode(studentId, joinCode) {
  try {
    // Zoek cursus op basis van join code
    const courseResult = await db.query(
      'SELECT id, title, description FROM course WHERE join_code = $1',
      [joinCode]
    );

    if (courseResult.rows.length === 0) {
      return { success: false, error: 'INVALID_JOIN_CODE' };
    }

    const course = courseResult.rows[0];

    // Controleer of student al ingeschreven is
    const enrollmentCheck = await db.query(
      'SELECT id FROM enrollment WHERE user_id = $1 AND course_id = $2',
      [studentId, course.id]
    );

    if (enrollmentCheck.rows.length > 0) {
      return { success: false, error: 'ALREADY_ENROLLED', course };
    }

    // Schrijf student in
    await db.query(
      'INSERT INTO enrollment (course_id, user_id, created_at) VALUES ($1, $2, NOW())',
      [course.id, studentId]
    );

    return { success: true, course };
  } catch (error) {
    // Vang duplicate key violation op (race condition)
    if (error.code === '23505' && error.constraint === 'enrollment_course_id_user_id_key') {
      // Haal course opnieuw op voor response
      const courseResult = await db.query(
        'SELECT id, title, description FROM course WHERE join_code = $1',
        [joinCode]
      );
      return { success: false, error: 'ALREADY_ENROLLED', course: courseResult.rows[0] };
    }
    console.error('Fout bij inschrijven met join code:', error);
    throw error;
  }
}

/**
 * Update een submission met nieuwe GitHub repository URL
 * @param {number} submissionId - ID van de submission
 * @param {number} studentId - ID van de student (voor autorisatie)
 * @param {string} githubUrl - Nieuwe GitHub repository URL
 * @param {string} commitSha - Nieuwe commit SHA
 * @returns {Promise<object>} - Object met resultaat: { success, submission, oldWebhookInfo, error }
 */
async function updateSubmission(submissionId, studentId, githubUrl, commitSha) {
  try {
    // Haal bestaande submission op
    const existingResult = await db.query(
      `SELECT id, user_id, assignment_id, github_url, webhook_id
       FROM submission
       WHERE id = $1`,
      [submissionId]
    );

    if (existingResult.rows.length === 0) {
      return { success: false, error: 'NOT_FOUND' };
    }

    const existing = existingResult.rows[0];

    // Autorisatie check
    if (existing.user_id !== studentId) {
      return { success: false, error: 'FORBIDDEN' };
    }

    // Parse oude URL voor webhook verwijdering
    let oldWebhookInfo = null;
    if (existing.webhook_id && existing.github_url) {
      const oldUrlMatch = existing.github_url.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (oldUrlMatch) {
        oldWebhookInfo = {
          webhookId: existing.webhook_id,
          owner: oldUrlMatch[1],
          repo: oldUrlMatch[2].replace(/\.git$/, '')
        };
      }
    }

    // Update submission
    const updateResult = await db.query(
      `UPDATE submission
       SET github_url = $1, commit_sha = $2, status = 'pending', updated_at = NOW()
       WHERE id = $3
       RETURNING id, assignment_id, user_id, github_url, commit_sha, status, created_at, updated_at`,
      [githubUrl, commitSha, submissionId]
    );

    return {
      success: true,
      submission: updateResult.rows[0],
      oldWebhookInfo
    };
  } catch (error) {
    console.error('Fout bij updaten submission:', error);
    throw error;
  }
}

/**
 * Haal assignment details op met course context en submission status
 * @param {number} assignmentId - ID van de assignment
 * @param {number} studentId - ID van de student
 * @returns {Promise<object>} - Object met resultaat: { success, data, error }
 */
async function getAssignmentDetail(assignmentId, studentId) {
  try {
    // Haal assignment op met enrollment check in dezelfde query
    // Dit voorkomt information leakage (niet onthullen of assignment bestaat)
    const assignmentResult = await db.query(
      `SELECT
        a.id, a.title, a.description, a.due_date, a.created_at,
        c.id as course_id, c.title as course_title,
        cs.rubric, cs.ai_guidelines,
        s.id as submission_id,
        e.id as enrollment_id
      FROM assignment a
      JOIN course c ON a.course_id = c.id
      LEFT JOIN course_settings cs ON c.id = cs.course_id
      LEFT JOIN submission s ON a.id = s.assignment_id AND s.user_id = $2
      LEFT JOIN enrollment e ON c.id = e.course_id AND e.user_id = $2
      WHERE a.id = $1`,
      [assignmentId, studentId]
    );

    if (assignmentResult.rows.length === 0) {
      return { success: false, error: 'NOT_FOUND' };
    }

    const row = assignmentResult.rows[0];

    // Check enrollment (nu zonder apart info te lekken)
    if (row.enrollment_id === null) {
      return { success: false, error: 'FORBIDDEN' };
    }

    return {
      success: true,
      data: {
        assignment: {
          id: row.id,
          title: row.title,
          description: row.description,
          due_date: row.due_date,
          created_at: row.created_at
        },
        course: {
          id: row.course_id,
          title: row.course_title,
          rubric: row.rubric,
          ai_guidelines: row.ai_guidelines
        },
        submission_status: {
          has_submitted: row.submission_id !== null,
          submission_id: row.submission_id
        }
      }
    };
  } catch (error) {
    console.error('Fout bij ophalen assignment detail:', { assignmentId, studentId, error: error.message });
    throw error;
  }
}

module.exports = {
  getStudentCourses,
  getCourseAssignments,
  getStudentSubmissions,
  getSubmissionDetail,
  isStudentEnrolledInCourse,
  getAssignmentWithCourse,
  getExistingSubmission,
  createSubmission,
  updateSubmissionWebhook,
  joinCourseByCode,
  updateSubmission,
  getAssignmentDetail
};
