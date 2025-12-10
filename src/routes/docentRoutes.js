const express = require('express');
const router = express.Router();
const docentController = require('../controllers/docentController');

/**
 * GET /api/teachers/:teacherId/classes/:classId/students
 * Haalt alle ingeschreven studenten op voor een specifieke cursus
 */
router.get('/teachers/:teacherId/classes/:classId/students', async (req, res) => {
  try {
    const { teacherId, classId } = req.params;
    const { sortBy = 'name', order = 'ASC' } = req.query;

    const students = await docentController.getStudentsByClass(classId, sortBy, order);

    res.status(200).json({
      success: true,
      data: students,
      message: `${students.length} studenten gevonden`,
      error: null
    });
  } catch (error) {
    console.error('Fout bij ophalen studenten:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen studenten',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * GET /api/teachers/:teacherId/students/:studentId
 * Haalt profiel en basisinformatie van een student op
 */
router.get('/teachers/:teacherId/students/:studentId', async (req, res) => {
  try {
    const { teacherId, studentId } = req.params;

    const student = await docentController.getStudentProfile(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    res.status(200).json({
      success: true,
      data: student,
      message: 'Studentprofiel opgehaald',
      error: null
    });
  } catch (error) {
    console.error('Fout bij ophalen studentprofiel:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen studentprofiel',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * GET /api/teachers/:teacherId/students/:studentId/progress
 * Haalt voortgangsoverzicht van een student op (inzendingen, scores, feedback)
 */
router.get('/teachers/:teacherId/students/:studentId/progress', async (req, res) => {
  try {
    const { teacherId, studentId } = req.params;

    const progress = await docentController.getStudentProgress(studentId);

    res.status(200).json({
      success: true,
      data: progress,
      message: 'Voortgang opgehaald',
      error: null
    });
  } catch (error) {
    console.error('Fout bij ophalen voortgang:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen voortgang',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * GET /api/teachers/:teacherId/students/:studentId/submissions
 * Haalt alle inzendingen van een student op
 */
router.get('/teachers/:teacherId/students/:studentId/submissions', async (req, res) => {
  try {
    const { teacherId, studentId } = req.params;
    const { assignmentId, status = null } = req.query;

    const submissions = await docentController.getStudentSubmissions(studentId, assignmentId, status);

    res.status(200).json({
      success: true,
      data: submissions,
      message: `${submissions.length} inzendingen gevonden`,
      error: null
    });
  } catch (error) {
    console.error('Fout bij ophalen inzendingen:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen inzendingen',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * GET /api/teachers/:teacherId/students/:studentId/feedback
 * Haalt alle feedback (AI en docent) voor een student op
 */
router.get('/teachers/:teacherId/students/:studentId/feedback', async (req, res) => {
  try {
    const { teacherId, studentId } = req.params;
    const { submissionId = null } = req.query;

    const feedback = await docentController.getStudentFeedback(studentId, submissionId);

    res.status(200).json({
      success: true,
      data: feedback,
      message: `${feedback.length} feedback items gevonden`,
      error: null
    });
  } catch (error) {
    console.error('Fout bij ophalen feedback:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen feedback',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * POST /api/teachers/:teacherId/classes/:classId/students
 * Schrijft een student in voor een cursus (of importeert meerdere via upload)
 */
router.post('/teachers/:teacherId/classes/:classId/students', async (req, res) => {
  try {
    const { teacherId, classId } = req.params;
    const { studentIds } = req.body; // Array van student IDs, of bulkdata

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'studentIds moet een niet-lege array zijn',
        error: 'INVALID_INPUT'
      });
    }

    const results = await docentController.enrollStudents(classId, studentIds);

    res.status(201).json({
      success: true,
      data: results,
      message: `${results.enrolled} student(en) ingeschreven`,
      error: null
    });
  } catch (error) {
    console.error('Fout bij inschrijving:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij inschrijving studenten',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * DELETE /api/teachers/:teacherId/classes/:classId/students/:studentId
 * Verwijdert een student uit een cursus
 */
router.delete('/teachers/:teacherId/classes/:classId/students/:studentId', async (req, res) => {
  try {
    const { teacherId, classId, studentId } = req.params;

    const deleted = await docentController.unenrollStudent(classId, studentId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Student-cursus combinatie niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    res.status(200).json({
      success: true,
      data: { studentId, classId },
      message: 'Student uit cursus verwijderd',
      error: null
    });
  } catch (error) {
    console.error('Fout bij verwijdering:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij verwijdering student',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * DELETE /api/teachers/:teacherId/classes/:classId/students
 * Verwijdert meerdere studenten uit een cursus (bulk operatie)
 */
router.delete('/teachers/:teacherId/classes/:classId/students', async (req, res) => {
  try {
    const { teacherId, classId } = req.params;
    const { studentIds } = req.body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'studentIds moet een niet-lege array zijn',
        error: 'INVALID_INPUT'
      });
    }

    const results = await docentController.unenrollMultipleStudents(classId, studentIds);

    res.status(200).json({
      success: true,
      data: results,
      message: `${results.deleted} student(en) verwijderd`,
      error: null
    });
  } catch (error) {
    console.error('Fout bij bulk verwijdering:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij verwijdering studenten',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * PUT /api/teachers/:teacherId/students/:studentId/manual-score
 * Stelt handmatige score in voor een inzending
 */
router.put('/teachers/:teacherId/students/:studentId/manual-score', async (req, res) => {
  try {
    const { teacherId, studentId } = req.params;
    const { submissionId, score } = req.body;

    if (typeof score !== 'number' || score < 0 || score > 100) {
      return res.status(400).json({
        success: false,
        message: 'Score moet een getal tussen 0 en 100 zijn',
        error: 'INVALID_INPUT'
      });
    }

    const updated = await docentController.setManualScore(submissionId, score);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Inzending niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    res.status(200).json({
      success: true,
      data: { submissionId, score },
      message: 'Handmatige score ingesteld',
      error: null
    });
  } catch (error) {
    console.error('Fout bij scoren:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij instellen score',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

module.exports = router;
