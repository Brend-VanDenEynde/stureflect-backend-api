require('dotenv').config();
const { Pool } = require('pg');

// Maak een nieuwe pool met de DATABASE_URL uit de .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Nodig voor SSL-verbindingen
  },
});

// Test de verbinding
(async () => {
  try {
    const client = await pool.connect();
    console.log('Succesvol verbonden met de database!');
    client.release();
  } catch (err) {
    console.error('Database verbinding mislukt:', err);
  }
})();

module.exports = pool;