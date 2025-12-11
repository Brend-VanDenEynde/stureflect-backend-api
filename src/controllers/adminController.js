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

module.exports = {
  getAllStudents,
  isUserAdmin
};
