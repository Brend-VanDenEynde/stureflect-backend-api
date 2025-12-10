const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const studentController = require('../controllers/studentController');

// Alle routes vereisen authenticatie
router.use(authenticateToken);

/**
 * GET /api/students/me/courses
 * Haal alle cursussen op waar de ingelogde student is ingeschreven
 */
router.get('/me/courses', async (req, res) => {
  try {
    const studentId = req.user.id;
    const courses = await studentController.getStudentCourses(studentId);

    res.json({
      success: true,
      data: courses
    });
  } catch (error) {
    console.error('Fout bij ophalen cursussen:', error);
    res.status(500).json({
      success: false,
      error: 'Kon cursussen niet ophalen'
    });
  }
});

/**
 * GET /api/students/me/courses/:courseId/assignments
 * Haal alle opdrachten op voor een specifieke cursus
 * Query params:
 *   - status: 'submitted' | 'pending' | 'all' (default: 'all')
 *   - sortBy: 'deadline' | 'title' | 'created_at' (default: 'deadline')
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
        error: 'Ongeldig cursus ID'
      });
    }

    // Controleer of student is ingeschreven
    const isEnrolled = await studentController.isStudentEnrolledInCourse(studentId, courseId);
    if (!isEnrolled) {
      return res.status(403).json({
        success: false,
        error: 'Je bent niet ingeschreven voor deze cursus'
      });
    }

    const assignments = await studentController.getCourseAssignments(studentId, courseId, {
      status,
      sortBy,
      order
    });

    res.json({
      success: true,
      data: assignments
    });
  } catch (error) {
    console.error('Fout bij ophalen opdrachten:', error);
    res.status(500).json({
      success: false,
      error: 'Kon opdrachten niet ophalen'
    });
  }
});

module.exports = router;
