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
        c.name,
        c.description,
        COUNT(a.id) as assignment_count
      FROM course c
      JOIN enrollment e ON c.id = e.course_id
      LEFT JOIN assignment a ON c.id = a.course_id
      WHERE e.user_id = $1
      GROUP BY c.id, c.name, c.description
      ORDER BY c.name ASC`,
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
 * @returns {Promise<Array>}
 */
async function getCourseAssignments(studentId, courseId) {
  try {
    const result = await db.query(
      `SELECT
        a.id,
        a.title,
        a.description,
        a.deadline,
        a.created_at,
        s.id as submission_id,
        CASE
          WHEN s.id IS NOT NULL THEN 'submitted'
          ELSE 'pending'
        END as submission_status
      FROM assignment a
      LEFT JOIN submission s ON a.id = s.assignment_id AND s.user_id = $1
      WHERE a.course_id = $2
      ORDER BY a.deadline ASC`,
      [studentId, courseId]
    );
    return result.rows;
  } catch (error) {
    console.error('Fout bij ophalen opdrachten:', error);
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
  isStudentEnrolledInCourse
};
