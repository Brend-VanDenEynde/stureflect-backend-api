const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const studentController = require('../controllers/studentController');

// TODO: Authenticatie tijdelijk uitgeschakeld voor testing
// router.use(authenticateToken);

/**
 * GET /api/students/me/courses
 * Haalt alle cursussen op waar de ingelogde student is ingeschreven
 */
router.get('/me/courses', async (req, res) => {
  try {
    // TODO: Tijdelijk - gebruik query param of default voor testing
    const studentId = req.user?.id || parseInt(req.query.studentId) || 1;
    const courses = await studentController.getStudentCourses(studentId);

    res.status(200).json({
      success: true,
      data: courses,
      message: `${courses.length} cursussen gevonden`,
      error: null
    });
  } catch (error) {
    console.error('Fout bij ophalen cursussen:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen cursussen',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * GET /api/students/me/submissions
 * Haalt alle submissions op van de ingelogde student
 * Query params:
 *   - courseId: Filter op cursus ID (optioneel)
 *   - status: 'pending' | 'completed' | 'graded' (optioneel)
 */
router.get('/me/submissions', async (req, res) => {
  try {
    const studentId = req.user?.id || parseInt(req.query.studentId) || 1;
    const { courseId, status } = req.query;

    const filters = {};
    if (courseId) filters.courseId = parseInt(courseId);
    if (status) filters.status = status;

    const submissions = await studentController.getStudentSubmissions(studentId, filters);

    res.status(200).json({
      success: true,
      data: submissions,
      message: `${submissions.length} submissions gevonden`,
      error: null
    });
  } catch (error) {
    console.error('Fout bij ophalen submissions:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen submissions',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * GET /api/students/me/submissions/:submissionId
 * Haalt detail van een specifieke submission op
 */
router.get('/me/submissions/:submissionId', async (req, res) => {
  try {
    const submissionId = parseInt(req.params.submissionId);

    if (isNaN(submissionId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig submission ID',
        error: 'BAD_REQUEST'
      });
    }

    const detail = await studentController.getSubmissionDetail(submissionId);

    if (!detail) {
      return res.status(404).json({
        success: false,
        message: 'Submission niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    res.status(200).json({
      success: true,
      data: detail,
      message: 'Submission detail opgehaald',
      error: null
    });
  } catch (error) {
    console.error('Fout bij ophalen submission detail:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen submission detail',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * GET /api/students/me/courses/:courseId/assignments
 * Haalt alle opdrachten op voor een specifieke cursus
 * Query params:
 *   - status: 'submitted' | 'pending' | 'all' (default: 'all')
 *   - sortBy: 'due_date' | 'title' | 'created_at' (default: 'due_date')
 *   - order: 'asc' | 'desc' (default: 'asc')
 */
router.get('/me/courses/:courseId/assignments', async (req, res) => {
  try {
    // TODO: Tijdelijk - gebruik query param of default voor testing
    const studentId = req.user?.id || parseInt(req.query.studentId) || 1;
    const courseId = parseInt(req.params.courseId);
    const { status, sortBy, order } = req.query;

    if (isNaN(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig cursus ID',
        error: 'BAD_REQUEST'
      });
    }

    // Controleer of student is ingeschreven
    const isEnrolled = await studentController.isStudentEnrolledInCourse(studentId, courseId);
    if (!isEnrolled) {
      return res.status(403).json({
        success: false,
        message: 'Je bent niet ingeschreven voor deze cursus',
        error: 'FORBIDDEN'
      });
    }

    const assignments = await studentController.getCourseAssignments(studentId, courseId, {
      status,
      sortBy,
      order
    });

    res.status(200).json({
      success: true,
      data: assignments,
      message: `${assignments.length} opdrachten gevonden`,
      error: null
    });
  } catch (error) {
    console.error('Fout bij ophalen opdrachten:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen opdrachten',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

module.exports = router;
