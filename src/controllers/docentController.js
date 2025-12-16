const pool = require('../config/db');

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

    res.json({
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
    });

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

    res.json({
      students,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: totalCount,
        itemsPerPage: parseInt(limit)
      }
    });
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

    // Debug logging
    console.log('📝 Add Student Request Headers:', req.headers['content-type']);
    // Niet loggen van request body - bevat mogelijk gevoelige data zoals wachtwoorden

    if (!req.body) {
      return res.status(400).json({
        error: 'Request body is missing',
        hint: 'Ensure you are sending a JSON body and setting Content-Type: application/json'
      });
    }

    const { email } = req.body;

    if (!courseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    // 1. Find the user by email
    const userResult = await pool.query(
      'SELECT id FROM "user" WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found with this email' });
    }

    const studentId = userResult.rows[0].id;

    // 2. Check if already enrolled
    const enrollmentCheck = await pool.query(
      'SELECT id FROM enrollment WHERE course_id = $1 AND user_id = $2',
      [courseId, studentId]
    );

    if (enrollmentCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Student is already enrolled in this course' });
    }

    // 3. Enroll the student
    await pool.query(
      'INSERT INTO enrollment (course_id, user_id) VALUES ($1, $2)',
      [courseId, studentId]
    );

    res.status(201).json({ message: 'Student successfully added to the course' });

  } catch (error) {
    console.error('❌ Error adding student to course:', error.message);
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

    // Check if the enrollment exists
    const checkResult = await pool.query(
      'SELECT id FROM enrollment WHERE course_id = $1 AND user_id = $2',
      [courseId, studentId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student is not enrolled in this course' });
    }

    // Remove the student
    await pool.query(
      'DELETE FROM enrollment WHERE course_id = $1 AND user_id = $2',
      [courseId, studentId]
    );

    res.json({ message: 'Student successfully removed from the course' });

  } catch (error) {
    console.error('❌ Error removing student from course:', error.message);
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
  removeStudentFromCourse
};

