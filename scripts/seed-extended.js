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

// Helper function to generate random GitHub URLs
function generateGitHubUrl(username, repo) {
  return `https://github.com/${username}/${repo}`;
}

// Helper function to generate random commit SHAs
function generateCommitSha() {
  return crypto.randomBytes(20).toString('hex');
}

async function seedDatabase() {
  try {
    console.log('🌱 Starting extended database seeding...\n');

    // First, check and create schema if needed
    console.log('🔧 Setting up database schema...');
    const schemaPath = path.join(__dirname, '../src/db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Split schema into individual statements and execute them
    const statements = schema.split(';').filter(stmt => stmt.trim());
    for (const statement of statements) {
      try {
        await pool.query(statement + ';');
      } catch (err) {
        // Ignore errors if tables/types already exist
      }
    }
    console.log('  ✓ Database schema ready\n');

    // 1. Create users (more diverse set)
    console.log('📝 Creating users...');
    
    const studentPassword = await bcrypt.hash('Student123!', 10);
    const teacherPassword = await bcrypt.hash('Teacher123!', 10);
    const adminPassword = await bcrypt.hash('Admin123!', 10);

    // Create admin users
    const adminUsers = [];
    const adminEmails = [
      'admin@example.com',
      'admin2@example.com'
    ];
    for (const email of adminEmails) {
      const result = await pool.query(
        `INSERT INTO "user" (email, name, github_id, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE SET updated_at = NOW() RETURNING *`,
        [email, email.split('@')[0] + ' Admin', 'admin' + Math.random().toString(36).substr(2, 9), adminPassword, 'admin']
      );
      adminUsers.push(result.rows[0].id);
    }
    console.log(`  ✓ ${adminUsers.length} Admin users created`);

    // Create teachers
    const teachers = [];
    const teacherEmails = [
      { email: 'prof.smith@example.com', name: 'Prof. Smith', github: 'profsmith' },
      { email: 'prof.johnson@example.com', name: 'Prof. Johnson', github: 'profjohnson' },
      { email: 'dr.williams@example.com', name: 'Dr. Williams', github: 'drwilliams' }
    ];
    for (const teacher of teacherEmails) {
      const result = await pool.query(
        `INSERT INTO "user" (email, name, github_id, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE SET updated_at = NOW() RETURNING *`,
        [teacher.email, teacher.name, teacher.github, teacherPassword, 'teacher']
      );
      teachers.push(result.rows[0]);
    }
    console.log(`  ✓ ${teachers.length} Teachers created`);

    // Create students
    const students = [];
    const studentNames = [
      { email: 'alice.wonder@example.com', name: 'Alice Wonder', github: 'alicewonder' },
      { email: 'bob.builder@example.com', name: 'Bob Builder', github: 'bobbuilder' },
      { email: 'charlie.dev@example.com', name: 'Charlie Dev', github: 'charliedev' },
      { email: 'diana.code@example.com', name: 'Diana Code', github: 'diancode' },
      { email: 'emma.prog@example.com', name: 'Emma Programmer', github: 'emmaprog' },
      { email: 'frank.swift@example.com', name: 'Frank Swift', github: 'frankswift' },
      { email: 'grace.tech@example.com', name: 'Grace Tech', github: 'gracetech' },
      { email: 'henry.java@example.com', name: 'Henry Java', github: 'henryjava' }
    ];
    for (const student of studentNames) {
      const result = await pool.query(
        `INSERT INTO "user" (email, name, github_id, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE SET updated_at = NOW() RETURNING *`,
        [student.email, student.name, student.github, studentPassword, 'student']
      );
      students.push(result.rows[0]);
    }
    console.log(`  ✓ ${students.length} Students created\n`);

    // 2. Create courses
    console.log('📚 Creating courses...');
    const courses = [];
    const courseData = [
      { title: 'Web Development 101', description: 'Learn the fundamentals of web development with HTML, CSS, and JavaScript' },
      { title: 'Advanced JavaScript', description: 'Master JavaScript patterns, async programming, and modern ES6+ features' },
      { title: 'React Fundamentals', description: 'Build interactive UIs with React and learn component-based architecture' },
      { title: 'Node.js & Express', description: 'Create powerful backend applications with Node.js and Express framework' },
      { title: 'Database Design', description: 'Learn relational database design, SQL, and PostgreSQL' }
    ];
    
    for (const course of courseData) {
      const result = await pool.query(
        `INSERT INTO course (title, description, join_code)
         VALUES ($1, $2, $3)
         ON CONFLICT (join_code) DO UPDATE SET updated_at = NOW() RETURNING *`,
        [course.title, course.description, generateRandomString(6).toUpperCase()]
      );
      courses.push(result.rows[0]);
    }
    console.log(`  ✓ ${courses.length} Courses created\n`);

    // 3. Assign teachers to courses
    console.log('👨‍🏫 Assigning teachers to courses...');
    let teacherAssignments = 0;
    for (const course of courses) {
      // Assign 1-2 teachers to each course
      const numTeachers = Math.random() > 0.5 ? 2 : 1;
      const selectedTeachers = teachers.slice(0, numTeachers);
      
      for (const teacher of selectedTeachers) {
        await pool.query(
          `INSERT INTO course_teacher (course_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (course_id, user_id) DO NOTHING`,
          [course.id, teacher.id]
        );
        teacherAssignments++;
      }
    }
    console.log(`  ✓ ${teacherAssignments} Teacher assignments created\n`);

    // 4. Create enrollments
    console.log('📋 Creating enrollments...');
    let enrollments = 0;
    for (const course of courses) {
      // Enroll 3-6 students per course
      const numStudents = Math.floor(Math.random() * 4) + 3;
      const shuffledStudents = students.sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < numStudents; i++) {
        await pool.query(
          `INSERT INTO enrollment (course_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (course_id, user_id) DO NOTHING`,
          [course.id, shuffledStudents[i].id]
        );
        enrollments++;
      }
    }
    console.log(`  ✓ ${enrollments} Student enrollments created\n`);

    // 5. Create assignments
    console.log('✍️  Creating assignments...');
    const assignments = [];
    const assignmentTemplates = [
      'Build a Todo App',
      'Create a Personal Portfolio',
      'Implement a REST API',
      'Design a Database Schema',
      'Build a Chat Application',
      'Create a Blog Platform',
      'Implement Authentication',
      'Build a Calculator App'
    ];

    let assignmentCount = 0;
    for (const course of courses) {
      // Create 2-4 assignments per course
      const numAssignments = Math.floor(Math.random() * 3) + 2;
      
      for (let i = 0; i < numAssignments; i++) {
        const dueDate = new Date(Date.now() + (Math.random() * 30 + 3) * 24 * 60 * 60 * 1000);
        const title = assignmentTemplates[Math.floor(Math.random() * assignmentTemplates.length)];
        
        const result = await pool.query(
          `INSERT INTO assignment (title, description, course_id, due_date)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [
            `${title} - ${course.title}`,
            `Complete this assignment as part of ${course.title}. Make sure to follow all requirements and best practices.`,
            course.id,
            dueDate
          ]
        );
        assignments.push(result.rows[0]);
        assignmentCount++;
      }
    }
    console.log(`  ✓ ${assignmentCount} Assignments created\n`);

    // 6. Create submissions
    console.log('📤 Creating submissions...');
    let submissionCount = 0;
    const statuses = ['completed', 'pending', 'in_review'];
    
    for (const assignment of assignments) {
      // Get students enrolled in the course
      const enrolledResult = await pool.query(
        `SELECT user_id FROM enrollment WHERE course_id = $1`,
        [assignment.course_id]
      );
      const enrolledStudents = enrolledResult.rows;
      
      // Create submissions for 60-100% of enrolled students
      const submitCount = Math.floor(enrolledStudents.length * (0.6 + Math.random() * 0.4));
      const shuffled = enrolledStudents.sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < submitCount; i++) {
        const student = shuffled[i];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const aiScore = status === 'completed' ? Math.floor(Math.random() * 40 + 60) : null;
        
        try {
          await pool.query(
            `INSERT INTO submission (assignment_id, user_id, github_url, commit_sha, status, ai_score)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [
              assignment.id,
              student.user_id,
              generateGitHubUrl(`student${student.user_id}`, assignment.title.replace(/\s+/g, '-').toLowerCase()),
              generateCommitSha(),
              status,
              aiScore
            ]
          );
          submissionCount++;
        } catch (err) {
          // Ignore duplicate submissions
        }
      }
    }
    console.log(`  ✓ ${submissionCount} Submissions created\n`);

    // 7. Create feedback
    console.log('💬 Creating feedback...');
    const feedbackTemplates = [
      { content: 'Great implementation! Consider adding more error handling.', severity: 'low', type: 'suggestion' },
      { content: 'Missing proper input validation.', severity: 'medium', type: 'issue' },
      { content: 'Code is well-structured and follows best practices.', severity: 'low', type: 'praise' },
      { content: 'Performance could be improved by optimizing the database queries.', severity: 'medium', type: 'suggestion' },
      { content: 'Missing unit tests for edge cases.', severity: 'high', type: 'issue' },
      { content: 'Excellent documentation and comments!', severity: 'low', type: 'praise' },
      { content: 'Consider refactoring this function to reduce complexity.', severity: 'medium', type: 'suggestion' },
      { content: 'Security vulnerability: never expose sensitive data in logs.', severity: 'critical', type: 'issue' }
    ];

    let feedbackCount = 0;
    const submissionsResult = await pool.query(`SELECT id FROM submission LIMIT 100`);
    const submissionsForFeedback = submissionsResult.rows;
    
    for (const submission of submissionsForFeedback) {
      // Add 1-3 feedback items per submission
      const numFeedback = Math.floor(Math.random() * 3) + 1;
      
      for (let i = 0; i < numFeedback; i++) {
        const feedback = feedbackTemplates[Math.floor(Math.random() * feedbackTemplates.length)];
        
        await pool.query(
          `INSERT INTO feedback (submission_id, content, reviewer, severity, line_number, type)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            submission.id,
            feedback.content,
            'ai',
            feedback.severity,
            Math.floor(Math.random() * 200) + 1,
            feedback.type
          ]
        );
        feedbackCount++;
      }
    }
    console.log(`  ✓ ${feedbackCount} Feedback items created\n`);

    console.log('✅ Database seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`  - Admin users: ${adminUsers.length}`);
    console.log(`  - Teachers: ${teachers.length}`);
    console.log(`  - Students: ${students.length}`);
    console.log(`  - Courses: ${courses.length}`);
    console.log(`  - Teacher-Course assignments: ${teacherAssignments}`);
    console.log(`  - Enrollments: ${enrollments}`);
    console.log(`  - Assignments: ${assignmentCount}`);
    console.log(`  - Submissions: ${submissionCount}`);
    console.log(`  - Feedback items: ${feedbackCount}`);
    console.log('\n🔐 Test Accounts (with passwords):');
    console.log('  Admin: admin@example.com / Admin123!');
    console.log('  Teacher: prof.smith@example.com / Teacher123!');
    console.log('  Student: alice.wonder@example.com / Student123!');

  } catch (error) {
    console.error('❌ Error during seeding:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the seeder
seedDatabase();
