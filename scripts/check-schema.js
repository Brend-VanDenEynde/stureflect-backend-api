require('dotenv').config();
const pool = require('../src/config/db');

async function checkUserTable() {
  try {
    const result = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns 
       WHERE table_name = 'user' ORDER BY ordinal_position`
    );
    console.log('Columns in user table:');
    result.rows.forEach(row => console.log('  -', row.column_name, '(' + row.data_type + ')'));
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUserTable();
