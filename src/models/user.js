const pool = require('../config/db');
const crypto = require('crypto');

// Helper functie om token hash te maken
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Functie om een gebruiker toe te voegen
async function createUser({ email, name, github_id, github_access_token, password_hash, role }) {
  const query = `
    INSERT INTO "user" (email, name, github_id, github_access_token, password_hash, role)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const values = [email, name, github_id, github_access_token, password_hash, role];
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

// Functie om GitHub ID van een gebruiker bij te werken
async function updateUserGithubId(id, github_id) {
  const query = `UPDATE "user" SET github_id = $1 WHERE id = $2 RETURNING *;`;
  const result = await pool.query(query, [github_id, id]);
  return result.rows[0];
}

// Functie om GitHub access token van een gebruiker bij te werken
async function updateUserGithubAccessToken(id, github_access_token) {
  const query = `UPDATE "user" SET github_access_token = $1 WHERE id = $2 RETURNING *;`;
  const result = await pool.query(query, [github_access_token, id]);
  return result.rows[0];
}

// Functie om gebruikersprofiel bij te werken
async function updateUser(id, updates) {
  const allowedFields = ['name', 'email'];
  const fields = [];
  const values = [];
  let paramIndex = 1;

  // Build dynamic query based on provided fields
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (fields.length === 0) {
    throw new Error('Geen geldige velden om bij te werken');
  }

  // Add updated_at timestamp
  fields.push(`updated_at = NOW()`);
  
  // Add user id as last parameter
  values.push(id);

  const query = `
    UPDATE "user" 
    SET ${fields.join(', ')} 
    WHERE id = $${paramIndex} 
    RETURNING *;
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
}

// Functie om een refresh token op te slaan
async function saveRefreshToken(userId, token, expiresAt) {
  const tokenHash = hashToken(token);
  const query = `
    INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;
  const result = await pool.query(query, [userId, tokenHash, expiresAt]);
  return result.rows[0];
}

// Functie om een refresh token te valideren
async function getRefreshToken(token) {
  const tokenHash = hashToken(token);
  const query = `
    SELECT * FROM refresh_tokens 
    WHERE token_hash = $1 AND expires_at > NOW();
  `;
  const result = await pool.query(query, [tokenHash]);
  return result.rows[0];
}

// Functie om een refresh token in te trekken
async function revokeRefreshToken(token) {
  const tokenHash = hashToken(token);
  const query = `
    DELETE FROM refresh_tokens WHERE token_hash = $1 RETURNING *;
  `;
  const result = await pool.query(query, [tokenHash]);
  return result.rows[0];
}

// Functie om alle refresh tokens van een gebruiker in te trekken
async function revokeUserRefreshTokens(userId) {
  const query = `
    DELETE FROM refresh_tokens WHERE user_id = $1 RETURNING *;
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  getUserByGithubId,
  deleteUser,
  updateUserPassword,
  updateUserGithubId,
  updateUserGithubAccessToken,
  updateUser,
  saveRefreshToken,
  getRefreshToken,
  revokeRefreshToken,
  revokeUserRefreshTokens,
};