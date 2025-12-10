require('dotenv').config();
const pool = require('../src/config/db');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Helper function to generate a random string
function generateRandomString(length = 16) {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

async function seedDatabase() {
  try {
    console.log('Starting database seeding...\n');

    // First, check and create schema if needed
    console.log('Setting up database schema...');
    const schemaPath = path.join(__dirname, '../src/db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split schema into individual statements and execute them
    const statements = schema.split(';').filter(stmt => stmt.trim());
    for (const statement of statements) {
      try {
        await pool.query(statement + ';');
      } catch (err) {
        // Ignore errors if tables/types already exist
        if (!err.message.includes('already exists')) {
          console.log(`  ${err.message.split('\n')[0]}`);
        }
      }
    }
    console.log('  ✓ Database schema ready\n');

    // 1. Create users
    console.log('Creating users...');
    
    const studentPassword = await bcrypt.hash('Student123!', 10);
    const teacherPassword = await bcrypt.hash('Teacher123!', 10);
    const adminPassword = await bcrypt.hash('Admin123!', 10);

    const studentUser = await pool.query(
      `INSERT INTO "user" (email, name, github_id, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET updated_at = NOW() RETURNING *`,
      ['student@example.com', 'John Student', 'johnstudy123', studentPassword, 'student']
    );
    const studentId = studentUser.rows[0].id;
    console.log(`  ✓ Student created: ${studentUser.rows[0].email} (ID: ${studentId})`);

    const student2User = await pool.query(
      `INSERT INTO "user" (email, name, github_id, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET updated_at = NOW() RETURNING *`,
      ['student2@example.com', 'Jane Developer', 'janedev456', studentPassword, 'student']
    );
    const student2Id = student2User.rows[0].id;
    console.log(`  ✓ Student 2 created: ${student2User.rows[0].email} (ID: ${student2Id})`);

    const teacherUser = await pool.query(
      `INSERT INTO "user" (email, name, github_id, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET updated_at = NOW() RETURNING *`,
      ['teacher@example.com', 'Prof. Teacher', 'profteacher789', teacherPassword, 'teacher']
    );
    const teacherId = teacherUser.rows[0].id;
    console.log(`  ✓ Teacher created: ${teacherUser.rows[0].email} (ID: ${teacherId})`);

    const adminUser = await pool.query(
      `INSERT INTO "user" (email, name, github_id, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET updated_at = NOW() RETURNING *`,
      ['admin@example.com', 'Admin User', 'adminuser101', adminPassword, 'admin']
    );
    const adminId = adminUser.rows[0].id;
    console.log(`  ✓ Admin created: ${adminUser.rows[0].email} (ID: ${adminId})\n`);

    // 2. Create courses
    console.log('Creating courses...');
    const course1 = await pool.query(
      `INSERT INTO course (title, description, join_code)
       VALUES ($1, $2, $3)
       ON CONFLICT (join_code) DO UPDATE SET updated_at = NOW() RETURNING *`,
      ['Web Development 101', 'Learn the basics of web development', generateRandomString(6).toUpperCase()]
    );
    const courseId1 = course1.rows[0].id;
    console.log(`  ✓ Course 1 created: "${course1.rows[0].title}" (ID: ${courseId1})`);

    const course2 = await pool.query(
      `INSERT INTO course (title, description, join_code)
       VALUES ($1, $2, $3)
       ON CONFLICT (join_code) DO UPDATE SET updated_at = NOW() RETURNING *`,
      ['Advanced JavaScript', 'Master JavaScript patterns and best practices', generateRandomString(6).toUpperCase()]
    );
    const courseId2 = course2.rows[0].id;
    console.log(`  ✓ Course 2 created: "${course2.rows[0].title}" (ID: ${courseId2})\n`);

    // 2b. Assign teachers to courses
    console.log('Assigning teachers to courses...');
    await pool.query(
      `INSERT INTO course_teacher (course_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (course_id, user_id) DO NOTHING`,
      [courseId1, teacherId]
    );
    console.log(`  ✓ Teacher assigned to Course 1`);

    await pool.query(
      `INSERT INTO course_teacher (course_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (course_id, user_id) DO NOTHING`,
      [courseId2, teacherId]
    );
    console.log(`  ✓ Teacher assigned to Course 2\n`);

    console.log('Creating enrollments...');
    await pool.query(
      `INSERT INTO enrollment (course_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (course_id, user_id) DO NOTHING`,
      [courseId1, studentId]
    );
    console.log(`  ✓ Student 1 enrolled in Course 1`);

    await pool.query(
      `INSERT INTO enrollment (course_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (course_id, user_id) DO NOTHING`,
      [courseId1, student2Id]
    );
    console.log(`  ✓ Student 2 enrolled in Course 1`);

    await pool.query(
      `INSERT INTO enrollment (course_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (course_id, user_id) DO NOTHING`,
      [courseId2, studentId]
    );
    console.log(`  ✓ Student 1 enrolled in Course 2\n`);

    console.log('Creating assignments...');
    const assignment1 = await pool.query(
      `INSERT INTO assignment (title, description, course_id, due_date)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      ['Build a Portfolio Website', 'Create a personal portfolio using HTML, CSS, and JavaScript', courseId1, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
    );
    const assignmentId1 = assignment1.rows[0].id;
    console.log(`  ✓ Assignment 1 created: "${assignment1.rows[0].title}" (ID: ${assignmentId1})`);

    const assignment2 = await pool.query(
      `INSERT INTO assignment (title, description, course_id, due_date)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      ['API Endpoint Implementation', 'Implement RESTful API endpoints with proper error handling', courseId1, new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)]
    );
    const assignmentId2 = assignment2.rows[0].id;
    console.log(`  ✓ Assignment 2 created: "${assignment2.rows[0].title}" (ID: ${assignmentId2})`);

    const assignment3 = await pool.query(
      `INSERT INTO assignment (title, description, course_id, due_date)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      ['Advanced Patterns Challenge', 'Implement factory and observer patterns in a single project', courseId2, new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)]
    );
    const assignmentId3 = assignment3.rows[0].id;
    console.log(`  ✓ Assignment 3 created: "${assignment3.rows[0].title}" (ID: ${assignmentId3})\n`);

    console.log('Creating submissions...');
    const submission1 = await pool.query(
      `INSERT INTO submission (assignment_id, user_id, github_url, commit_sha, status, ai_score)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [assignmentId1, studentId, 'https://github.com/johnstudy/portfolio', 'abc123def456', 'completed', 85]
    );
    const submissionId1 = submission1.rows[0].id;
    console.log(`  ✓ Submission 1 created (ID: ${submissionId1}, AI Score: 85)`);

    const submission2 = await pool.query(
      `INSERT INTO submission (assignment_id, user_id, github_url, commit_sha, status, ai_score)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [assignmentId1, student2Id, 'https://github.com/janedev/portfolio', 'def456ghi789', 'completed', 92]
    );
    const submissionId2 = submission2.rows[0].id;
    console.log(`  ✓ Submission 2 created (ID: ${submissionId2}, AI Score: 92)`);

    const submission3 = await pool.query(
      `INSERT INTO submission (assignment_id, user_id, github_url, commit_sha, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [assignmentId2, studentId, 'https://github.com/johnstudy/api-project', 'ghi789jkl012', 'pending']
    );
    const submissionId3 = submission3.rows[0].id;
    console.log(`  ✓ Submission 3 created (ID: ${submissionId3}, Status: pending)\n`);

    console.log('Database seeding completed successfully!\n');
    console.log('Summary:');
    console.log(`  - Users: 4 (1 admin, 1 teacher, 2 students)`);
    console.log(`  - Courses: 2`);
    console.log(`  - Course-Teacher assignments: 2`);
    console.log(`  - Enrollments: 3`);
    console.log(`  - Assignments: 3`);
    console.log(`  - Submissions: 3`);
    console.log('\nTest Accounts (with passwords):');
    console.log('  Student 1: student@example.com / Student123!');
    console.log('  Student 2: student2@example.com / Student123!');
    console.log('  Teacher: teacher@example.com / Teacher123!');
    console.log('  Admin: admin@example.com / Admin123!');

  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    await pool.end();
  }
}

// Run the seeder
seedDatabase();
