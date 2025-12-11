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

module.exports = { getEnrolledStudents };
