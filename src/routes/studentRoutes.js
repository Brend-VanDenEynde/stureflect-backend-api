const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const studentController = require('../controllers/studentController');

// Alle routes vereisen authenticatie
router.use(authenticateToken);

/**
 * GET /api/students/me/courses
 * Haalt alle cursussen op waar de ingelogde student is ingeschreven
 */
router.get('/me/courses', async (req, res) => {
  try {
    const studentId = req.user.id;
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
 * GET /api/students/me/courses/:courseId/assignments
 * Haalt alle opdrachten op voor een specifieke cursus
 * Query params:
 *   - status: 'submitted' | 'pending' | 'all' (default: 'all')
 *   - sortBy: 'due_date' | 'title' | 'created_at' (default: 'due_date')
 *   - order: 'asc' | 'desc' (default: 'asc')
 */
router.get('/me/courses/:courseId/assignments', async (req, res) => {
  try {
    const studentId = req.user.id;
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
