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
    console.error('Fout bij ophalen cursussen:', error);
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
    console.error('Fout bij ophalen opdrachten:', error);
    throw error;
  }
}

/**
 * Haal alle submissions op van een student
 * @param {number} studentId - ID van de student
 * @param {object} filters - Filter opties
 * @param {number} filters.courseId - Filter op cursus (optioneel)
 * @param {string} filters.status - Filter op status: 'pending', 'completed', 'graded' (optioneel)
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
        s.status,
        s.ai_score,
        s.manual_score,
        s.created_at,
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
    const validStatuses = ['pending', 'completed', 'graded'];
    if (status && validStatuses.includes(status)) {
      query += ` AND s.status = $${paramIndex}`;
      params.push(status);
    }

    query += ` ORDER BY s.created_at DESC`;

    const result = await db.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Fout bij ophalen submissions:', error);
    throw error;
  }
}

/**
 * Haal detail van een specifieke submission op
 * @param {number} submissionId - ID van de submission
 * @returns {Promise<object|null>}
 */
async function getSubmissionDetail(submissionId) {
  try {
    const result = await db.query(
      `SELECT
        s.id,
        s.github_url,
        s.commit_sha,
        s.status,
        s.ai_score,
        s.manual_score,
        s.user_id,
        s.created_at,
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

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      submission: {
        id: row.id,
        github_url: row.github_url,
        commit_sha: row.commit_sha,
        status: row.status,
        ai_score: row.ai_score,
        manual_score: row.manual_score,
        user_id: row.user_id,
        created_at: row.created_at
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
      }
    };
  } catch (error) {
    console.error('Fout bij ophalen submission detail:', error);
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
    console.error('Fout bij controleren inschrijving:', error);
    throw error;
  }
}

module.exports = {
  getStudentCourses,
  getCourseAssignments,
  getStudentSubmissions,
  getSubmissionDetail,
  isStudentEnrolledInCourse
};
