require('dotenv').config();
const pool = require('../src/config/db');

async function checkTables() {
  try {
    const tables = ['user', 'course', 'assignment', 'submission', 'enrollment'];
    
    for (const table of tables) {
      const result = await pool.query(
        `SELECT column_name, data_type FROM information_schema.columns 
         WHERE table_name = $1 ORDER BY ordinal_position`,
        [table]
      );
      
      if (result.rows.length === 0) {
        console.log(`\nTable "${table}" does not exist\n`);
      } else {
        console.log(`\nColumns in "${table}" table:`);
        result.rows.forEach(row => console.log('  -', row.column_name, '(' + row.data_type + ')'));
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTables();
