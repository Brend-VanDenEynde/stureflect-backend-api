const db = require('../config/db');

/**
 * Haalt alle studenten op uit de database
 * @returns {Promise<Array>} Array met studentgegevens
 */
async function getAllStudents() {
  const result = await db.query(
    `SELECT id, email, name, created_at, updated_at
     FROM "user"
     WHERE role = 'student'
     ORDER BY name ASC`
  );
  return result.rows;
}

/**
 * Haalt alle docenten op uit de database
 * @returns {Promise<Array>} Array met docentgegevens
 */
async function getAllTeachers() {
  const result = await db.query(
    `SELECT id, email, name, created_at, updated_at
     FROM "user"
     WHERE role = 'teacher'
     ORDER BY name ASC`
  );
  return result.rows;
}

/**
 * Haalt alle admins op uit de database
 * @returns {Promise<Array>} Array met admingegevens
 */
async function getAllAdmins() {
  const result = await db.query(
    `SELECT id, email, name, created_at, updated_at
     FROM "user"
     WHERE role = 'admin'
     ORDER BY name ASC`
  );
  return result.rows;
}

/**
 * Controleert of een gebruiker admin is
 * @param {number} userId - ID van de gebruiker
 * @returns {Promise<boolean>} True als gebruiker admin is
 */
async function isUserAdmin(userId) {
  const result = await db.query(
    `SELECT id FROM "user" WHERE id = $1 AND role = 'admin'`,
    [userId]
  );
  return result.rows.length > 0;
}

/**
 * Controleert of een gebruiker bestaat
 * @param {number} userId - ID van de gebruiker
 * @returns {Promise<Object|null>} Gebruikersobject of null
 */
async function getUserById(userId) {
  const result = await db.query(
    `SELECT id, email, name, role FROM "user" WHERE id = $1`,
    [userId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Wijzigt de rol van een gebruiker
 * @param {number} userId - ID van de gebruiker
 * @param {string} newRole - Nieuwe rol ('student', 'teacher', 'admin')
 * @returns {Promise<Object>} Bijgewerkte gebruikersgegevens
 */
async function changeUserRole(userId, newRole) {
  const result = await db.query(
    `UPDATE "user" 
     SET role = $1, updated_at = NOW() 
     WHERE id = $2 
     RETURNING id, email, name, role, updated_at`,
    [newRole, userId]
  );
  return result.rows[0];
}

/**
 * Haalt alle vakken op uit de database
 * @returns {Promise<Array>} Array met vakgegevens
 */
async function getAllCourses() {
  const result = await db.query(
    `SELECT c.id, c.title, c.description, c.join_code, c.created_at, c.updated_at,
            COUNT(DISTINCT e.user_id) as student_count,
            COUNT(DISTINCT ct.user_id) as teacher_count
     FROM course c
     LEFT JOIN enrollment e ON c.id = e.course_id
     LEFT JOIN course_teacher ct ON c.id = ct.course_id
     GROUP BY c.id, c.title, c.description, c.join_code, c.created_at, c.updated_at
     ORDER BY c.created_at DESC`
  );
  return result.rows;
}

/**
 * Haalt gedetailleerde informatie op van een specifiek vak inclusief eigenaren
 * @param {number} courseId - ID van het vak
 * @returns {Promise<Object>} Object met vakinfo en eigenaren
 */
async function getCourseDetails(courseId) {
  // Haal basisinformatie van het vak op
  const courseResult = await db.query(
    `SELECT id, title, description, join_code, created_at, updated_at
     FROM course
     WHERE id = $1`,
    [courseId]
  );

  if (courseResult.rows.length === 0) {
    return null;
  }

  const course = courseResult.rows[0];

  // Haal alle eigenaren (teachers) van het vak op
  const ownersResult = await db.query(
    `SELECT u.id, u.email, u.name, u.role, ct.created_at as assigned_at
     FROM course_teacher ct
     JOIN "user" u ON ct.user_id = u.id
     WHERE ct.course_id = $1
     ORDER BY ct.created_at ASC`,
    [courseId]
  );

  // Haal aantal studenten op
  const enrollmentResult = await db.query(
    `SELECT COUNT(*) as student_count
     FROM enrollment
     WHERE course_id = $1`,
    [courseId]
  );

  // Haal aantal assignments op
  const assignmentResult = await db.query(
    `SELECT COUNT(*) as assignment_count
     FROM assignment
     WHERE course_id = $1`,
    [courseId]
  );

  return {
    ...course,
    owners: ownersResult.rows,
    student_count: parseInt(enrollmentResult.rows[0].student_count),
    assignment_count: parseInt(assignmentResult.rows[0].assignment_count)
  };
}

/**
 * Verwijdert een vak uit de database
 * @param {number} courseId - ID van het vak
 * @returns {Promise<Object>} Verwijderd vakobject
 */
async function deleteCourse(courseId) {
  const result = await db.query(
    `DELETE FROM course
     WHERE id = $1
     RETURNING id, title, description, join_code`,
    [courseId]
  );
  return result.rows.length > 0 ? result.rows[0] : null;
}

module.exports = {
  getAllStudents,
  getAllTeachers,
  getAllAdmins,
  isUserAdmin,
  getUserById,
  changeUserRole,
  getAllCourses,
  getCourseDetails,
  deleteCourse
};
