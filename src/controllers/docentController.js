const db = require('../config/db');

/**
 * Controleer of een docent toegang heeft tot een cursus
 * @param {number} teacherId - ID van de docent
 * @param {number} classId - ID van de cursus
 * @returns {Promise<boolean>}
 */
async function isTeacherOwnerOfClass(teacherId, classId) {
  try {
    const result = await db.query(
      'SELECT id FROM course_teacher WHERE course_id = $1 AND user_id = $2',
      [classId, teacherId]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('Fout bij controleren toegang cursus:', error);
    throw error;
  }
}

/**
 * Controleer of een docent toegang heeft tot een student
 * (student is ingeschreven in één van de cursussen van de docent)
 * @param {number} teacherId - ID van de docent
 * @param {number} studentId - ID van de student
 * @returns {Promise<boolean>}
 */
async function teacherHasAccessToStudent(teacherId, studentId) {
  try {
    const result = await db.query(
      `SELECT e.id FROM enrollment e
       JOIN course_teacher ct ON e.course_id = ct.course_id
       WHERE ct.user_id = $1 AND e.user_id = $2`,
      [teacherId, studentId]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('Fout bij controleren toegang student:', error);
    throw error;
  }
}

/**
 * Haal alle studenten op die ingeschreven zijn in een cursus
 * @param {number} classId - ID van de cursus
 * @param {string} sortBy - Veld om op te sorteren (name, email, created_at)
 * @param {string} order - Sorteerrichting (ASC of DESC)
 * @returns {Promise<Array>}
 */
async function getStudentsByClass(classId, sortBy = 'name', order = 'ASC') {
  try {
    // Valideer sortBy parameter om SQL injection te voorkomen
    const validSortFields = ['name', 'email', 'created_at'];
    if (!validSortFields.includes(sortBy)) {
      sortBy = 'name';
    }
    if (order !== 'ASC' && order !== 'DESC') {
      order = 'ASC';
    }

    const query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.github_id,
        e.created_at as enrolled_date,
        COUNT(s.id) as submission_count,
        AVG(COALESCE(s.manual_score, s.ai_score)) as average_score
      FROM "user" u
      JOIN enrollment e ON u.id = e.user_id
      LEFT JOIN assignment a ON a.course_id = e.course_id
      LEFT JOIN submission s ON s.assignment_id = a.id AND s.user_id = u.id
      WHERE e.course_id = $1 AND u.role = 'student'
      GROUP BY u.id, u.name, u.email, u.github_id, e.created_at
      ORDER BY u.${sortBy} ${order}
    `;

    const result = await db.query(query, [classId]);
    return result.rows;
  } catch (error) {
    console.error('Fout bij ophalen studenten:', error);
    throw error;
  }
}

/**
 * Haal het profiel van een student op
 * @param {number} studentId - ID van de student
 * @returns {Promise<Object|null>}
 */
async function getStudentProfile(studentId) {
  try {
    const result = await db.query(
      `SELECT 
        id,
        name,
        email,
        github_id,
        role,
        created_at,
        updated_at
       FROM "user"
       WHERE id = $1 AND role = 'student'`,
      [studentId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Fout bij ophalen studentprofiel:', error);
    throw error;
  }
}

/**
 * Haal voortgangsoverzicht van een student op
 * @param {number} studentId - ID van de student
 * @returns {Promise<Object>}
 */
async function getStudentProgress(studentId) {
  try {
    // Haal inzendingen op met hun scores
    const submissionsResult = await db.query(
      `SELECT 
        s.id,
        s.assignment_id,
        a.title as assignment_title,
        s.status,
        s.ai_score,
        s.manual_score,
        COALESCE(s.manual_score, s.ai_score) as final_score,
        s.github_url,
        s.created_at,
        s.updated_at,
        COUNT(f.id) as feedback_count
       FROM submission s
       JOIN assignment a ON s.assignment_id = a.id
       LEFT JOIN feedback f ON s.id = f.submission_id
       WHERE s.user_id = $1
       GROUP BY s.id, s.assignment_id, a.title, s.status, s.ai_score, 
                s.manual_score, s.github_url, s.created_at, s.updated_at
       ORDER BY s.created_at DESC`,
      [studentId]
    );

    // Bereken totale statistieken
    const statsResult = await db.query(
      `SELECT 
        COUNT(DISTINCT s.id) as total_submissions,
        COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END) as completed_submissions,
        COUNT(DISTINCT CASE WHEN s.status = 'pending' THEN s.id END) as pending_submissions,
        AVG(COALESCE(s.manual_score, s.ai_score)) as average_score,
        MAX(COALESCE(s.manual_score, s.ai_score)) as highest_score,
        MIN(COALESCE(s.manual_score, s.ai_score)) as lowest_score
       FROM submission s
       WHERE s.user_id = $1`,
      [studentId]
    );

    return {
      submissions: submissionsResult.rows,
      statistics: statsResult.rows[0]
    };
  } catch (error) {
    console.error('Fout bij ophalen voortgang:', error);
    throw error;
  }
}

/**
 * Haal alle inzendingen van een student op
 * @param {number} studentId - ID van de student
 * @param {number|null} assignmentId - Optioneel: filter op assignment
 * @param {string|null} status - Optioneel: filter op status (pending, completed, etc)
 * @returns {Promise<Array>}
 */
async function getStudentSubmissions(studentId, assignmentId = null, status = null) {
  try {
    let query = `
      SELECT 
        s.id,
        s.assignment_id,
        a.title as assignment_title,
        a.due_date,
        s.status,
        s.ai_score,
        s.manual_score,
        COALESCE(s.manual_score, s.ai_score) as final_score,
        s.github_url,
        s.commit_sha,
        s.created_at,
        s.updated_at
       FROM submission s
       JOIN assignment a ON s.assignment_id = a.id
       WHERE s.user_id = $1
    `;

    const params = [studentId];
    let paramIndex = 2;

    if (assignmentId) {
      query += ` AND s.assignment_id = $${paramIndex}`;
      params.push(assignmentId);
      paramIndex++;
    }

    if (status) {
      query += ` AND s.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY s.created_at DESC`;

    const result = await db.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Fout bij ophalen inzendingen:', error);
    throw error;
  }
}

/**
 * Haal alle feedback op voor een student
 * @param {number} studentId - ID van de student
 * @param {number|null} submissionId - Optioneel: filter op inzending
 * @returns {Promise<Array>}
 */
async function getStudentFeedback(studentId, submissionId = null) {
  try {
    let query = `
      SELECT 
        f.id,
        f.submission_id,
        s.assignment_id,
        a.title as assignment_title,
        f.content,
        f.reviewer,
        f.severity,
        f.line_number,
        f.suggestion,
        f.type,
        f.created_at
       FROM feedback f
       JOIN submission s ON f.submission_id = s.id
       JOIN assignment a ON s.assignment_id = a.id
       WHERE s.user_id = $1
    `;

    const params = [studentId];

    if (submissionId) {
      query += ` AND f.submission_id = $2`;
      params.push(submissionId);
    }

    query += ` ORDER BY f.created_at DESC`;

    const result = await db.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Fout bij ophalen feedback:', error);
    throw error;
  }
}

/**
 * Schrijf meerdere studenten in voor een cursus
 * @param {number} classId - ID van de cursus
 * @param {Array<number>} studentIds - Array van student IDs
 * @returns {Promise<Object>} - { enrolled: number, failed: number, errors: Array }
 */
async function enrollStudents(classId, studentIds) {
  try {
    const results = {
      enrolled: 0,
      failed: 0,
      errors: []
    };

    // Controleer of cursus bestaat
    const courseCheck = await db.query('SELECT id FROM course WHERE id = $1', [classId]);
    if (courseCheck.rows.length === 0) {
      throw new Error('Cursus niet gevonden');
    }

    for (const studentId of studentIds) {
      try {
        // Controleer of student bestaat en student-rol heeft
        const userCheck = await db.query(
          'SELECT id FROM "user" WHERE id = $1 AND role = \'student\'',
          [studentId]
        );
        
        if (userCheck.rows.length === 0) {
          results.failed++;
          results.errors.push({ studentId, reason: 'Student niet gevonden' });
          continue;
        }

        // Probeer in te schrijven (ignore duplicate key error)
        try {
          await db.query(
            'INSERT INTO enrollment (course_id, user_id) VALUES ($1, $2)',
            [classId, studentId]
          );
          results.enrolled++;
        } catch (err) {
          // Duplicate key error = student al ingeschreven
          if (err.code === '23505') {
            results.failed++;
            results.errors.push({ studentId, reason: 'Student al ingeschreven' });
          } else {
            throw err;
          }
        }
      } catch (err) {
        results.failed++;
        results.errors.push({ studentId, reason: err.message });
      }
    }

    return results;
  } catch (error) {
    console.error('Fout bij inschrijving:', error);
    throw error;
  }
}

/**
 * Verwijder een student uit een cursus
 * @param {number} classId - ID van de cursus
 * @param {number} studentId - ID van de student
 * @returns {Promise<boolean>} - True als verwijderd, false als niet gevonden
 */
async function unenrollStudent(classId, studentId) {
  try {
    const result = await db.query(
      'DELETE FROM enrollment WHERE course_id = $1 AND user_id = $2 RETURNING id',
      [classId, studentId]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('Fout bij uitschrijving:', error);
    throw error;
  }
}

/**
 * Verwijder meerdere studenten uit een cursus (bulk)
 * @param {number} classId - ID van de cursus
 * @param {Array<number>} studentIds - Array van student IDs
 * @returns {Promise<Object>} - { deleted: number, failed: number }
 */
async function unenrollMultipleStudents(classId, studentIds) {
  try {
    const results = {
      deleted: 0,
      failed: 0
    };

    for (const studentId of studentIds) {
      try {
        const result = await db.query(
          'DELETE FROM enrollment WHERE course_id = $1 AND user_id = $2 RETURNING id',
          [classId, studentId]
        );
        if (result.rows.length > 0) {
          results.deleted++;
        } else {
          results.failed++;
        }
      } catch (err) {
        results.failed++;
        console.error(`Fout bij uitschrijving student ${studentId}:`, err);
      }
    }

    return results;
  } catch (error) {
    console.error('Fout bij bulk uitschrijving:', error);
    throw error;
  }
}

/**
 * Stel handmatige score in voor een inzending
 * @param {number} submissionId - ID van de inzending
 * @param {number} score - Score (0-100)
 * @returns {Promise<boolean>} - True als bijgewerkt, false als niet gevonden
 */
async function setManualScore(submissionId, score) {
  try {
    const result = await db.query(
      `UPDATE submission 
       SET manual_score = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id`,
      [score, submissionId]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('Fout bij scoren:', error);
    throw error;
  }
}

module.exports = {
  isTeacherOwnerOfClass,
  teacherHasAccessToStudent,
  getStudentsByClass,
  getStudentProfile,
  getStudentProgress,
  getStudentSubmissions,
  getStudentFeedback,
  enrollStudents,
  unenrollStudent,
  unenrollMultipleStudents,
  setManualScore
};
