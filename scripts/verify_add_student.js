const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const API_URL = 'http://localhost:3000/api/docent/courses';

async function verifyAddStudent() {
    let client;
    try {
        client = await pool.connect();

        // 1. Get a test course and user
        console.log('🔍 Finding a test course and user...');
        const courseRes = await client.query('SELECT id FROM course LIMIT 1');
        const userRes = await client.query('SELECT id, email FROM "user" WHERE role = \'student\' LIMIT 1');

        if (courseRes.rows.length === 0 || userRes.rows.length === 0) {
            console.error('❌ No course or student found to test with.');
            process.exit(1);
        }

        const courseId = courseRes.rows[0].id;
        const student = userRes.rows[0];

        console.log(`📝 Testing with Course ID: ${courseId}, Student: ${student.email}`);

        // 2. Ensure NOT enrolled initially
        await client.query('DELETE FROM enrollment WHERE course_id = $1 AND user_id = $2', [courseId, student.id]);

        // 3. Call the API to add the student
        console.log('🚀 Calling API to add student...');
        try {
            const response = await axios.post(`${API_URL}/${courseId}/students`, {
                email: student.email
            });
            console.log('✅ API Response:', response.status, response.data);
        } catch (error) {
            console.error('❌ API Error:', error.response ? error.response.data : error.message);
            process.exit(1);
        }

        // 4. Verify in DB
        const checkRes = await client.query('SELECT * FROM enrollment WHERE course_id = $1 AND user_id = $2', [courseId, student.id]);

        if (checkRes.rows.length > 0) {
            console.log('✅ Verification SUCCESS: Student is enrolled in the database.');
        } else {
            console.error('❌ Verification FAILED: Student not found in enrollment table.');
        }

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    } finally {
        if (client) client.release();
        await pool.end();
    }
}

verifyAddStudent();
