const pool = require('../config/db');
const notificationService = require('../services/notificationService');

// In-memory cache for expensive statistics queries
// Structure: { cacheKey: { data: any, timestamp: number } }
const statsCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

/**
 * Get data from cache if still valid
 * @param {string} key - Cache key
 * @returns {any|null} Cached data or null if expired/missing
 */
function getCachedData(key) {
  const cached = statsCache.get(key);
  if (!cached) return null;
  
  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL) {
    statsCache.delete(key);
    return null;
  }
  
  console.log(`✅ Cache HIT for ${key} (age: ${Math.round(age/1000)}s)`);
  return cached.data;
}

/**
 * Store data in cache
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 */
function setCachedData(key, data) {
  statsCache.set(key, {
    data,
    timestamp: Date.now()
  });
  console.log(`💾 Cache SET for ${key}`);
}

/**
 * Invalidate all cache entries for a specific course
 * @param {number} courseId - Course ID
 */
function invalidateCourseCache(courseId) {
  let deletedCount = 0;
  for (const key of statsCache.keys()) {
    if (key.startsWith(`course:${courseId}:`)) {
      statsCache.delete(key);
      deletedCount++;
    }
  }
  if (deletedCount > 0) {
    console.log(`🗑️  Invalidated ${deletedCount} cache entries for course ${courseId}`);
  }
}

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

    console.log('🔍 Executing query with params:', queryParams);
    const result = await pool.query(query, queryParams);
    console.log('✅ Query successful. Rows:', result.rows.length);

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
    console.error('❌ Error fetching enrolled students:', error.message);
    console.error('❌ Stack:', error.stack);
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
    console.error('❌ Error fetching student status by course:', error.message);
    console.error('❌ Stack:', error.stack);
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
    console.error('❌ Error fetching student status by course/student:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

const addStudentToCourse = async (req, res) => {
  try {
    const { courseId } = req.params;

    console.log('═══════════════════════════════════════════════════════');
    console.log('📝 [ADD STUDENT] Starting addStudentToCourse request');
    console.log('═══════════════════════════════════════════════════════');
    console.log('🔑 Request user:', req.user ? `ID: ${req.user.id}, Email: ${req.user.email}, Role: ${req.user.role}` : 'No user');
    console.log('📦 Course ID (from params):', courseId);
    console.log('📋 Content-Type:', req.headers['content-type']);
    console.log('📥 Request body received:', req.body ? 'YES' : 'NO');

    if (!req.body) {
      console.log('❌ [ADD STUDENT] Request body is missing');
      return res.status(400).json({
        error: 'Request body is missing',
        hint: 'Ensure you are sending a JSON body and setting Content-Type: application/json'
      });
    }

    const { email } = req.body;
    console.log('📧 Student email (from body):', email ? email : 'NOT PROVIDED');

    if (!courseId) {
      console.log('❌ [ADD STUDENT] courseId is missing');
      return res.status(400).json({ error: 'courseId is required' });
    }
    if (!email) {
      console.log('❌ [ADD STUDENT] email is missing');
      return res.status(400).json({ error: 'email is required' });
    }

    // 1. Find the user by email
    console.log('🔍 [STEP 1] Looking up user by email:', email);
    const userResult = await pool.query(
      'SELECT id FROM "user" WHERE email = $1',
      [email]
    );

    console.log('📊 [STEP 1] Query result:', {
      rowCount: userResult.rows.length,
      found: userResult.rows.length > 0
    });

    if (userResult.rows.length === 0) {
      console.log('❌ [STEP 1] Student not found with email:', email);
      return res.status(404).json({ error: 'Student not found with this email' });
    }

    const studentId = userResult.rows[0].id;
    console.log('✅ [STEP 1] Student found - ID:', studentId);

    // 2. Check if already enrolled
    console.log('🔍 [STEP 2] Checking if student is already enrolled');
    console.log('   - Course ID:', courseId);
    console.log('   - Student ID:', studentId);
    
    const enrollmentCheck = await pool.query(
      'SELECT id FROM enrollment WHERE course_id = $1 AND user_id = $2',
      [courseId, studentId]
    );

    console.log('📊 [STEP 2] Enrollment check result:', {
      rowCount: enrollmentCheck.rows.length,
      alreadyEnrolled: enrollmentCheck.rows.length > 0
    });

    if (enrollmentCheck.rows.length > 0) {
      console.log('⚠️ [STEP 2] Student already enrolled in this course');
      return res.status(409).json({ error: 'Student is already enrolled in this course' });
    }

    // 3. Enroll the student
    console.log('➕ [STEP 3] Enrolling student in course');
    console.log('   - Course ID:', courseId);
    console.log('   - Student ID:', studentId);
    
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
    console.log('📡 [SSE] Enrollment event emitted for course', courseId);
    
    // 5. Invalidate cache for this course
    invalidateCourseCache(courseId);
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎉 [ADD STUDENT] Successfully completed');
    console.log('═══════════════════════════════════════════════════════');

    res.status(201).json({ message: 'Student successfully added to the course' });

  } catch (error) {
    console.log('═══════════════════════════════════════════════════════');
    console.error('❌ [ADD STUDENT ERROR] An error occurred');
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    console.log('═══════════════════════════════════════════════════════');
    
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
    console.log('📡 [SSE] Student removal event emitted for course', courseId);

    // Invalidate cache for this course
    invalidateCourseCache(courseId);

    res.json({ message: 'Student successfully removed from the course' });

  } catch (error) {
    console.error('❌ Error removing student from course:', error.message);
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
    console.error('❌ Error fetching docent courses:', error.message);
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

module.exports = {
  getEnrolledStudents,
  getStudentStatusByCourse,
  getStudentStatusForStudent,
  addStudentToCourse,
  removeStudentFromCourse,
  getDocentCourses,
  streamCourseStatistics
};

