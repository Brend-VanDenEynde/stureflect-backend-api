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

module.exports = {
  getAllStudents,
  isUserAdmin,
  getUserById,
  changeUserRole
};
