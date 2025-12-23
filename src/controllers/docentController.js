const pool = require('../config/db');
const notificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const {
  getCachedData,
  setCachedData,
  invalidateCourseCache,
  invalidateAssignmentCache
} = require('../services/cachingService');

const getEnrolledStudents = async (req, res) => {
  try {
    const { courseId } = req.params;

    const {
      assignmentId,
      status,
      search,
      sortBy = 'name',
      sortOrder = 'asc',
      page = 1,
      limit = 50
    } = req.query;

    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    // Generate cache key based on query parameters
    const cacheKey = `course:${courseId}:enrolled:${assignmentId || 'all'}:${status || 'all'}:${search || 'none'}:${sortBy}:${sortOrder}:${page}:${limit}`;
    
    // Try to get from cache
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }

    // Build WHERE conditions for INSIDE the CTE
    let innerWhereConditions = ['e.course_id = $1'];
    let queryParams = [courseId];
    let paramCounter = 2;

    if (assignmentId) {
      innerWhereConditions.push(`a.id = $${paramCounter}`);
      queryParams.push(assignmentId);
      paramCounter++;
    }

    if (status) {
      innerWhereConditions.push(`s.status = $${paramCounter}`);
      queryParams.push(status);
      paramCounter++;
    }

    // ✅ FIXED: This condition goes OUTSIDE the CTE
    let outerWhereCondition = '';
    if (search) {
      outerWhereCondition = `WHERE (name ILIKE $${paramCounter} OR email ILIKE $${paramCounter})`;
      queryParams.push(`%${search}%`);
      paramCounter++;
    }

    const innerWhereClause = innerWhereConditions.join(' AND ');

    // Build ORDER BY clause
    let orderByClause;
    const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    switch (sortBy) {
      case 'progress':
        orderByClause = `completion_rate ${order}`;
        break;
      case 'lastSubmission':
        orderByClause = `last_submission ${order} NULLS LAST`;
        break;
      case 'avgScore':
        orderByClause = `avg_score ${order} NULLS LAST`;
        break;
      case 'name':
      default:
        orderByClause = `name ${order}`;
    }

    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    queryParams.push(limit, offset);

    // Main query with aggregated data
    const query = `
            WITH student_stats AS (
                SELECT 
                    u.id as student_id,
                    u.name,
                    u.email,
                    u.github_id,
                    COUNT(DISTINCT s.id) as total_submissions,
                    COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END) as completed_submissions,
                    COUNT(DISTINCT a.id) as total_assignments,
                    MAX(s.created_at) as last_submission,
                    ROUND(AVG(COALESCE(s.manual_score, s.ai_score))::numeric, 2) as avg_score,
                    ROUND(
                        (COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END)::float / 
                        NULLIF(COUNT(DISTINCT a.id), 0) * 100)::numeric, 2
                    ) as completion_rate
                FROM "user" u
                INNER JOIN enrollment e ON e.user_id = u.id
                LEFT JOIN assignment a ON a.course_id = e.course_id
                LEFT JOIN submission s ON s.assignment_id = a.id AND s.user_id = u.id
                WHERE ${innerWhereClause}
                GROUP BY u.id, u.name, u.email, u.github_id
            )
            SELECT 
                student_id,
                name,
                email,
                github_id,
                total_submissions,
                completed_submissions,
                total_assignments,
                last_submission,
                avg_score,
                completion_rate,
                COUNT(*) OVER() as total_count
            FROM student_stats
            ${outerWhereCondition}
            ORDER BY ${orderByClause}
            LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
        `;

    console.log('[API] Executing query for enrolled students with params:', queryParams);
    const result = await pool.query(query, queryParams);
    console.log('[API] Query successful. Rows:', result.rows.length);

    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count) : 0;
    const totalPages = Math.ceil(totalCount / limit);

    const responseData = {
      students: result.rows.map(row => ({
        id: row.student_id,
        name: row.name,
        email: row.email,
        githubId: row.github_id,
        statistics: {
          totalSubmissions: parseInt(row.total_submissions),
          completedSubmissions: parseInt(row.completed_submissions),
          totalAssignments: parseInt(row.total_assignments),
          lastSubmission: row.last_submission,
          avgScore: row.avg_score ? parseFloat(row.avg_score) : null,
          completionRate: row.completion_rate ? parseFloat(row.completion_rate) : 0
        }
      })),
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: totalCount,
        itemsPerPage: parseInt(limit)
      }
    };

    // Store in cache
    setCachedData(cacheKey, responseData);

    res.json(responseData);

  } catch (error) {
    console.error('[API] Error fetching enrolled students:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

// Geeft uitgebreide status per student voor een cursus (inclusief opdrachtenstatus)
const getStudentStatusByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const {
      search,
      sortBy = 'name',
      sortOrder = 'asc',
      page = 1,
      limit = 50
    } = req.query;

    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    // Generate cache key based on query parameters
    const cacheKey = `course:${courseId}:status:${search || 'none'}:${sortBy}:${sortOrder}:${page}:${limit}`;
    
    // Try to get from cache
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }

    const order = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    let orderByClause;
    switch (sortBy) {
      case 'progress':
        orderByClause = `completion_rate ${order}`;
        break;
      case 'lastSubmission':
        orderByClause = `last_submission ${order} NULLS LAST`;
        break;
      case 'avgScore':
        orderByClause = `avg_score ${order} NULLS LAST`;
        break;
      case 'name':
      default:
        orderByClause = `name ${order}`;
    }

    const offset = (page - 1) * limit;

    // Basisparameters
    const params = [courseId];
    let paramCounter = 2;

    // Zoeken op naam of e-mail
    let outerWhereCondition = '';
    if (search) {
      outerWhereCondition = `WHERE (name ILIKE $${paramCounter} OR email ILIKE $${paramCounter})`;
      params.push(`%${search}%`);
      paramCounter++;
    }

    // Voeg paginatie parameters toe
    params.push(limit, offset);

    const studentStatsQuery = `
      WITH student_stats AS (
        SELECT
          u.id AS student_id,
          u.name,
          u.email,
          u.github_id,
          COUNT(DISTINCT a.id) AS total_assignments,
          COUNT(DISTINCT s.id) AS total_submissions,
          COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN s.assignment_id END) AS assignments_with_submission,
          COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.assignment_id END) AS completed_assignments,
          COUNT(DISTINCT CASE WHEN s.status = 'graded' THEN s.assignment_id END) AS graded_assignments,
          ROUND(AVG(COALESCE(s.manual_score, s.ai_score))::numeric, 2) AS avg_score,
          ROUND(AVG(
            CASE f.severity
              WHEN 'low' THEN 1
              WHEN 'medium' THEN 2
              WHEN 'high' THEN 3
              WHEN 'critical' THEN 4
            END
          )::numeric, 2) AS avg_feedback_severity,
          MAX(s.created_at) AS last_submission,
          (
            SELECT s2.status
            FROM submission s2
            JOIN assignment a2 ON a2.id = s2.assignment_id
            WHERE a2.course_id = $1 AND s2.user_id = u.id
            ORDER BY s2.created_at DESC
            LIMIT 1
          ) AS last_status
        FROM "user" u
        JOIN enrollment e ON e.user_id = u.id AND e.course_id = $1
        LEFT JOIN assignment a ON a.course_id = e.course_id
        LEFT JOIN submission s ON s.assignment_id = a.id AND s.user_id = u.id
        LEFT JOIN feedback f ON f.submission_id = s.id
        GROUP BY u.id, u.name, u.email, u.github_id
      )
      SELECT
        student_id,
        name,
        email,
        github_id,
        total_assignments,
        total_submissions,
        assignments_with_submission,
        completed_assignments,
        graded_assignments,
        avg_score,
        avg_feedback_severity,
        last_submission,
        last_status,
        ROUND((completed_assignments::float / NULLIF(total_assignments, 0) * 100)::numeric, 2) AS completion_rate,
        ROUND((graded_assignments::float / NULLIF(total_assignments, 0) * 100)::numeric, 2) AS graded_rate,
        COUNT(*) OVER() AS total_count
      FROM student_stats
      ${outerWhereCondition}
      ORDER BY ${orderByClause}
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1};
    `;

    const studentStatsResult = await pool.query(studentStatsQuery, params);
    const totalCount = studentStatsResult.rows.length > 0 ? parseInt(studentStatsResult.rows[0].total_count) : 0;
    const totalPages = Math.ceil(totalCount / limit);

    const students = studentStatsResult.rows.map(row => {
      const totalAssignments = parseInt(row.total_assignments || 0);
      const assignmentsWithSubmission = parseInt(row.assignments_with_submission || 0);
      return {
        id: row.student_id,
        name: row.name,
        email: row.email,
        githubId: row.github_id,
        statistics: {
          totalAssignments,
          totalSubmissions: parseInt(row.total_submissions || 0),
          completedAssignments: parseInt(row.completed_assignments || 0),
          gradedAssignments: parseInt(row.graded_assignments || 0),
          pendingAssignments: Math.max(totalAssignments - assignmentsWithSubmission, 0),
          avgScore: row.avg_score ? parseFloat(row.avg_score) : null,
          avgFeedbackSeverity: row.avg_feedback_severity ? parseFloat(row.avg_feedback_severity) : null,
          lastSubmission: row.last_submission,
          lastStatus: row.last_status,
          completionRate: row.completion_rate ? parseFloat(row.completion_rate) : 0,
          gradedRate: row.graded_rate ? parseFloat(row.graded_rate) : 0
        },
        assignments: []
      };
    });

    // Haal per-student per-opdracht status op voor de huidige pagina
    const studentIds = students.map(s => s.id);
    if (studentIds.length === 0) {
      return res.json({
        students,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: totalCount,
          itemsPerPage: parseInt(limit)
        }
      });
    }

    const assignmentStatusQuery = `
      SELECT
        u.id AS student_id,
        a.id AS assignment_id,
        a.title,
        a.due_date,
        ls.status AS last_status,
        ls.created_at AS last_submission,
        ls.ai_score,
        ls.manual_score,
        feedback_stats.severity_avg AS feedback_severity
      FROM "user" u
      JOIN enrollment e ON e.user_id = u.id AND e.course_id = $1
      JOIN assignment a ON a.course_id = e.course_id
      LEFT JOIN LATERAL (
        SELECT s.id, s.status, s.created_at, s.ai_score, s.manual_score
        FROM submission s
        WHERE s.assignment_id = a.id AND s.user_id = u.id
        ORDER BY s.created_at DESC
        LIMIT 1
      ) ls ON true
      LEFT JOIN LATERAL (
        SELECT ROUND(AVG(CASE f.severity
          WHEN 'low' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'high' THEN 3
          WHEN 'critical' THEN 4
        END)::numeric, 2) AS severity_avg
        FROM feedback f
        WHERE ls.id IS NOT NULL AND f.submission_id = ls.id
      ) feedback_stats ON true
      WHERE u.id = ANY($2::int[])
      ORDER BY u.id, a.due_date;
    `;

    const assignmentStatusResult = await pool.query(assignmentStatusQuery, [courseId, studentIds]);

    // Koppel opdrachten aan studenten
    const studentMap = new Map();
    students.forEach(s => studentMap.set(s.id, s));

    assignmentStatusResult.rows.forEach(row => {
      const student = studentMap.get(row.student_id);
      if (!student) return;
      student.assignments.push({
        assignmentId: row.assignment_id,
        title: row.title,
        dueDate: row.due_date,
        status: row.last_status || 'pending',
        lastSubmission: row.last_submission,
        aiScore: row.ai_score,
        manualScore: row.manual_score,
        feedbackSeverity: row.feedback_severity ? parseFloat(row.feedback_severity) : null
      });
    });

    const responseData = {
      students,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: totalCount,
        itemsPerPage: parseInt(limit)
      }
    };

    // Store in cache
    setCachedData(cacheKey, responseData);

    res.json(responseData);
  } catch (error) {
    console.error('[API] Error fetching student status by course:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

// Status voor één student in een cursus (met opdrachten)
const getStudentStatusForStudent = async (req, res) => {
  try {
    const { courseId, studentId } = req.params;

    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }
    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required' });
    }

    const statsQuery = `
      WITH student_stats AS (
        SELECT
          u.id AS student_id,
          u.name,
          u.email,
          u.github_id,
          COUNT(DISTINCT a.id) AS total_assignments,
          COUNT(DISTINCT s.id) AS total_submissions,
          COUNT(DISTINCT CASE WHEN s.id IS NOT NULL THEN s.assignment_id END) AS assignments_with_submission,
          COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.assignment_id END) AS completed_assignments,
          COUNT(DISTINCT CASE WHEN s.status = 'graded' THEN s.assignment_id END) AS graded_assignments,
          ROUND(AVG(COALESCE(s.manual_score, s.ai_score))::numeric, 2) AS avg_score,
          ROUND(AVG(
            CASE f.severity
              WHEN 'low' THEN 1
              WHEN 'medium' THEN 2
              WHEN 'high' THEN 3
              WHEN 'critical' THEN 4
            END
          )::numeric, 2) AS avg_feedback_severity,
          MAX(s.created_at) AS last_submission,
          (
            SELECT s2.status
            FROM submission s2
            JOIN assignment a2 ON a2.id = s2.assignment_id
            WHERE a2.course_id = $1 AND s2.user_id = u.id
            ORDER BY s2.created_at DESC
            LIMIT 1
          ) AS last_status
        FROM "user" u
        JOIN enrollment e ON e.user_id = u.id AND e.course_id = $1
        LEFT JOIN assignment a ON a.course_id = e.course_id
        LEFT JOIN submission s ON s.assignment_id = a.id AND s.user_id = u.id
        LEFT JOIN feedback f ON f.submission_id = s.id
        WHERE u.id = $2
        GROUP BY u.id, u.name, u.email, u.github_id
      )
      SELECT
        student_id,
        name,
        email,
        github_id,
        total_assignments,
        total_submissions,
        assignments_with_submission,
        completed_assignments,
        graded_assignments,
        avg_score,
        avg_feedback_severity,
        last_submission,
        last_status,
        ROUND((completed_assignments::float / NULLIF(total_assignments, 0) * 100)::numeric, 2) AS completion_rate,
        ROUND((graded_assignments::float / NULLIF(total_assignments, 0) * 100)::numeric, 2) AS graded_rate
      FROM student_stats;
    `;

    const statsResult = await pool.query(statsQuery, [courseId, studentId]);
    if (statsResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found in this course' });
    }

    const row = statsResult.rows[0];
    const totalAssignments = parseInt(row.total_assignments || 0);
    const assignmentsWithSubmission = parseInt(row.assignments_with_submission || 0);

    const student = {
      id: row.student_id,
      name: row.name,
      email: row.email,
      githubId: row.github_id,
      statistics: {
        totalAssignments,
        totalSubmissions: parseInt(row.total_submissions || 0),
        completedAssignments: parseInt(row.completed_assignments || 0),
        gradedAssignments: parseInt(row.graded_assignments || 0),
        pendingAssignments: Math.max(totalAssignments - assignmentsWithSubmission, 0),
        avgScore: row.avg_score ? parseFloat(row.avg_score) : null,
        avgFeedbackSeverity: row.avg_feedback_severity ? parseFloat(row.avg_feedback_severity) : null,
        lastSubmission: row.last_submission,
        lastStatus: row.last_status,
        completionRate: row.completion_rate ? parseFloat(row.completion_rate) : 0,
        gradedRate: row.graded_rate ? parseFloat(row.graded_rate) : 0
      },
      assignments: []
    };

    const assignmentStatusQuery = `
      SELECT
        a.id AS assignment_id,
        a.title,
        a.due_date,
        ls.status AS last_status,
        ls.created_at AS last_submission,
        ls.ai_score,
        ls.manual_score,
        feedback_stats.severity_avg AS feedback_severity
      FROM assignment a
      JOIN enrollment e ON e.course_id = a.course_id AND e.user_id = $2
      LEFT JOIN LATERAL (
        SELECT s.id, s.status, s.created_at, s.ai_score, s.manual_score
        FROM submission s
        WHERE s.assignment_id = a.id AND s.user_id = $2
        ORDER BY s.created_at DESC
        LIMIT 1
      ) ls ON true
      LEFT JOIN LATERAL (
        SELECT ROUND(AVG(CASE f.severity
          WHEN 'low' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'high' THEN 3
          WHEN 'critical' THEN 4
        END)::numeric, 2) AS severity_avg
        FROM feedback f
        WHERE ls.id IS NOT NULL AND f.submission_id = ls.id
      ) feedback_stats ON true
      WHERE a.course_id = $1
      ORDER BY a.due_date;
    `;

    const assignmentStatusResult = await pool.query(assignmentStatusQuery, [courseId, studentId]);
    assignmentStatusResult.rows.forEach(row => {
      student.assignments.push({
        assignmentId: row.assignment_id,
        title: row.title,
        dueDate: row.due_date,
        status: row.last_status || 'pending',
        lastSubmission: row.last_submission,
        aiScore: row.ai_score,
        manualScore: row.manual_score,
        feedbackSeverity: row.feedback_severity ? parseFloat(row.feedback_severity) : null
      });
    });

    res.json({ student });
  } catch (error) {
    console.error('[API] Error fetching student status:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

const addStudentToCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    console.log('[API] POST /api/docent/courses/:courseId/students - Add student request');
    console.log('[API] Request user:', req.user ? `ID: ${req.user.id}, Role: ${req.user.role}` : 'No user');
    console.log('[API] Course ID:', courseId);

    if (!req.body) {
      console.log('[API] Request body is missing');
      return res.status(400).json({
        error: 'Request body is missing',
        hint: 'Ensure you are sending a JSON body and setting Content-Type: application/json'
      });
    }

    const { email } = req.body;
    console.log('[API] Adding student to course');

    if (!courseId) {
      console.log('[API] courseId is missing');
      return res.status(400).json({ error: 'courseId is required' });
    }
    if (!email) {
      console.log('[API] email is missing');
      return res.status(400).json({ error: 'email is required' });
    }

    // 1. Find the user by email
    console.log('[API] Looking up user by email');
    const userResult = await pool.query(
      'SELECT id, role FROM "user" WHERE email = $1',
      [email]
    );

    console.log('[API] User lookup result:', {
      rowCount: userResult.rows.length,
      found: userResult.rows.length > 0
    });

    if (userResult.rows.length === 0) {
      console.log('[API] Student not found');
      return res.status(404).json({ error: 'Student not found with this email' });
    }

    const user = userResult.rows[0];
    
    // Validate that the user is a student
    if (user.role !== 'student') {
      console.log('❌ [STEP 1] User found but is not a student. Role:', user.role);
      return res.status(400).json({ 
        error: 'Only users with student role can be enrolled in courses',
        userRole: user.role
      });
    }

    const studentId = user.id;
    console.log('✅ [STEP 1] Student found - ID:', studentId, '| Role:', user.role);

    // 2. Check if already enrolled
    console.log('[API] Checking enrollment status for course:', courseId, 'student:', studentId);
    
    const enrollmentCheck = await pool.query(
      'SELECT id FROM enrollment WHERE course_id = $1 AND user_id = $2',
      [courseId, studentId]
    );

    console.log('[API] Enrollment check result:', {
      rowCount: enrollmentCheck.rows.length,
      alreadyEnrolled: enrollmentCheck.rows.length > 0
    });

    if (enrollmentCheck.rows.length > 0) {
      console.log('[API] Student already enrolled in course');
      return res.status(409).json({ error: 'Student is already enrolled in this course' });
    }

    // 3. Enroll the student
    console.log('[API] Enrolling student in course');
    
    await pool.query(
      'INSERT INTO enrollment (course_id, user_id) VALUES ($1, $2)',
      [courseId, studentId]
    );

    console.log('✅ [STEP 3] Student successfully enrolled!');
    
    // 4. Emit real-time event for SSE clients
    notificationService.emitEnrollmentChange(courseId, {
      action: 'added',
      studentId,
      studentEmail: email,
      studentName: userResult.rows[0].name || null
    });
    
    // Structured event log
    logger.event('enrollment_added', {
      courseId: parseInt(courseId),
      assignmentId: null,
      submissionId: null,
      userId: studentId,
      actorId: req.user.id,
      oldStatus: null,
      newStatus: 'enrolled',
      metadata: {
        studentEmail: email,
        studentName: userResult.rows[0].name || null,
        actorEmail: req.user.email,
        actorRole: req.user.role
      }
    });
    
    // 5. Invalidate cache for this course
    invalidateCourseCache(courseId);
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 [ADD STUDENT] Successfully completed');
    console.log('═══════════════════════════════════════════════════════');

    res.status(201).json({ message: 'Student successfully added to the course' });

  } catch (error) {
    console.error('[API] Error adding student to course:', error.message);
    
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

const removeStudentFromCourse = async (req, res) => {
  try {
    const { courseId, studentId } = req.params;

    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }
    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required' });
    }

    // Check if the enrollment exists and get student info
    const checkResult = await pool.query(
      'SELECT e.id, u.name, u.email FROM enrollment e JOIN "user" u ON e.user_id = u.id WHERE e.course_id = $1 AND e.user_id = $2',
      [courseId, studentId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student is not enrolled in this course' });
    }

    const studentInfo = checkResult.rows[0];

    // Remove the student
    await pool.query(
      'DELETE FROM enrollment WHERE course_id = $1 AND user_id = $2',
      [courseId, studentId]
    );

    // Emit real-time event for SSE clients
    notificationService.emitEnrollmentChange(courseId, {
      action: 'removed',
      studentId: parseInt(studentId),
      studentEmail: studentInfo.email,
      studentName: studentInfo.name
    });
    
    // Structured event log
    logger.event('enrollment_removed', {
      courseId: parseInt(courseId),
      assignmentId: null,
      submissionId: null,
      userId: parseInt(studentId),
      actorId: req.user.id,
      oldStatus: 'enrolled',
      newStatus: 'removed',
      metadata: {
        studentEmail: studentInfo.email,
        studentName: studentInfo.name,
        actorEmail: req.user.email,
        actorRole: req.user.role
      }
    });

    // Invalidate cache for this course
    invalidateCourseCache(courseId);

    res.json({ message: 'Student successfully removed from the course' });

  } catch (error) {
    console.error('[API] Error removing student from course:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

const createCourse = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { title, description, join_code } = req.body;

    // Authorization check
    if (userRole !== 'teacher' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Only teachers and admins can create courses' });
    }

    // Validation: title required
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required and cannot be empty' });
    }

    // Insert course
    const courseResult = await pool.query(
      `INSERT INTO course (title, description, join_code, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING id, title, description, join_code, created_at as "createdAt", updated_at as "updatedAt"`,
      [title.trim(), description || null, join_code || null]
    );

    const newCourse = courseResult.rows[0];

    // Add authenticated user as teacher
    await pool.query(
      `INSERT INTO course_teacher (course_id, user_id, created_at)
       VALUES ($1, $2, NOW())`,
      [newCourse.id, userId]
    );

    console.log(`✅ Course created: ${newCourse.id} by user ${userId}`);
    res.status(201).json({ course: newCourse });

  } catch (error) {
    console.error('❌ Error creating course:', error.message);

    // Handle duplicate join_code
    if (error.code === '23505' && error.constraint === 'course_join_code_key') {
      return res.status(409).json({ error: 'Join code already exists' });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

const updateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { title, description, join_code } = req.body;

    // Validation: courseId required
    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    // Validation: title required and not empty
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required and cannot be empty' });
    }

    // Check if course exists
    const courseCheck = await pool.query(
      'SELECT id FROM course WHERE id = $1',
      [courseId]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Authorization check: verify user is a teacher of this course
    const accessCheck = await pool.query(
      'SELECT 1 FROM course_teacher WHERE course_id = $1 AND user_id = $2',
      [courseId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to edit this course' });
    }

    // Update course
    const updateResult = await pool.query(
      `UPDATE course 
       SET title = $1, description = $2, join_code = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING id, title, description, join_code, created_at as "createdAt", updated_at as "updatedAt"`,
      [title.trim(), description || null, join_code || null, courseId]
    );

    const updatedCourse = updateResult.rows[0];

    // Invalidate cache for this course
    invalidateCourseCache(courseId);

    console.log(`✅ Course updated: ${courseId} by user ${userId}`);
    res.json({ course: updatedCourse });

  } catch (error) {
    console.error('❌ Error updating course:', error.message);

    // Handle duplicate join_code
    if (error.code === '23505' && error.constraint === 'course_join_code_key') {
      return res.status(409).json({ error: 'Join code already exists' });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

const getDocentCourses = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(`
      SELECT 
        c.id,
        c.title,
        c.description,
        c.join_code as "joinCode",
        c.created_at as "createdAt",
        c.updated_at as "updatedAt",
        COUNT(DISTINCT e.user_id) as "studentCount",
        COUNT(DISTINCT a.id) as "assignmentCount"
      FROM course c
      INNER JOIN course_teacher ct ON c.id = ct.course_id
      LEFT JOIN enrollment e ON c.id = e.course_id
      LEFT JOIN assignment a ON c.id = a.course_id
      WHERE ct.user_id = $1
      GROUP BY c.id, c.title, c.description, c.join_code, c.created_at, c.updated_at
      ORDER BY c.created_at DESC
    `, [userId]);

    const courses = result.rows.map(course => ({
      ...course,
      studentCount: parseInt(course.studentCount) || 0,
      assignmentCount: parseInt(course.assignmentCount) || 0
    }));

    res.status(200).json({ courses });
  } catch (error) {
    console.error('[API] Error fetching docent courses:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

const deleteCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Validation: courseId required
    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    // Check if course exists
    const courseCheck = await pool.query(
      'SELECT id, title, description, join_code FROM course WHERE id = $1',
      [courseId]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Authorization check: verify user is a teacher of this course
    const accessCheck = await pool.query(
      'SELECT 1 FROM course_teacher WHERE course_id = $1 AND user_id = $2',
      [courseId, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to delete this course' });
    }

    const courseData = courseCheck.rows[0];

    // Delete course (CASCADE will handle related data)
    const deleteResult = await pool.query(
      `DELETE FROM course
       WHERE id = $1
       RETURNING id, title, description, join_code`,
      [courseId]
    );

    const deletedCourse = deleteResult.rows[0];

    // Structured event log
    logger.event('course_deleted', {
      courseId: parseInt(courseId),
      assignmentId: null,
      submissionId: null,
      userId: null,
      actorId: req.user.id,
      oldStatus: 'active',
      newStatus: 'deleted',
      metadata: {
        courseTitle: courseData.title,
        actorEmail: req.user.email,
        actorRole: req.user.role
      }
    });

    // Invalidate cache for this course
    invalidateCourseCache(courseId);

    console.log(`✅ Course deleted: ${courseId} by user ${userId}`);
    res.json({
      message: 'Course successfully deleted',
      course: {
        id: deletedCourse.id,
        title: deletedCourse.title,
        description: deletedCourse.description,
        join_code: deletedCourse.join_code
      }
    });

  } catch (error) {
    console.error('❌ Error deleting course:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

const streamCourseStatistics = async (req, res) => {
  try {
    const { courseId } = req.params;
    
    // ✅ Support token via query parameter for EventSource (doesn't support headers)
    let userId;
    
    if (req.user && req.user.id) {
      // Normal authentication via middleware
      userId = req.user.id;
    } else if (req.query.token) {
      // Authentication via query parameter for EventSource
      const jwt = require('jsonwebtoken');
      try {
        const decoded = jwt.verify(req.query.token, process.env.JWT_SECRET);
        userId = decoded.id;
        console.log(`🔑 [SSE] Authenticated via query token for user ${userId}`);
      } catch (error) {
        console.log(`❌ [SSE] Invalid token in query parameter`);
        return res.status(401).json({ error: 'Invalid token' });
      }
    } else {
      console.log(`❌ [SSE] No authentication provided`);
      return res.status(401).json({ error: 'No authentication provided' });
    }

    console.log(`📡 [SSE] Connection request for course ${courseId} by user ${userId}`);

    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    // Verify user has access to this course
    const accessCheck = await pool.query(
      'SELECT 1 FROM course_teacher WHERE course_id = $1 AND user_id = $2',
      [courseId, userId]
    );

    if (accessCheck.rows.length === 0) {
      console.log(`❌ [SSE] User ${userId} has no access to course ${courseId}`);
      return res.status(403).json({ error: 'No access to this course' });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection message
    res.write(`data: ${JSON.stringify({
      type: 'connection:established',
      courseId: parseInt(courseId),
      timestamp: new Date().toISOString()
    })}\n\n`);

    console.log(`✅ [SSE] Connection established for course ${courseId}`);

    // Register connection with notification service
    const notificationService = require('../services/notificationService');
    const cleanup = notificationService.registerConnection(courseId, res);

    // Handle client disconnect
    req.on('close', () => {
      console.log(`🔌 [SSE] Client disconnected from course ${courseId}`);
      cleanup();
    });

    req.on('error', (error) => {
      console.error(`❌ [SSE] Connection error for course ${courseId}:`, error.message);
      cleanup();
    });

  } catch (error) {
    console.error('❌ [SSE] Error setting up statistics stream:', error.message);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
};

// Haal alle opdrachten van de docent op (over alle vakken)
const getDocentAssignments = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      courseId,
      sortBy = 'dueDate',
      sortOrder = 'asc',
      page = 1,
      limit = 50
    } = req.query;

    // Validate sortBy
    const validSortFields = ['dueDate', 'title', 'createdAt', 'courseTitle'];
    const sortFieldMap = {
      dueDate: 'a.due_date',
      title: 'a.title',
      createdAt: 'a.created_at',
      courseTitle: 'c.title'
    };
    const safeSortBy = validSortFields.includes(sortBy) ? sortFieldMap[sortBy] : 'a.due_date';
    const safeOrder = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // Build WHERE conditions
    let whereConditions = ['ct.user_id = $1'];
    let queryParams = [userId];
    let paramCounter = 2;

    if (courseId) {
      whereConditions.push(`a.course_id = $${paramCounter}`);
      queryParams.push(courseId);
      paramCounter++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Count query for pagination
    const countResult = await pool.query(`
      SELECT COUNT(DISTINCT a.id) as total
      FROM assignment a
      INNER JOIN course c ON c.id = a.course_id
      INNER JOIN course_teacher ct ON ct.course_id = c.id
      WHERE ${whereClause}
    `, queryParams);

    const totalItems = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(totalItems / limit);
    const offset = (page - 1) * limit;

    // Add pagination params
    queryParams.push(limit, offset);

    // Main query
    const result = await pool.query(`
      SELECT 
        a.id,
        a.title,
        a.description,
        a.course_id,
        a.due_date,
        a.rubric,
        a.ai_guidelines,
        a.created_at,
        a.updated_at,
        c.title as course_title
      FROM assignment a
      INNER JOIN course c ON c.id = a.course_id
      INNER JOIN course_teacher ct ON ct.course_id = c.id
      WHERE ${whereClause}
      ORDER BY ${safeSortBy} ${safeOrder} NULLS LAST
      LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
    `, queryParams);

    // Map to camelCase
    const assignments = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      courseId: row.course_id,
      courseTitle: row.course_title,
      dueDate: row.due_date,
      rubric: row.rubric,
      aiGuidelines: row.ai_guidelines,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json({
      assignments,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('[API] Error fetching docent assignments:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

// Haal opdrachten van een specifiek vak op
const getDocentCourseAssignments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.params;
    const {
      sortBy = 'dueDate',
      sortOrder = 'asc'
    } = req.query;

    // Validate courseId
    const courseIdNum = parseInt(courseId, 10);
    if (isNaN(courseIdNum)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }

    // Check if course exists
    const courseCheck = await pool.query(
      'SELECT id FROM course WHERE id = $1',
      [courseIdNum]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Authorization check: verify user is a teacher of this course
    const accessCheck = await pool.query(
      'SELECT 1 FROM course_teacher WHERE course_id = $1 AND user_id = $2',
      [courseIdNum, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to access this course'
      });
    }

    // Build ORDER BY clause based on sortBy parameter
    let orderByClause;
    const validSortFields = {
      'dueDate': 'a.due_date',
      'title': 'a.title',
      'createdAt': 'a.created_at',
      'submissionCount': 'submission_count'
    };

    const sortField = validSortFields[sortBy] || 'a.due_date';
    const order = sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    
    // For due_date and date fields, handle NULLs
    if (sortField === 'a.due_date' || sortField === 'a.created_at') {
      orderByClause = `${sortField} ${order} NULLS LAST`;
    } else {
      orderByClause = `${sortField} ${order}`;
    }

    // Fetch assignments with submission count
    const result = await pool.query(
      `SELECT 
        a.id,
        a.title,
        a.description,
        a.due_date,
        a.rubric,
        a.ai_guidelines,
        a.created_at,
        a.updated_at,
        COUNT(DISTINCT s.id) as submission_count
      FROM assignment a
      LEFT JOIN submission s ON a.id = s.assignment_id
      WHERE a.course_id = $1
      GROUP BY a.id, a.title, a.description, a.due_date, a.rubric, a.ai_guidelines, a.created_at, a.updated_at
      ORDER BY ${orderByClause}`,
      [courseIdNum]
    );

    // Convert to camelCase
    const assignments = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      dueDate: row.due_date,
      rubric: row.rubric,
      aiGuidelines: row.ai_guidelines,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      submissionCount: parseInt(row.submission_count, 10)
    }));

    res.json({ assignments });
  } catch (error) {
    console.error('[API] Error fetching course assignments:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

const createAssignment = async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { title, description, course_id, due_date, rubric, ai_guidelines } = req.body;

    // Authorization check: verify user is teacher or admin
    if (userRole !== 'teacher' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Only teachers and admins can create assignments' });
    }

    // Validation: title required
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required and cannot be empty' });
    }

    // Validation: title max length
    if (title.trim().length > 255) {
      return res.status(400).json({ error: 'Title cannot exceed 255 characters' });
    }

    // Validation: course_id required
    if (!course_id) {
      return res.status(400).json({ error: 'course_id is required' });
    }

    // Validation: course_id must be a valid integer
    const courseIdNum = parseInt(course_id, 10);
    if (isNaN(courseIdNum)) {
      return res.status(400).json({ error: 'Invalid course_id: must be an integer' });
    }

    // Validation: due_date format (if provided)
    let dueDateValue = null;
    if (due_date) {
      const parsedDate = new Date(due_date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: 'Invalid due_date format: must be a valid ISO8601 date' });
      }
      dueDateValue = due_date;
    }

    // Check if course exists
    const courseCheck = await pool.query(
      'SELECT id FROM course WHERE id = $1',
      [courseIdNum]
    );

    if (courseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Authorization check: verify user is a teacher of this course (admins bypass this)
    if (userRole !== 'admin') {
      const accessCheck = await pool.query(
        'SELECT 1 FROM course_teacher WHERE course_id = $1 AND user_id = $2',
        [courseIdNum, userId]
      );

      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Forbidden: You are not a teacher of this course' });
      }
    }

    // Insert assignment
    const assignmentResult = await pool.query(
      `INSERT INTO assignment (title, description, course_id, due_date, rubric, ai_guidelines, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING id, title, description, course_id as "courseId", due_date as "dueDate", rubric, ai_guidelines as "aiGuidelines", created_at as "createdAt", updated_at as "updatedAt"`,
      [title.trim(), description || null, courseIdNum, dueDateValue, rubric || null, ai_guidelines || null]
    );

    const newAssignment = assignmentResult.rows[0];

    // Invalidate cache for this course
    invalidateCourseCache(courseIdNum);

    console.log(`✅ Assignment created: ${newAssignment.id} for course ${courseIdNum} by user ${userId}`);
    res.status(201).json({ assignment: newAssignment });

  } catch (error) {
    console.error('❌ Error creating assignment:', error.message);

    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Get detailed information about a specific assignment
 * Includes assignment details, submission statistics, and all student submissions
 * @route GET /api/docent/assignments/:assignmentId
 */
const getAssignmentDetail = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validate assignment ID
    const assignmentIdNum = parseInt(assignmentId, 10);
    if (isNaN(assignmentIdNum)) {
      return res.status(400).json({ error: 'Invalid assignment ID' });
    }

    // Get assignment details with course info and verify authorization in one query
    const assignmentQuery = `
      SELECT 
        a.id,
        a.title,
        a.description,
        a.course_id,
        a.due_date,
        a.rubric,
        a.ai_guidelines,
        a.created_at,
        a.updated_at,
        c.title as course_title,
        CASE 
          WHEN $3 = 'admin' THEN TRUE
          WHEN ct.user_id IS NOT NULL THEN TRUE
          ELSE FALSE
        END as has_access
      FROM assignment a
      JOIN course c ON a.course_id = c.id
      LEFT JOIN course_teacher ct ON ct.course_id = c.id AND ct.user_id = $2
      WHERE a.id = $1
    `;

    const assignmentResult = await pool.query(assignmentQuery, [assignmentIdNum, userId, userRole]);

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const assignmentData = assignmentResult.rows[0];

    // Check authorization
    if (!assignmentData.has_access) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Get submission statistics
    const statsQuery = `
      SELECT
        COUNT(DISTINCT s.id) as total_submissions,
        COUNT(DISTINCT s.user_id) as students_submitted,
        COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END) as completed_count,
        COUNT(DISTINCT CASE WHEN s.status = 'graded' THEN s.id END) as graded_count,
        ROUND(AVG(COALESCE(s.manual_score, s.ai_score))::numeric, 2) as avg_score
      FROM submission s
      WHERE s.assignment_id = $1
    `;

    const statsResult = await pool.query(statsQuery, [assignmentIdNum]);
    const statistics = statsResult.rows[0];

    // Get all student submissions for this assignment
    const submissionsQuery = `
      SELECT
        u.id as student_id,
        u.name,
        u.email,
        s.id as submission_id,
        s.status,
        s.created_at as submission_date,
        s.ai_score,
        s.manual_score,
        s.github_url,
        COUNT(f.id) as feedback_count,
        ROUND(AVG(
          CASE 
            WHEN f.severity = 'critical' THEN 4
            WHEN f.severity = 'high' THEN 3
            WHEN f.severity = 'medium' THEN 2
            WHEN f.severity = 'low' THEN 1
            ELSE 0
          END
        )::numeric, 2) as feedback_severity_avg
      FROM enrollment e
      JOIN "user" u ON e.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT s.*
        FROM submission s
        WHERE s.assignment_id = $1 AND s.user_id = u.id
        ORDER BY s.created_at DESC
        LIMIT 1
      ) s ON true
      LEFT JOIN feedback f ON f.submission_id = s.id
      WHERE e.course_id = $2
      GROUP BY u.id, u.name, u.email, s.id, s.status, s.created_at, s.ai_score, s.manual_score, s.github_url
      ORDER BY u.name ASC
    `;

    const submissionsResult = await pool.query(submissionsQuery, [assignmentIdNum, assignmentData.course_id]);

    // Format response with camelCase
    const response = {
      assignment: {
        id: assignmentData.id,
        title: assignmentData.title,
        description: assignmentData.description,
        courseId: assignmentData.course_id,
        dueDate: assignmentData.due_date,
        rubric: assignmentData.rubric,
        aiGuidelines: assignmentData.ai_guidelines,
        createdAt: assignmentData.created_at,
        updatedAt: assignmentData.updated_at
      },
      course: {
        id: assignmentData.course_id,
        title: assignmentData.course_title
      },
      statistics: {
        totalSubmissions: parseInt(statistics.total_submissions) || 0,
        studentsSubmitted: parseInt(statistics.students_submitted) || 0,
        completedCount: parseInt(statistics.completed_count) || 0,
        gradedCount: parseInt(statistics.graded_count) || 0,
        avgScore: statistics.avg_score ? parseFloat(statistics.avg_score) : null
      },
      submissions: submissionsResult.rows.map(row => ({
        studentId: row.student_id,
        name: row.name,
        email: row.email,
        submissionId: row.submission_id,
        status: row.status,
        submissionDate: row.submission_date,
        aiScore: row.ai_score,
        manualScore: row.manual_score,
        githubUrl: row.github_url,
        feedbackCount: parseInt(row.feedback_count) || 0,
        feedbackSeverityAvg: row.feedback_severity_avg ? parseFloat(row.feedback_severity_avg) : null
      }))
    };

    console.log(`✅ Assignment detail fetched: ${assignmentIdNum} by user ${userId}`);
    res.json(response);

  } catch (error) {
    console.error('❌ Error fetching assignment detail:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Update an existing assignment
 * @route PUT /api/docent/assignments/:assignmentId
 */
const updateAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { title, description, dueDate, rubric, aiGuidelines } = req.body;

    // Validate assignment ID
    const assignmentIdNum = parseInt(assignmentId, 10);
    if (isNaN(assignmentIdNum)) {
      return res.status(400).json({ error: 'Invalid assignment ID: must be an integer' });
    }

    // Authorization check: verify user is teacher or admin
    if (userRole !== 'teacher' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Only teachers and admins can update assignments' });
    }

    // Check if assignment exists and get course_id
    const assignmentCheck = await pool.query(
      'SELECT id, course_id FROM assignment WHERE id = $1',
      [assignmentIdNum]
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const courseId = assignmentCheck.rows[0].course_id;

    // Authorization check: verify user is a teacher of the assignment's course (admins bypass this)
    if (userRole !== 'admin') {
      const accessCheck = await pool.query(
        'SELECT 1 FROM course_teacher WHERE course_id = $1 AND user_id = $2',
        [courseId, userId]
      );

      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Forbidden: You are not a teacher of this course' });
      }
    }

    // Build dynamic UPDATE query based on provided fields
    const updateFields = [];
    const queryParams = [];
    let paramCounter = 1;

    // Validate and add title if provided
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        return res.status(400).json({ error: 'Title cannot be empty' });
      }
      if (title.trim().length > 255) {
        return res.status(400).json({ error: 'Title cannot exceed 255 characters' });
      }
      updateFields.push(`title = $${paramCounter}`);
      queryParams.push(title.trim());
      paramCounter++;
    }

    // Add description if provided (can be null)
    if (description !== undefined) {
      updateFields.push(`description = $${paramCounter}`);
      queryParams.push(description || null);
      paramCounter++;
    }

    // Validate and add due_date if provided
    if (dueDate !== undefined) {
      if (dueDate !== null) {
        const parsedDate = new Date(dueDate);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({ error: 'Invalid dueDate format: must be a valid ISO8601 date' });
        }
      }
      updateFields.push(`due_date = $${paramCounter}`);
      queryParams.push(dueDate);
      paramCounter++;
    }

    // Add rubric if provided (can be null)
    if (rubric !== undefined) {
      updateFields.push(`rubric = $${paramCounter}`);
      queryParams.push(rubric || null);
      paramCounter++;
    }

    // Add ai_guidelines if provided (can be null)
    if (aiGuidelines !== undefined) {
      updateFields.push(`ai_guidelines = $${paramCounter}`);
      queryParams.push(aiGuidelines || null);
      paramCounter++;
    }

    // If no fields to update, return error
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    // Always update updated_at
    updateFields.push(`updated_at = NOW()`);

    // Add assignment ID as the final parameter
    queryParams.push(assignmentIdNum);

    // Execute UPDATE query
    const updateQuery = `
      UPDATE assignment
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCounter}
      RETURNING id, title, description, course_id as "courseId", due_date as "dueDate", rubric, ai_guidelines as "aiGuidelines", created_at as "createdAt", updated_at as "updatedAt"
    `;

    const result = await pool.query(updateQuery, queryParams);
    const updatedAssignment = result.rows[0];

    // Invalidate cache for this course and assignment
    invalidateCourseCache(courseId);
    invalidateAssignmentCache(assignmentIdNum);

    console.log(`✅ Assignment updated: ${assignmentIdNum} by user ${userId}`);
    res.json({ assignment: updatedAssignment });

  } catch (error) {
    console.error('❌ Error updating assignment:', error.message);

    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Delete an assignment
 * @route DELETE /api/docent/assignments/:assignmentId
 */
const deleteAssignment = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validation: assignmentId required
    if (!assignmentId) {
      return res.status(400).json({ error: 'assignmentId is required' });
    }

    // Validate assignment ID
    const assignmentIdNum = parseInt(assignmentId, 10);
    if (isNaN(assignmentIdNum)) {
      return res.status(400).json({ error: 'Invalid assignment ID: must be an integer' });
    }

    // Check if assignment exists and get its data
    const assignmentCheck = await pool.query(
      'SELECT id, title, description, course_id, due_date, rubric, ai_guidelines FROM assignment WHERE id = $1',
      [assignmentIdNum]
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const assignmentData = assignmentCheck.rows[0];
    const courseId = assignmentData.course_id;

    // Authorization check: verify user is a teacher of the assignment's course (admins bypass this)
    if (userRole !== 'admin') {
      const accessCheck = await pool.query(
        'SELECT 1 FROM course_teacher WHERE course_id = $1 AND user_id = $2',
        [courseId, userId]
      );

      if (accessCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to delete this assignment' });
      }
    }

    // Delete assignment (CASCADE will handle related submissions and feedback)
    const deleteResult = await pool.query(
      `DELETE FROM assignment
       WHERE id = $1
       RETURNING id, title, description, course_id, due_date, rubric, ai_guidelines`,
      [assignmentIdNum]
    );

    const deletedAssignment = deleteResult.rows[0];

    // Structured event log
    logger.event('assignment_deleted', {
      courseId: parseInt(courseId),
      assignmentId: parseInt(assignmentIdNum),
      submissionId: null,
      userId: null,
      actorId: req.user.id,
      oldStatus: 'active',
      newStatus: 'deleted',
      metadata: {
        assignmentTitle: assignmentData.title,
        actorEmail: req.user.email,
        actorRole: req.user.role
      }
    });

    // Invalidate cache for this course and assignment
    invalidateCourseCache(courseId);
    invalidateAssignmentCache(assignmentIdNum);

    console.log(`✅ Assignment deleted: ${assignmentIdNum} from course ${courseId} by user ${userId}`);
    res.json({
      message: 'Assignment successfully deleted',
      assignment: {
        id: deletedAssignment.id,
        title: deletedAssignment.title,
        description: deletedAssignment.description,
        courseId: deletedAssignment.course_id,
        dueDate: deletedAssignment.due_date,
        rubric: deletedAssignment.rubric,
        aiGuidelines: deletedAssignment.ai_guidelines
      }
    });

  } catch (error) {
    console.error('❌ Error deleting assignment:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Get live statistics for a specific assignment
 * @route GET /api/docent/assignments/:assignmentId/statistics
 */
const getAssignmentStatistics = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validate assignment ID
    const assignmentIdNum = parseInt(assignmentId, 10);
    if (isNaN(assignmentIdNum)) {
      return res.status(400).json({ error: 'Invalid assignment ID' });
    }

    // Generate cache key
    const cacheKey = `assignment:${assignmentIdNum}:statistics`;
    
    // Try to get from cache
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }

    // Get assignment details with course info and verify authorization in one query
    const assignmentQuery = `
      SELECT 
        a.id,
        a.title,
        a.course_id,
        c.title as course_title,
        CASE 
          WHEN $3 = 'admin' THEN TRUE
          WHEN ct.user_id IS NOT NULL THEN TRUE
          ELSE FALSE
        END as has_access
      FROM assignment a
      JOIN course c ON a.course_id = c.id
      LEFT JOIN course_teacher ct ON ct.course_id = c.id AND ct.user_id = $2
      WHERE a.id = $1
    `;

    const assignmentResult = await pool.query(assignmentQuery, [assignmentIdNum, userId, userRole]);

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const assignmentData = assignmentResult.rows[0];

    // Check authorization
    if (!assignmentData.has_access) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const courseId = assignmentData.course_id;

    // Get comprehensive statistics
    const statsQuery = `
      WITH enrollment_stats AS (
        SELECT COUNT(DISTINCT e.user_id) as total_students
        FROM enrollment e
        WHERE e.course_id = $2
      ),
      submission_stats AS (
        SELECT
          COUNT(DISTINCT s.id) as total_submissions,
          COUNT(DISTINCT s.user_id) as students_submitted,
          COUNT(DISTINCT CASE WHEN s.status = 'pending' THEN s.user_id END) as students_pending,
          COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.user_id END) as students_completed,
          COUNT(DISTINCT CASE WHEN s.status = 'graded' THEN s.user_id END) as students_graded,
          ROUND(AVG(COALESCE(s.manual_score, s.ai_score))::numeric, 2) as avg_score,
          MIN(COALESCE(s.manual_score, s.ai_score)) as min_score,
          MAX(COALESCE(s.manual_score, s.ai_score)) as max_score
        FROM submission s
        WHERE s.assignment_id = $1
      )
      SELECT
        es.total_students,
        COALESCE(ss.total_submissions, 0) as total_submissions,
        COALESCE(ss.students_submitted, 0) as students_submitted,
        COALESCE(ss.students_pending, 0) as students_pending,
        COALESCE(ss.students_completed, 0) as students_completed,
        COALESCE(ss.students_graded, 0) as students_graded,
        ss.avg_score,
        ss.min_score,
        ss.max_score,
        ROUND(
          (COALESCE(ss.students_submitted, 0)::float / NULLIF(es.total_students, 0) * 100)::numeric, 2
        ) as submission_percentage
      FROM enrollment_stats es
      CROSS JOIN submission_stats ss
    `;

    const statsResult = await pool.query(statsQuery, [assignmentIdNum, courseId]);
    const stats = statsResult.rows[0];

    // Calculate students with no submission
    const totalStudents = parseInt(stats.total_students) || 0;
    const studentsSubmitted = parseInt(stats.students_submitted) || 0;
    const studentsNoSubmission = totalStudents - studentsSubmitted;

    // Format response with camelCase
    const responseData = {
      assignment: {
        id: assignmentData.id,
        title: assignmentData.title,
        courseId: assignmentData.course_id,
        courseTitle: assignmentData.course_title
      },
      statistics: {
        totalStudents,
        totalSubmissions: parseInt(stats.total_submissions) || 0,
        studentsSubmitted,
        studentsNoSubmission,
        submissionPercentage: stats.submission_percentage ? parseFloat(stats.submission_percentage) : 0,
        statusDistribution: {
          noSubmission: studentsNoSubmission,
          pending: parseInt(stats.students_pending) || 0,
          completed: parseInt(stats.students_completed) || 0,
          graded: parseInt(stats.students_graded) || 0
        },
        scores: {
          average: stats.avg_score ? parseFloat(stats.avg_score) : null,
          minimum: stats.min_score ? parseFloat(stats.min_score) : null,
          maximum: stats.max_score ? parseFloat(stats.max_score) : null
        }
      }
    };

    // Store in cache
    setCachedData(cacheKey, responseData);

    console.log(`✅ Assignment statistics fetched: ${assignmentIdNum} by user ${userId}`);
    res.json(responseData);

  } catch (error) {
    console.error('❌ Error fetching assignment statistics:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Get all submissions for a specific assignment with class-wide statistics
 * @route GET /api/docent/assignments/:assignmentId/submissions
 */
const getAssignmentSubmissions = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validate assignment ID
    const assignmentIdNum = parseInt(assignmentId, 10);
    if (isNaN(assignmentIdNum)) {
      return res.status(400).json({ error: 'Invalid assignment ID' });
    }

    // Generate cache key
    const cacheKey = `assignment:${assignmentIdNum}:submissions`;
    
    // Try to get from cache
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }

    // Get assignment details with course info and verify authorization
    const assignmentQuery = `
      SELECT 
        a.id,
        a.title,
        a.course_id,
        a.due_date,
        c.title as course_title,
        CASE 
          WHEN $3 = 'admin' THEN TRUE
          WHEN ct.user_id IS NOT NULL THEN TRUE
          ELSE FALSE
        END as has_access
      FROM assignment a
      JOIN course c ON a.course_id = c.id
      LEFT JOIN course_teacher ct ON ct.course_id = c.id AND ct.user_id = $2
      WHERE a.id = $1
    `;

    const assignmentResult = await pool.query(assignmentQuery, [assignmentIdNum, userId, userRole]);

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const assignmentData = assignmentResult.rows[0];

    // Check authorization
    if (!assignmentData.has_access) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const courseId = assignmentData.course_id;

    // Get all students with their submissions for this assignment
    const submissionsQuery = `
      WITH student_submissions AS (
        SELECT
          u.id as student_id,
          u.name,
          u.email,
          u.github_id,
          s.id as submission_id,
          s.status,
          s.created_at as submission_date,
          s.ai_score,
          s.manual_score,
          s.github_url,
          s.commit_sha,
          COALESCE(s.manual_score, s.ai_score) as final_score,
          COUNT(*) OVER (PARTITION BY u.id) as total_attempts,
          ROW_NUMBER() OVER (PARTITION BY u.id ORDER BY s.created_at DESC) as attempt_rank
        FROM enrollment e
        JOIN "user" u ON e.user_id = u.id
        LEFT JOIN submission s ON s.assignment_id = $1 AND s.user_id = u.id
        WHERE e.course_id = $2
      )
      SELECT
        student_id,
        name,
        email,
        github_id,
        submission_id,
        status,
        submission_date,
        ai_score,
        manual_score,
        final_score,
        github_url,
        commit_sha,
        total_attempts,
        attempt_rank
      FROM student_submissions
      ORDER BY name ASC, submission_date DESC
    `;

    const submissionsResult = await pool.query(submissionsQuery, [assignmentIdNum, courseId]);

    // Calculate class-wide statistics
    const statsQuery = `
      WITH submission_stats AS (
        SELECT
          COUNT(DISTINCT e.user_id) as total_students,
          COUNT(DISTINCT s.user_id) as students_submitted,
          COUNT(DISTINCT s.id) as total_submissions,
          ROUND(AVG(s.ai_score)::numeric, 2) as avg_ai_score,
          MIN(s.ai_score) as min_ai_score,
          MAX(s.ai_score) as max_ai_score,
          ROUND(AVG(COALESCE(s.manual_score, s.ai_score))::numeric, 2) as avg_final_score,
          MIN(COALESCE(s.manual_score, s.ai_score)) as min_final_score,
          MAX(COALESCE(s.manual_score, s.ai_score)) as max_final_score
        FROM enrollment e
        LEFT JOIN submission s ON s.assignment_id = $1 AND s.user_id = e.user_id
        WHERE e.course_id = $2
      )
      SELECT * FROM submission_stats
    `;

    const statsResult = await pool.query(statsQuery, [assignmentIdNum, courseId]);
    const stats = statsResult.rows[0];

    // Group submissions by student
    const studentsMap = new Map();
    submissionsResult.rows.forEach(row => {
      if (!studentsMap.has(row.student_id)) {
        studentsMap.set(row.student_id, {
          studentId: row.student_id,
          studentName: row.name,
          email: row.email,
          githubId: row.github_id,
          totalAttempts: row.submission_id ? parseInt(row.total_attempts) : 0,
          latestSubmission: null,
          attempts: []
        });
      }

      const student = studentsMap.get(row.student_id);
      
      if (row.submission_id) {
        const attempt = {
          submissionId: row.submission_id,
          status: row.status,
          submissionDate: row.submission_date,
          aiScore: row.ai_score,
          manualScore: row.manual_score,
          finalScore: row.final_score,
          githubUrl: row.github_url,
          commitSha: row.commit_sha
        };

        student.attempts.push(attempt);

        // Set latest submission (first one due to ORDER BY)
        if (row.attempt_rank === 1) {
          student.latestSubmission = attempt;
        }
      }
    });

    // Calculate per-student statistics
    const students = Array.from(studentsMap.values()).map(student => {
      const scores = student.attempts
        .map(a => a.finalScore)
        .filter(s => s !== null);

      const aiScores = student.attempts
        .map(a => a.aiScore)
        .filter(s => s !== null);

      return {
        ...student,
        averageScore: scores.length > 0 
          ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2))
          : null,
        highestScore: scores.length > 0 ? Math.max(...scores) : null,
        lowestScore: scores.length > 0 ? Math.min(...scores) : null,
        averageAiScore: aiScores.length > 0
          ? parseFloat((aiScores.reduce((a, b) => a + b, 0) / aiScores.length).toFixed(2))
          : null,
        scoreImprovement: scores.length >= 2
          ? parseFloat((scores[0] - scores[scores.length - 1]).toFixed(2))
          : null
      };
    });

    // Format response
    const responseData = {
      assignment: {
        id: assignmentData.id,
        title: assignmentData.title,
        courseId: assignmentData.course_id,
        courseTitle: assignmentData.course_title,
        dueDate: assignmentData.due_date
      },
      classStatistics: {
        totalStudents: parseInt(stats.total_students) || 0,
        studentsSubmitted: parseInt(stats.students_submitted) || 0,
        totalSubmissions: parseInt(stats.total_submissions) || 0,
        submissionRate: parseFloat(
          (parseInt(stats.students_submitted) / parseInt(stats.total_students) * 100).toFixed(2)
        ) || 0,
        aiScores: {
          average: stats.avg_ai_score ? parseFloat(stats.avg_ai_score) : null,
          minimum: stats.min_ai_score || null,
          maximum: stats.max_ai_score || null
        },
        finalScores: {
          average: stats.avg_final_score ? parseFloat(stats.avg_final_score) : null,
          minimum: stats.min_final_score || null,
          maximum: stats.max_final_score || null
        }
      },
      students
    };

    // Store in cache
    setCachedData(cacheKey, responseData);

    console.log(`✅ Assignment submissions fetched: ${assignmentIdNum} by user ${userId}`);
    res.json(responseData);

  } catch (error) {
    console.error('❌ Error fetching assignment submissions:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

/**
 * Get student submission history with score improvement over time
 * Shows progression across multiple attempts
 */
const getStudentSubmissionHistory = async (req, res) => {
  try {
    const { assignmentId, studentId } = req.params;
    const userId = req.user?.id;

    if (!assignmentId || !studentId) {
      return res.status(400).json({ error: 'assignmentId and studentId are required' });
    }

    const assignmentIdNum = parseInt(assignmentId, 10);
    const studentIdNum = parseInt(studentId, 10);

    if (isNaN(assignmentIdNum) || isNaN(studentIdNum)) {
      return res.status(400).json({ error: 'Invalid assignmentId or studentId' });
    }

    // Check cache first
    const cacheKey = `assignment:${assignmentIdNum}:student:${studentIdNum}:history`;
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }

    // Verify assignment exists and get course info
    const assignmentQuery = `
      SELECT a.id, a.title, a.description, a.due_date, a.course_id, c.title as course_title
      FROM assignment a
      JOIN course c ON a.course_id = c.id
      WHERE a.id = $1
    `;
    const assignmentResult = await pool.query(assignmentQuery, [assignmentIdNum]);

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const assignment = assignmentResult.rows[0];
    const courseId = assignment.course_id;

    // Authorization: Verify user is a docent for this course
    const authQuery = `
      SELECT 1 FROM course_teacher
      WHERE course_id = $1 AND user_id = $2
    `;
    const authResult = await pool.query(authQuery, [courseId, userId]);

    if (authResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You are not authorized to view submissions for this course'
      });
    }

    // Get student info and verify enrollment
    const studentQuery = `
      SELECT u.id, u.name, u.email, u.github_id, e.created_at as enrolled_at
      FROM "user" u
      JOIN enrollment e ON u.id = e.user_id
      WHERE u.id = $1 AND e.course_id = $2
    `;
    const studentResult = await pool.query(studentQuery, [studentIdNum, courseId]);

    if (studentResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Student not found or not enrolled in this course'
      });
    }

    const student = studentResult.rows[0];

    // Get all submissions for this student-assignment combination, ordered chronologically
    const submissionsQuery = `
      SELECT 
        id,
        github_url,
        commit_sha,
        status,
        ai_score,
        manual_score,
        COALESCE(manual_score, ai_score) as final_score,
        created_at,
        updated_at
      FROM submission
      WHERE assignment_id = $1 AND user_id = $2
      ORDER BY created_at ASC
    `;
    const submissionsResult = await pool.query(submissionsQuery, [assignmentIdNum, studentIdNum]);

    const attempts = submissionsResult.rows.map((row, index) => ({
      attemptNumber: index + 1,
      submissionId: row.id,
      status: row.status,
      aiScore: row.ai_score,
      manualScore: row.manual_score,
      finalScore: row.final_score,
      githubUrl: row.github_url,
      commitSha: row.commit_sha,
      submittedAt: row.created_at,
      updatedAt: row.updated_at
    }));

    // Calculate improvement statistics
    const statistics = {
      totalAttempts: attempts.length,
      hasSubmissions: attempts.length > 0
    };

    if (attempts.length > 0) {
      const scores = attempts
        .map(a => a.finalScore)
        .filter(s => s !== null && s !== undefined);

      if (scores.length > 0) {
        const firstScore = scores[0];
        const latestScore = scores[scores.length - 1];
        const bestScore = Math.max(...scores);
        const worstScore = Math.min(...scores);
        const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

        statistics.firstScore = firstScore;
        statistics.latestScore = latestScore;
        statistics.bestScore = bestScore;
        statistics.worstScore = worstScore;
        statistics.averageScore = Math.round(avgScore * 100) / 100;
        
        // Calculate improvement percentage
        if (firstScore !== null && firstScore > 0) {
          statistics.improvement = Math.round(((latestScore - firstScore) / firstScore) * 10000) / 100;
          statistics.absoluteImprovement = latestScore - firstScore;
        } else {
          statistics.improvement = null;
          statistics.absoluteImprovement = latestScore - firstScore;
        }

        // Determine trend
        if (scores.length === 1) {
          statistics.trend = 'single_attempt';
        } else if (latestScore > firstScore) {
          statistics.trend = 'improving';
        } else if (latestScore < firstScore) {
          statistics.trend = 'declining';
        } else {
          statistics.trend = 'stable';
        }
      } else {
        statistics.firstScore = null;
        statistics.latestScore = null;
        statistics.bestScore = null;
        statistics.worstScore = null;
        statistics.averageScore = null;
        statistics.improvement = null;
        statistics.absoluteImprovement = null;
        statistics.trend = 'no_scores';
      }
    } else {
      statistics.firstScore = null;
      statistics.latestScore = null;
      statistics.bestScore = null;
      statistics.worstScore = null;
      statistics.averageScore = null;
      statistics.improvement = null;
      statistics.absoluteImprovement = null;
      statistics.trend = 'no_attempts';
    }

    const responseData = {
      assignment: {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        dueDate: assignment.due_date,
        courseId: assignment.course_id,
        courseTitle: assignment.course_title
      },
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        githubId: student.github_id,
        enrolledAt: student.enrolled_at
      },
      statistics,
      attempts
    };

    // Store in cache
    setCachedData(cacheKey, responseData);

    console.log(`✅ Student submission history fetched for student ${studentIdNum}, assignment ${assignmentIdNum}`);
    res.json(responseData);

  } catch (error) {
    console.error('❌ Error fetching student submission history:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

const getAssignmentAIFeedbackAnalytics = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validate assignment ID
    const assignmentIdNum = parseInt(assignmentId, 10);
    if (isNaN(assignmentIdNum)) {
      return res.status(400).json({ error: 'Invalid assignment ID' });
    }

    // Generate cache key
    const cacheKey = `assignment:${assignmentIdNum}:aifeedback:analytics`;
    
    // Try to get from cache
    const cachedResult = getCachedData(cacheKey);
    if (cachedResult) {
      return res.json(cachedResult);
    }

    // Get assignment details and verify authorization
    const assignmentQuery = `
      SELECT 
        a.id,
        a.title,
        a.course_id,
        c.title as course_title,
        CASE 
          WHEN $3 = 'admin' THEN TRUE
          WHEN ct.user_id IS NOT NULL THEN TRUE
          ELSE FALSE
        END as has_access
      FROM assignment a
      JOIN course c ON a.course_id = c.id
      LEFT JOIN course_teacher ct ON ct.course_id = c.id AND ct.user_id = $2
      WHERE a.id = $1
    `;

    const assignmentResult = await pool.query(assignmentQuery, [assignmentIdNum, userId, userRole]);

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const assignmentData = assignmentResult.rows[0];

    // Check authorization
    if (!assignmentData.has_access) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Get severity distribution
    const severityQuery = `
      SELECT 
        f.severity,
        COUNT(*) as count
      FROM feedback f
      JOIN submission s ON f.submission_id = s.id
      WHERE s.assignment_id = $1 AND f.reviewer = 'ai'
      GROUP BY f.severity
      ORDER BY 
        CASE f.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END
    `;

    const severityResult = await pool.query(severityQuery, [assignmentIdNum]);

    const severityDistribution = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    severityResult.rows.forEach(row => {
      severityDistribution[row.severity] = parseInt(row.count, 10);
    });

    // Get most common feedback types/categories
    const feedbackTypesQuery = `
      SELECT 
        COALESCE(f.type, 'uncategorized') as type,
        COUNT(*) as count,
        ROUND(AVG(
          CASE f.severity
            WHEN 'low' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'high' THEN 3
            WHEN 'critical' THEN 4
          END
        )::numeric, 2) as avg_severity_score
      FROM feedback f
      JOIN submission s ON f.submission_id = s.id
      WHERE s.assignment_id = $1 AND f.reviewer = 'ai'
      GROUP BY f.type
      ORDER BY count DESC
      LIMIT 10
    `;

    const feedbackTypesResult = await pool.query(feedbackTypesQuery, [assignmentIdNum]);

    const feedbackTypes = feedbackTypesResult.rows.map(row => ({
      type: row.type,
      count: parseInt(row.count, 10),
      avgSeverityScore: parseFloat(row.avg_severity_score)
    }));

    // Calculate average feedback severity score
    const avgSeverityQuery = `
      SELECT 
        ROUND(AVG(
          CASE f.severity
            WHEN 'low' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'high' THEN 3
            WHEN 'critical' THEN 4
          END
        )::numeric, 2) as avg_severity_score,
        COUNT(*) as total_feedback_items
      FROM feedback f
      JOIN submission s ON f.submission_id = s.id
      WHERE s.assignment_id = $1 AND f.reviewer = 'ai'
    `;

    const avgSeverityResult = await pool.query(avgSeverityQuery, [assignmentIdNum]);
    const avgSeverityScore = avgSeverityResult.rows[0].avg_severity_score 
      ? parseFloat(avgSeverityResult.rows[0].avg_severity_score) 
      : null;
    const totalFeedbackItems = parseInt(avgSeverityResult.rows[0].total_feedback_items, 10);

    // Get students with most critical feedback
    const criticalFeedbackQuery = `
      SELECT 
        u.id as student_id,
        u.name,
        u.email,
        u.github_id,
        COUNT(*) as critical_count,
        COUNT(DISTINCT s.id) as submission_count
      FROM feedback f
      JOIN submission s ON f.submission_id = s.id
      JOIN "user" u ON s.user_id = u.id
      WHERE s.assignment_id = $1 
        AND f.reviewer = 'ai'
        AND f.severity = 'critical'
      GROUP BY u.id, u.name, u.email, u.github_id
      ORDER BY critical_count DESC
      LIMIT 10
    `;

    const criticalFeedbackResult = await pool.query(criticalFeedbackQuery, [assignmentIdNum]);

    const studentsWithCriticalFeedback = criticalFeedbackResult.rows.map(row => ({
      studentId: row.student_id,
      name: row.name,
      email: row.email,
      githubId: row.github_id,
      criticalCount: parseInt(row.critical_count, 10),
      submissionCount: parseInt(row.submission_count, 10)
    }));

    const responseData = {
      assignment: {
        id: assignmentData.id,
        title: assignmentData.title,
        courseId: assignmentData.course_id,
        courseTitle: assignmentData.course_title
      },
      analytics: {
        totalFeedbackItems,
        severityDistribution,
        avgSeverityScore,
        feedbackTypes,
        studentsWithCriticalFeedback
      }
    };

    // Store in cache
    setCachedData(cacheKey, responseData);

    console.log(`✅ AI feedback analytics fetched for assignment ${assignmentIdNum}`);
    res.json(responseData);

  } catch (error) {
    console.error('❌ Error fetching AI feedback analytics:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

module.exports = {
  getEnrolledStudents,
  getStudentStatusByCourse,
  getStudentStatusForStudent,
  addStudentToCourse,
  removeStudentFromCourse,
  getDocentCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  streamCourseStatistics,
  getDocentAssignments,
  getDocentCourseAssignments,
  createAssignment,
  getAssignmentDetail,
  updateAssignment,
  deleteAssignment,
  getAssignmentStatistics,
  getAssignmentSubmissions,
  getStudentSubmissionHistory,
  getAssignmentAIFeedbackAnalytics
};

