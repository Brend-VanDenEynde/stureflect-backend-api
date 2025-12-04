const pool = require('../config/db');

// Functie om een gebruiker toe te voegen
async function createUser({ email, name, github_id, password_hash, role }) {
  const query = `
    INSERT INTO "user" (email, name, github_id, password_hash, role)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  const values = [email, name, github_id, password_hash, role];
  const result = await pool.query(query, values);
  return result.rows[0];
}

// Functie om een gebruiker op te halen via e-mail
async function getUserByEmail(email) {
  const query = `SELECT * FROM "user" WHERE email = $1;`;
  const result = await pool.query(query, [email]);
  return result.rows[0];
}

// Functie om een gebruiker op te halen via ID
async function getUserById(id) {
  const query = `SELECT * FROM "user" WHERE id = $1;`;
  const result = await pool.query(query, [id]);
  return result.rows[0];
}

// Functie om een gebruiker op te halen via GitHub ID
async function getUserByGithubId(github_id) {
  const query = `SELECT * FROM "user" WHERE github_id = $1;`;
  const result = await pool.query(query, [github_id]);
  return result.rows[0];
}

// Functie om een gebruiker te verwijderen
async function deleteUser(id) {
  const query = `DELETE FROM "user" WHERE id = $1 RETURNING *;`;
  const result = await pool.query(query, [id]);
  return result.rows[0];
}

// Functie om het wachtwoord van een gebruiker bij te werken
async function updateUserPassword(id, password_hash) {
  const query = `UPDATE "user" SET password_hash = $1 WHERE id = $2 RETURNING *;`;
  const result = await pool.query(query, [password_hash, id]);
  return result.rows[0];
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  getUserByGithubId,
  deleteUser,
  updateUserPassword,
};