require('dotenv').config();
const { Pool } = require('pg');

console.log('[DATABASE] Initialiseren van database connectie...');
console.log(`[DATABASE]    Host: ${process.env.DATABASE_URL ? 'DATABASE_URL ingesteld' : '[ERROR] DATABASE_URL niet gevonden'}`);
console.log(`[DATABASE]    SSL: ${process.env.DB_SSL === 'false' ? 'Uitgeschakeld' : 'Ingeschakeld'}`);

// Maak een nieuwe pool met de DATABASE_URL uit de .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
});

// Log pool events
pool.on('connect', () => {
  console.log('[DATABASE] Nieuwe database connectie gemaakt');
});

pool.on('error', (err) => {
  console.error('[ERROR] [DATABASE] Onverwachte database error:', err);
});

// Test de verbinding
(async () => {
  try {
    console.log('[DATABASE] Testen van database connectie...');
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as db_version');
    console.log('[SUCCESS] [DATABASE] Succesvol verbonden met de database!');
    console.log(`[DATABASE]    Tijd: ${result.rows[0].current_time}`);
    console.log(`[DATABASE]    Versie: ${result.rows[0].db_version.split(' ')[0]} ${result.rows[0].db_version.split(' ')[1]}`);
    client.release();
  } catch (err) {
    console.error('[ERROR] [DATABASE] Database verbinding mislukt!');
    console.error('[DATABASE]    Error:', err.message);
    console.error('[DATABASE]    Code:', err.code);
    if (err.code === 'ENOTFOUND') {
      console.error('[DATABASE]    Tip: Check of DATABASE_URL correct is ingesteld');
    }
  }
})();

module.exports = pool;