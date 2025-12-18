const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const studentController = require('../controllers/studentController');
const githubService = require('../services/githubService');
const { getFeedbackBySubmission } = require('../controllers/webhookController');
const { getUserById } = require('../models/user');
const sseManager = require('../services/sseManager');

// Authenticatie alleen in productie
if (process.env.NODE_ENV === 'production') {
  router.use(authenticateToken);
}

/**
 * @swagger
 * /api/students/me/courses:
 *   get:
 *     tags:
 *       - Studenten
 *     summary: Haal cursussen van ingelogde student op
 *     description: |
 *       Retourneert alle cursussen waar de ingelogde student voor is ingeschreven, inclusief het aantal opdrachten per cursus.
 *
 *       **Development mode:** Gebruik `studentId` query parameter.
 *       **Productie:** User ID wordt uit JWT token gehaald.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: integer
 *         description: Student ID (verplicht in development mode)
 *         example: 1
 *     responses:
 *       200:
 *         description: Cursussen succesvol opgehaald
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       title:
 *                         type: string
 *                         example: Web Development 101
 *                       description:
 *                         type: string
 *                       assignment_count:
 *                         type: string
 *                         example: "5"
 *                 message:
 *                   type: string
 *                   example: 3 cursussen gevonden
 *       401:
 *         description: Niet geauthenticeerd
 *       500:
 *         description: Server error
 */
router.get('/me/courses', async (req, res) => {
  try {
    const studentId = req.user?.id ||
      (process.env.NODE_ENV !== 'production' && req.query.studentId
        ? parseInt(req.query.studentId, 10)
        : null);

    if (!studentId || !Number.isInteger(studentId) || studentId <= 0) {
      const isProduction = process.env.NODE_ENV === 'production';
      return res.status(isProduction ? 401 : 400).json({
        success: false,
        message: isProduction ? 'Authenticatie vereist' : 'studentId query parameter is verplicht en moet een geldig positief getal zijn',
        error: isProduction ? 'UNAUTHORIZED' : 'BAD_REQUEST'
      });
    }

    const courses = await studentController.getStudentCourses(studentId);

    res.status(200).json({
      success: true,
      data: courses,
      message: `${courses.length} cursussen gevonden`,
      error: null
    });
  } catch (error) {
    console.error('[API] GET /api/students/me/courses failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen cursussen',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/students/me/courses/join:
 *   post:
 *     tags:
 *       - Studenten
 *     summary: Schrijf in voor een cursus met join code
 *     description: |
 *       Student kan zichzelf inschrijven voor een cursus door de join code in te voeren.
 *       De join code wordt verstrekt door de docent of admin.
 *
 *       **Development mode:** Gebruik `studentId` query parameter.
 *       **Productie:** User ID wordt uit JWT token gehaald.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: integer
 *         description: Student ID (verplicht in development mode)
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - join_code
 *             properties:
 *               join_code:
 *                 type: string
 *                 example: ABC123
 *                 description: De join code van de cursus
 *     responses:
 *       201:
 *         description: Succesvol ingeschreven voor de cursus
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     course:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                           example: 1
 *                         title:
 *                           type: string
 *                           example: Web Development 101
 *                         description:
 *                           type: string
 *                 message:
 *                   type: string
 *                   example: Succesvol ingeschreven voor Web Development 101
 *       400:
 *         description: Join code niet opgegeven
 *       404:
 *         description: Ongeldige join code
 *       409:
 *         description: Al ingeschreven voor deze cursus
 *       500:
 *         description: Server error
 */
router.post('/me/courses/join', async (req, res) => {
  try {
    const studentId = req.user?.id ||
      (process.env.NODE_ENV !== 'production' && req.query.studentId
        ? parseInt(req.query.studentId, 10)
        : null);

    if (!studentId || !Number.isInteger(studentId) || studentId <= 0) {
      const isProduction = process.env.NODE_ENV === 'production';
      return res.status(isProduction ? 401 : 400).json({
        success: false,
        message: isProduction ? 'Authenticatie vereist' : 'studentId query parameter is verplicht en moet een geldig positief getal zijn',
        error: isProduction ? 'UNAUTHORIZED' : 'BAD_REQUEST'
      });
    }

    const { join_code } = req.body;

    // Valideer input
    if (!join_code || typeof join_code !== 'string' || join_code.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Join code is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    const result = await studentController.joinCourseByCode(studentId, join_code.trim());

    if (!result.success) {
      if (result.error === 'INVALID_JOIN_CODE') {
        return res.status(404).json({
          success: false,
          message: 'Ongeldige join code',
          error: 'NOT_FOUND'
        });
      }
      if (result.error === 'ALREADY_ENROLLED') {
        return res.status(409).json({
          success: false,
          message: `Je bent al ingeschreven voor ${result.course.title}`,
          error: 'CONFLICT',
          data: { course: result.course }
        });
      }
    }

    res.status(201).json({
      success: true,
      data: { course: result.course },
      message: `Succesvol ingeschreven voor ${result.course.title}`,
      error: null
    });
  } catch (error) {
    console.error('Fout bij inschrijven met join code:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij inschrijven',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/students/me/submissions:
 *   get:
 *     tags:
 *       - Studenten
 *     summary: Haal alle submissions van student op
 *     description: |
 *       Haalt alle submissions op van de ingelogde student met optionele filters.
 *
 *       **Development mode:** Gebruik `studentId` query parameter.
 *       **Productie:** User ID wordt uit JWT token gehaald.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: integer
 *         description: Student ID (verplicht in development mode)
 *         example: 1
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: integer
 *         description: Filter op cursus ID (optioneel)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, graded]
 *         description: Filter op status (optioneel)
 *     responses:
 *       200:
 *         description: Submissions succesvol opgehaald
 *       401:
 *         description: Niet geauthenticeerd
 *       500:
 *         description: Server error
 */
router.get('/me/submissions', async (req, res) => {
  try {
    const studentId = req.user?.id ||
      (process.env.NODE_ENV !== 'production' && req.query.studentId
        ? parseInt(req.query.studentId, 10)
        : null);

    if (!studentId || !Number.isInteger(studentId) || studentId <= 0) {
      const isProduction = process.env.NODE_ENV === 'production';
      return res.status(isProduction ? 401 : 400).json({
        success: false,
        message: isProduction ? 'Authenticatie vereist' : 'studentId query parameter is verplicht en moet een geldig positief getal zijn',
        error: isProduction ? 'UNAUTHORIZED' : 'BAD_REQUEST'
      });
    }

    const { courseId, status, branch } = req.query;

    const filters = {};
    if (courseId) filters.courseId = parseInt(courseId);
    if (status) filters.status = status;
    if (branch) filters.branch = branch;

    const submissions = await studentController.getStudentSubmissions(studentId, filters);

    res.status(200).json({
      success: true,
      data: submissions,
      message: `${submissions.length} submissions gevonden`,
      error: null
    });
  } catch (error) {
    console.error('[API] GET /api/students/me/submissions failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen submissions',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/students/me/submissions/{submissionId}:
 *   get:
 *     tags:
 *       - Studenten
 *     summary: Haal submission detail op
 *     description: |
 *       Haalt detail van een specifieke submission op inclusief feedback. Alleen toegankelijk voor de eigenaar.
 *
 *       **Development mode:** Gebruik `studentId` query parameter.
 *       **Productie:** User ID wordt uit JWT token gehaald.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: integer
 *         description: Student ID (verplicht in development mode)
 *         example: 1
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de submission
 *     responses:
 *       200:
 *         description: Submission detail succesvol opgehaald
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Submission'
 *                 message:
 *                   type: string
 *       403:
 *         description: Geen toegang tot deze submission
 *       404:
 *         description: Submission niet gevonden
 *       500:
 *         description: Server error
 */
router.get('/me/submissions/:submissionId', async (req, res) => {
  try {
    const studentId = req.user?.id ||
      (process.env.NODE_ENV !== 'production' && req.query.studentId
        ? parseInt(req.query.studentId, 10)
        : null);

    if (!studentId || !Number.isInteger(studentId) || studentId <= 0) {
      const isProduction = process.env.NODE_ENV === 'production';
      return res.status(isProduction ? 401 : 400).json({
        success: false,
        message: isProduction ? 'Authenticatie vereist' : 'studentId query parameter is verplicht en moet een geldig positief getal zijn',
        error: isProduction ? 'UNAUTHORIZED' : 'BAD_REQUEST'
      });
    }

    const submissionId = parseInt(req.params.submissionId);

    if (isNaN(submissionId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig submission ID',
        error: 'BAD_REQUEST'
      });
    }

    const result = await studentController.getSubmissionDetail(submissionId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: 'Submission niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    // Autorisatie: check of submission van deze student is
    if (result.data.submission.user_id !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'Je hebt geen toegang tot deze submission',
        error: 'FORBIDDEN'
      });
    }

    res.status(200).json({
      success: true,
      data: result.data,
      message: 'Submission detail opgehaald',
      error: null
    });
  } catch (error) {
    console.error('[API] GET /api/students/me/submissions/:submissionId failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen submission detail',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/students/me/submissions/{submissionId}/feedback:
 *   get:
 *     tags:
 *       - Studenten
 *     summary: Haal feedback op voor een submission
 *     description: |
 *       Haalt alle feedback items op voor een specifieke submission.
 *       Kan gefilterd worden op reviewer type en severity level.
 *
 *       **Development mode:** Gebruik `studentId` query parameter.
 *       **Productie:** User ID wordt uit JWT token gehaald.
 *
 *       **Severity levels:**
 *       - critical: Kritieke fouten (-20 punten)
 *       - high: Ernstige problemen (-10 punten)
 *       - medium: Matige problemen (-5 punten)
 *       - low: Kleine verbeterpunten (-2 punten)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: integer
 *         description: Student ID (verplicht in development mode)
 *         example: 1
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de submission
 *       - in: query
 *         name: reviewer
 *         schema:
 *           type: string
 *           enum: [ai, teacher, all]
 *           default: all
 *         description: Filter op reviewer type
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [critical, high, medium, low]
 *         description: Filter op severity level
 *     responses:
 *       200:
 *         description: Feedback succesvol opgehaald
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     submission_id:
 *                       type: integer
 *                     total_count:
 *                       type: integer
 *                       example: 15
 *                     feedback:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Feedback'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         critical:
 *                           type: integer
 *                           example: 2
 *                         high:
 *                           type: integer
 *                           example: 5
 *                         medium:
 *                           type: integer
 *                           example: 6
 *                         low:
 *                           type: integer
 *                           example: 2
 *                 message:
 *                   type: string
 *       403:
 *         description: Geen toegang tot deze feedback
 *       404:
 *         description: Submission niet gevonden
 */
router.get('/me/submissions/:submissionId/feedback', async (req, res) => {
  try {
    const studentId = req.user?.id ||
      (process.env.NODE_ENV !== 'production' && req.query.studentId
        ? parseInt(req.query.studentId, 10)
        : null);

    if (!studentId || !Number.isInteger(studentId) || studentId <= 0) {
      const isProduction = process.env.NODE_ENV === 'production';
      return res.status(isProduction ? 401 : 400).json({
        success: false,
        message: isProduction ? 'Authenticatie vereist' : 'studentId query parameter is verplicht en moet een geldig positief getal zijn',
        error: isProduction ? 'UNAUTHORIZED' : 'BAD_REQUEST'
      });
    }

    const submissionId = parseInt(req.params.submissionId);
    const { reviewer = 'all', severity } = req.query;

    if (isNaN(submissionId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig submission ID',
        error: 'BAD_REQUEST'
      });
    }

    // Haal submission op om eigenaar te controleren
    const result = await studentController.getSubmissionDetail(submissionId);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: 'Submission niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    // Autorisatie: check of submission van deze student is
    if (result.data.submission.user_id !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'Je hebt geen toegang tot deze feedback',
        error: 'FORBIDDEN'
      });
    }

    // Haal feedback op met filters
    const feedback = await getFeedbackBySubmission(submissionId, { reviewer, severity });

    // Groepeer feedback per bestand voor betere leesbaarheid
    const feedbackByFile = {};
    const feedbackWithoutFile = [];

    for (const item of feedback) {
      if (item.type && item.line_number) {
        // Als we file_path hebben opgeslagen in type (tijdelijk), groepeer op type
        const key = item.type;
        if (!feedbackByFile[key]) {
          feedbackByFile[key] = [];
        }
        feedbackByFile[key].push(item);
      } else {
        feedbackWithoutFile.push(item);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        submission_id: submissionId,
        total_count: feedback.length,
        feedback: feedback,
        summary: {
          critical: feedback.filter(f => f.severity === 'critical').length,
          high: feedback.filter(f => f.severity === 'high').length,
          medium: feedback.filter(f => f.severity === 'medium').length,
          low: feedback.filter(f => f.severity === 'low').length
        }
      },
      message: `${feedback.length} feedback items gevonden`,
      error: null
    });
  } catch (error) {
    console.error('[API] GET /api/students/me/submissions/:submissionId/feedback failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen feedback',
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
 * @swagger
 * /api/students/me/courses/{courseId}/assignments:
 *   get:
 *     tags:
 *       - Studenten
 *     summary: Haal opdrachten van een cursus op
 *     description: |
 *       Haalt alle opdrachten op voor een specifieke cursus waar de student is ingeschreven.
 *
 *       **Development mode:** Gebruik `studentId` query parameter.
 *       **Productie:** User ID wordt uit JWT token gehaald.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: integer
 *         description: Student ID (verplicht in development mode)
 *         example: 1
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de cursus
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [submitted, pending, all]
 *           default: all
 *         description: Filter op submission status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [due_date, title, created_at]
 *           default: due_date
 *         description: Veld om op te sorteren
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sorteerrichting
 *     responses:
 *       200:
 *         description: Opdrachten succesvol opgehaald
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                         nullable: true
 *                       due_date:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       submission_id:
 *                         type: integer
 *                         nullable: true
 *                       submission_status:
 *                         type: string
 *                         enum: [submitted, pending]
 *                       status:
 *                         type: string
 *                         nullable: true
 *                         description: Submission status (pending, analyzed, etc.)
 *                       ai_score:
 *                         type: integer
 *                         nullable: true
 *                         description: AI score (0-100)
 *                       progress_percentage:
 *                         type: integer
 *                         description: Voortgangspercentage gebaseerd op ai_score
 *                         example: 75
 *                       status_text:
 *                         type: string
 *                         description: Leesbare status tekst
 *                         example: Goed op weg
 *                       feedback_count:
 *                         type: integer
 *                         description: Totaal aantal feedback items
 *                         example: 6
 *                       last_analysis_date:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         description: Datum van laatste AI analyse
 *       400:
 *         description: Ongeldig cursus ID
 *       403:
 *         description: Niet ingeschreven voor cursus
 *       500:
 *         description: Server error
 */
router.get('/me/courses/:courseId/assignments', async (req, res) => {
  try {
    const studentId = req.user?.id ||
      (process.env.NODE_ENV !== 'production' && req.query.studentId
        ? parseInt(req.query.studentId, 10)
        : null);

    if (!studentId || !Number.isInteger(studentId) || studentId <= 0) {
      const isProduction = process.env.NODE_ENV === 'production';
      return res.status(isProduction ? 401 : 400).json({
        success: false,
        message: isProduction ? 'Authenticatie vereist' : 'studentId query parameter is verplicht en moet een geldig positief getal zijn',
        error: isProduction ? 'UNAUTHORIZED' : 'BAD_REQUEST'
      });
    }

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
    console.error('[API] GET /api/students/me/courses/:courseId/assignments failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen opdrachten',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/students/me/assignments/{assignmentId}/submissions:
 *   post:
 *     tags:
 *       - Studenten
 *     summary: Koppel GitHub repository aan opdracht
 *     description: |
 *       Koppel een GitHub repository aan een opdracht. De repository wordt gevalideerd,
 *       opgeslagen en een webhook wordt geregistreerd voor automatische AI analyse bij pushes.
 *
 *       **Flow:**
 *       1. Valideer GitHub URL en repository toegang
 *       2. Haal laatste commit SHA en file tree op
 *       3. Maak submission aan in database
 *       4. Registreer GitHub webhook voor push events
 *
 *       **Belangrijk:**
 *       - Dit endpoint start GEEN AI analyse
 *       - De analyse wordt automatisch getriggerd bij elke `git push` naar de repository
 *       - Bij elke push worden ALLE code bestanden geanalyseerd (niet alleen de diff)
 *
 *       **Development mode:** Gebruik `studentId` query parameter.
 *       **Productie:** User ID wordt uit JWT token gehaald.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: integer
 *         description: Student ID (verplicht in development mode)
 *         example: 1
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de opdracht
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - github_url
 *             properties:
 *               github_url:
 *                 type: string
 *                 format: uri
 *                 example: https://github.com/username/repository
 *                 description: GitHub repository URL
 *     responses:
 *       201:
 *         description: Submission succesvol aangemaakt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 42
 *                       description: Submission ID
 *                     assignment_id:
 *                       type: integer
 *                       example: 1
 *                     user_id:
 *                       type: integer
 *                       example: 5
 *                     github_url:
 *                       type: string
 *                       example: https://github.com/student/project
 *                     commit_sha:
 *                       type: string
 *                       example: abc123def456
 *                       description: Laatste commit SHA bij aanmaken
 *                     status:
 *                       type: string
 *                       example: pending
 *                       description: Status is 'pending' tot eerste push analyse
 *                     repository:
 *                       type: object
 *                       properties:
 *                         owner:
 *                           type: string
 *                           example: student
 *                         repo:
 *                           type: string
 *                           example: project
 *                         default_branch:
 *                           type: string
 *                           example: main
 *                     files_count:
 *                       type: integer
 *                       example: 12
 *                       description: Aantal code bestanden in repository
 *                     files:
 *                       type: array
 *                       description: Lijst van code bestanden (max 100)
 *                       items:
 *                         type: object
 *                         properties:
 *                           path:
 *                             type: string
 *                             example: src/index.js
 *                           size:
 *                             type: integer
 *                             example: 1024
 *                           language:
 *                             type: string
 *                             example: javascript
 *                     webhook:
 *                       type: object
 *                       description: Webhook registratie status
 *                       properties:
 *                         registered:
 *                           type: boolean
 *                           example: true
 *                         webhookId:
 *                           type: integer
 *                           example: 12345678
 *                           description: GitHub webhook ID (alleen bij succes)
 *                         error:
 *                           type: string
 *                           description: Foutmelding (alleen bij falen)
 *                 message:
 *                   type: string
 *                   example: GitHub repository gekoppeld en webhook geregistreerd
 *                 error:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *       400:
 *         description: Ongeldige GitHub URL, assignment ID, of lege repository
 *       403:
 *         description: Niet ingeschreven voor cursus
 *       404:
 *         description: Opdracht niet gevonden
 *       409:
 *         description: Al een submission voor deze opdracht
 *       429:
 *         description: GitHub API rate limit bereikt
 */
router.post('/me/assignments/:assignmentId/submissions', async (req, res) => {
  try {
    const studentId = req.user?.id ||
      (process.env.NODE_ENV !== 'production' && req.query.studentId
        ? parseInt(req.query.studentId, 10)
        : null);

    if (!studentId || !Number.isInteger(studentId) || studentId <= 0) {
      const isProduction = process.env.NODE_ENV === 'production';
      return res.status(isProduction ? 401 : 400).json({
        success: false,
        message: isProduction ? 'Authenticatie vereist' : 'studentId query parameter is verplicht en moet een geldig positief getal zijn',
        error: isProduction ? 'UNAUTHORIZED' : 'BAD_REQUEST'
      });
    }

    const assignmentId = parseInt(req.params.assignmentId);
    const { github_url } = req.body;

    // Valideer assignmentId
    if (isNaN(assignmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig opdracht ID',
        error: 'BAD_REQUEST'
      });
    }

    // Valideer GitHub URL
    const urlValidation = githubService.validateGitHubUrl(github_url);
    if (!urlValidation.valid) {
      return res.status(400).json({
        success: false,
        message: urlValidation.error,
        error: 'INVALID_URL'
      });
    }

    // Haal assignment op en check of deze bestaat
    const assignmentResult = await studentController.getAssignmentWithCourse(assignmentId);
    if (!assignmentResult.success) {
      return res.status(404).json({
        success: false,
        message: 'Opdracht niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    const assignment = assignmentResult.data;

    // Check of student ingeschreven is voor de cursus
    const isEnrolled = await studentController.isStudentEnrolledInCourse(studentId, assignment.course_id);
    if (!isEnrolled) {
      return res.status(403).json({
        success: false,
        message: 'Je bent niet ingeschreven voor deze cursus',
        error: 'FORBIDDEN'
      });
    }

    // Check of student al een submission heeft
    const existingResult = await studentController.getExistingSubmission(studentId, assignmentId);
    if (existingResult.success) {
      return res.status(409).json({
        success: false,
        message: 'Je hebt al een inzending voor deze opdracht',
        error: 'CONFLICT',
        data: { existing_submission_id: existingResult.data.id }
      });
    }

    // Check of GitHub repository toegankelijk is
    const { owner, repo } = urlValidation;
    const repoAccess = await githubService.checkRepositoryAccess(owner, repo);
    if (!repoAccess.accessible) {
      const statusCode = repoAccess.errorCode === 'RATE_LIMITED' ? 429 : 404;
      return res.status(statusCode).json({
        success: false,
        message: repoAccess.error,
        error: repoAccess.errorCode
      });
    }

    // Haal laatste commit SHA op
    const commitResult = await githubService.getLatestCommitSha(owner, repo);
    if (!commitResult.success) {
      const statusCode = commitResult.errorCode === 'RATE_LIMITED' ? 429 : 400;
      return res.status(statusCode).json({
        success: false,
        message: commitResult.error,
        error: commitResult.errorCode
      });
    }

    // Haal file tree op en filter
    const treeResult = await githubService.getRepositoryTree(owner, repo, commitResult.sha);
    if (!treeResult.success) {
      return res.status(502).json({
        success: false,
        message: treeResult.error,
        error: treeResult.errorCode
      });
    }

    const codeFiles = githubService.filterCodeFiles(treeResult.files);
    if (codeFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Repository bevat geen code bestanden',
        error: 'EMPTY_REPO'
      });
    }

    // Maak submission aan
    const submission = await studentController.createSubmission({
      assignmentId,
      userId: studentId,
      githubUrl: github_url,
      commitSha: commitResult.sha
    });

    // Registreer webhook voor automatische analyse bij push events
    let webhookInfo = { registered: false };
    try {
      const student = await getUserById(studentId);
      const githubToken = student?.github_access_token;

      if (githubToken) {
        const webhookSecret = crypto.randomBytes(32).toString('hex');
        const webhookUrl = `${process.env.BACKEND_URL || 'https://backend.stureflect.com'}/api/webhooks/github`;

        const webhookResult = await githubService.registerWebhook(
          owner,
          repo,
          webhookUrl,
          webhookSecret,
          githubToken
        );

        if (webhookResult.success) {
          await studentController.updateSubmissionWebhook(
            submission.id,
            String(webhookResult.webhookId),
            webhookSecret
          );
          webhookInfo = {
            registered: true,
            webhookId: webhookResult.webhookId
          };
          console.log(`[API] Webhook registered for ${owner}/${repo} (ID: ${webhookResult.webhookId})`);
        } else {
          console.warn(`[API] Failed to register webhook: ${webhookResult.error}`);
          webhookInfo = {
            registered: false,
            error: webhookResult.error
          };
        }
      } else {
        console.warn('[API] No GitHub token available for webhook registration');
        webhookInfo = {
          registered: false,
          error: 'Geen GitHub token beschikbaar'
        };
      }
    } catch (webhookError) {
      console.error('[API] Webhook registration error:', webhookError.message);
      webhookInfo = {
        registered: false,
        error: 'Webhook registratie mislukt'
      };
    }

    // Voeg extra info toe aan response
    const filesWithLanguage = codeFiles.map(f => ({
      path: f.path,
      size: f.size,
      language: githubService.detectLanguage(f.path)
    }));

    res.status(201).json({
      success: true,
      data: {
        ...submission,
        repository: {
          owner,
          repo,
          default_branch: repoAccess.repoData.default_branch
        },
        files_count: codeFiles.length,
        files: filesWithLanguage,
        truncated: treeResult.truncated,
        webhook: webhookInfo
      },
      message: webhookInfo.registered
        ? 'GitHub repository gekoppeld en webhook geregistreerd'
        : 'GitHub repository gekoppeld (webhook registratie mislukt)',
      error: null
    });
  } catch (error) {
    console.error('[API] POST /api/students/me/assignments/:assignmentId/submissions failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij aanmaken inzending',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/students/me/assignments/{assignmentId}:
 *   get:
 *     tags:
 *       - Studenten
 *     summary: Haal assignment details op
 *     description: |
 *       Haalt gedetailleerde informatie op over een specifieke opdracht,
 *       inclusief cursus informatie (met rubric en AI guidelines) en submission status.
 *       Alleen toegankelijk voor studenten die ingeschreven zijn voor de cursus.
 *
 *       **Development mode:** Gebruik `studentId` query parameter.
 *       **Productie:** User ID wordt uit JWT token gehaald.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: integer
 *         description: Student ID (verplicht in development mode)
 *         example: 1
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de opdracht
 *     responses:
 *       200:
 *         description: Assignment details succesvol opgehaald
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     assignment:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         title:
 *                           type: string
 *                         description:
 *                           type: string
 *                         due_date:
 *                           type: string
 *                           format: date-time
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                     course:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         title:
 *                           type: string
 *                         rubric:
 *                           type: string
 *                           nullable: true
 *                         ai_guidelines:
 *                           type: string
 *                           nullable: true
 *                     submission_status:
 *                       type: object
 *                       properties:
 *                         has_submitted:
 *                           type: boolean
 *                         submission_id:
 *                           type: integer
 *                           nullable: true
 *                         status_text:
 *                           type: string
 *                           description: Leesbare status tekst
 *                           example: Goed op weg
 *                         progress_percentage:
 *                           type: integer
 *                           description: Voortgangspercentage gebaseerd op ai_score
 *                           example: 75
 *                         last_analysis_date:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                           description: Datum van laatste AI analyse
 *                         feedback_summary:
 *                           type: object
 *                           description: Samenvatting van feedback per severity
 *                           properties:
 *                             critical:
 *                               type: integer
 *                               example: 0
 *                             high:
 *                               type: integer
 *                               example: 1
 *                             medium:
 *                               type: integer
 *                               example: 2
 *                             low:
 *                               type: integer
 *                               example: 3
 *                             total:
 *                               type: integer
 *                               example: 6
 *                 message:
 *                   type: string
 *                   example: Assignment opgehaald
 *       400:
 *         description: Ongeldig assignment ID
 *       403:
 *         description: Niet ingeschreven voor deze cursus
 *       404:
 *         description: Assignment niet gevonden
 *       500:
 *         description: Server error
 */
router.get('/me/assignments/:assignmentId', async (req, res) => {
  try {
    const studentId = req.user?.id ||
      (process.env.NODE_ENV !== 'production' && req.query.studentId
        ? parseInt(req.query.studentId, 10)
        : null);

    if (!studentId || !Number.isInteger(studentId) || studentId <= 0) {
      const isProduction = process.env.NODE_ENV === 'production';
      return res.status(isProduction ? 401 : 400).json({
        success: false,
        message: isProduction ? 'Authenticatie vereist' : 'studentId query parameter is verplicht en moet een geldig positief getal zijn',
        error: isProduction ? 'UNAUTHORIZED' : 'BAD_REQUEST'
      });
    }

    const assignmentId = parseInt(req.params.assignmentId);

    // Valideer assignmentId
    if (isNaN(assignmentId) || assignmentId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig assignment ID',
        error: 'BAD_REQUEST'
      });
    }

    const result = await studentController.getAssignmentDetail(assignmentId, studentId);

    if (!result.success) {
      if (result.error === 'NOT_FOUND') {
        return res.status(404).json({
          success: false,
          message: 'Assignment niet gevonden',
          error: 'NOT_FOUND'
        });
      }
      if (result.error === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          message: 'Je bent niet ingeschreven voor deze cursus',
          error: 'FORBIDDEN'
        });
      }
      // Fallback voor onverwachte errors
      return res.status(500).json({
        success: false,
        message: 'Onverwachte fout bij ophalen assignment',
        error: 'INTERNAL_SERVER_ERROR'
      });
    }

    res.status(200).json({
      success: true,
      data: result.data,
      message: 'Assignment opgehaald',
      error: null
    });
  } catch (error) {
    console.error('Fout bij ophalen assignment detail:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen assignment',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/students/me/assignments/{assignmentId}/events:
 *   get:
 *     tags:
 *       - Studenten
 *     summary: SSE stream voor real-time feedback notificaties
 *     description: |
 *       Server-Sent Events endpoint voor real-time notificaties wanneer nieuwe feedback beschikbaar is.
 *       De client ontvangt een `feedback_updated` event wanneer er nieuwe AI feedback is.
 *
 *       **Gebruik in frontend:**
 *       ```javascript
 *       const eventSource = new EventSource('/api/students/me/assignments/123/events?studentId=1');
 *       eventSource.addEventListener('feedback_updated', (e) => {
 *         // Re-fetch assignment data
 *         fetchAssignmentDetail(assignmentId);
 *       });
 *       ```
 *
 *       **Development mode:** Gebruik `studentId` query parameter.
 *       **Productie:** User ID wordt uit JWT token gehaald.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: integer
 *         description: Student ID (verplicht in development mode)
 *         example: 1
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de assignment
 *     responses:
 *       200:
 *         description: SSE stream gestart
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               example: |
 *                 event: feedback_updated
 *                 data: {"submissionId": 42, "timestamp": "2025-12-18T14:30:00Z"}
 *       400:
 *         description: Ongeldig assignment ID
 *       404:
 *         description: Geen submission gevonden voor deze assignment
 *       500:
 *         description: Server error
 */
router.get('/me/assignments/:assignmentId/events', async (req, res) => {
  console.log(`[SSE] 🔔 SSE endpoint hit: assignmentId=${req.params.assignmentId}, studentId=${req.query.studentId}`);
  try {
    const studentId = req.user?.id ||
      (process.env.NODE_ENV !== 'production' && req.query.studentId
        ? parseInt(req.query.studentId, 10)
        : null);

    if (!studentId || !Number.isInteger(studentId) || studentId <= 0) {
      const isProduction = process.env.NODE_ENV === 'production';
      return res.status(isProduction ? 401 : 400).json({
        success: false,
        message: isProduction ? 'Authenticatie vereist' : 'studentId query parameter is verplicht en moet een geldig positief getal zijn',
        error: isProduction ? 'UNAUTHORIZED' : 'BAD_REQUEST'
      });
    }

    const assignmentId = parseInt(req.params.assignmentId);

    // Valideer assignmentId
    if (isNaN(assignmentId) || assignmentId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig assignment ID',
        error: 'BAD_REQUEST'
      });
    }

    // Zoek submission voor deze assignment + student
    const submissionResult = await studentController.getExistingSubmission(studentId, assignmentId);

    if (!submissionResult.success) {
      return res.status(404).json({
        success: false,
        message: 'Geen submission gevonden voor deze assignment. Dien eerst een repository in.',
        error: 'NOT_FOUND'
      });
    }

    const submissionId = submissionResult.data.id;

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Register connection with SSE manager
    sseManager.subscribe(submissionId, res);

    // Send initial connection confirmation
    res.write(`event: connected\ndata: ${JSON.stringify({ submissionId, timestamp: new Date().toISOString() })}\n\n`);

    // Set up heartbeat interval (30 seconds)
    const heartbeatInterval = setInterval(() => {
      sseManager.sendHeartbeat(res);
    }, 30000);

    // Cleanup on connection close
    req.on('close', () => {
      clearInterval(heartbeatInterval);
      sseManager.unsubscribe(submissionId, res);
      console.log(`[SSE] Client disconnected from submission ${submissionId}`);
    });

  } catch (error) {
    console.error('Fout bij opzetten SSE connectie:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij opzetten real-time connectie',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/students/me/submissions/{submissionId}:
 *   put:
 *     tags:
 *       - Studenten
 *     summary: Wijzig GitHub repository van een submission
 *     description: |
 *       Wijzig de GitHub repository URL van een bestaande submission.
 *       De oude webhook wordt verwijderd en een nieuwe wordt geregistreerd.
 *       De status wordt gereset naar 'pending'.
 *
 *       **Development mode:** Gebruik `studentId` query parameter.
 *       **Productie:** User ID wordt uit JWT token gehaald.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: integer
 *         description: Student ID (verplicht in development mode)
 *         example: 1
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de submission
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - github_url
 *             properties:
 *               github_url:
 *                 type: string
 *                 format: uri
 *                 example: https://github.com/username/new-repository
 *                 description: Nieuwe GitHub repository URL
 *     responses:
 *       200:
 *         description: Submission succesvol bijgewerkt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Submission'
 *                 message:
 *                   type: string
 *                   example: Repository succesvol gewijzigd
 *       400:
 *         description: Ongeldige input (submission ID of GitHub URL)
 *       403:
 *         description: Geen eigenaar van deze submission
 *       404:
 *         description: Submission of repository niet gevonden
 *       500:
 *         description: Server error
 */
router.put('/me/submissions/:submissionId', async (req, res) => {
  try {
    const studentId = req.user?.id ||
      (process.env.NODE_ENV !== 'production' && req.query.studentId
        ? parseInt(req.query.studentId, 10)
        : null);

    if (!studentId || !Number.isInteger(studentId) || studentId <= 0) {
      const isProduction = process.env.NODE_ENV === 'production';
      return res.status(isProduction ? 401 : 400).json({
        success: false,
        message: isProduction ? 'Authenticatie vereist' : 'studentId query parameter is verplicht en moet een geldig positief getal zijn',
        error: isProduction ? 'UNAUTHORIZED' : 'BAD_REQUEST'
      });
    }

    const submissionId = parseInt(req.params.submissionId);
    const { github_url } = req.body;

    // Valideer submissionId
    if (isNaN(submissionId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig submission ID',
        error: 'BAD_REQUEST'
      });
    }

    // Valideer github_url
    if (!github_url || typeof github_url !== 'string' || github_url.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'GitHub URL is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    // Valideer GitHub URL formaat
    const urlValidation = githubService.validateGitHubUrl(github_url);
    if (!urlValidation.valid) {
      return res.status(400).json({
        success: false,
        message: urlValidation.error,
        error: 'INVALID_URL'
      });
    }

    // Check repository access
    const { owner, repo } = urlValidation;
    const repoAccess = await githubService.checkRepositoryAccess(owner, repo);
    if (!repoAccess.accessible) {
      const statusCode = repoAccess.errorCode === 'RATE_LIMITED' ? 429 : 404;
      return res.status(statusCode).json({
        success: false,
        message: repoAccess.error,
        error: repoAccess.errorCode || 'REPO_NOT_FOUND'
      });
    }

    // Haal laatste commit SHA op
    const commitResult = await githubService.getLatestCommitSha(owner, repo);
    if (!commitResult.success) {
      const statusCode = commitResult.errorCode === 'RATE_LIMITED' ? 429 : 400;
      return res.status(statusCode).json({
        success: false,
        message: commitResult.error,
        error: commitResult.errorCode
      });
    }

    // Haal file tree op en filter
    const treeResult = await githubService.getRepositoryTree(owner, repo, commitResult.sha);
    if (!treeResult.success) {
      return res.status(502).json({
        success: false,
        message: treeResult.error,
        error: treeResult.errorCode
      });
    }

    const codeFiles = githubService.filterCodeFiles(treeResult.files);
    if (codeFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Repository bevat geen code bestanden',
        error: 'EMPTY_REPO'
      });
    }

    // Update submission in database
    const updateResult = await studentController.updateSubmission(
      submissionId,
      studentId,
      github_url,
      commitResult.sha
    );

    if (!updateResult.success) {
      if (updateResult.error === 'NOT_FOUND') {
        return res.status(404).json({
          success: false,
          message: 'Submission niet gevonden',
          error: 'NOT_FOUND'
        });
      }
      if (updateResult.error === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          message: 'Je hebt geen toegang tot deze submission',
          error: 'FORBIDDEN'
        });
      }
    }

    // Delete oude webhook indien aanwezig
    if (updateResult.oldWebhookInfo) {
      try {
        await githubService.deleteWebhook(
          updateResult.oldWebhookInfo.owner,
          updateResult.oldWebhookInfo.repo,
          updateResult.oldWebhookInfo.webhookId
        );
        console.log(`[WEBHOOK] Oude webhook verwijderd voor ${updateResult.oldWebhookInfo.owner}/${updateResult.oldWebhookInfo.repo}`);
      } catch (webhookError) {
        console.warn('[WEBHOOK] Kon oude webhook niet verwijderen:', webhookError.message);
      }
    }

    // Registreer nieuwe webhook
    let webhookInfo = { registered: false };
    try {
      const student = await getUserById(studentId);
      const githubToken = student?.github_access_token;

      if (githubToken) {
        const webhookSecret = crypto.randomBytes(32).toString('hex');
        const webhookUrl = `${process.env.BACKEND_URL || 'https://backend.stureflect.com'}/api/webhooks/github`;

        const webhookResult = await githubService.registerWebhook(
          owner,
          repo,
          webhookUrl,
          webhookSecret,
          githubToken
        );

        if (webhookResult.success) {
          await studentController.updateSubmissionWebhook(
            submissionId,
            String(webhookResult.webhookId),
            webhookSecret
          );
          webhookInfo = {
            registered: true,
            webhookId: webhookResult.webhookId
          };
          console.log(`[WEBHOOK] Nieuwe webhook geregistreerd voor ${owner}/${repo} (ID: ${webhookResult.webhookId})`);
        } else {
          webhookInfo = {
            registered: false,
            error: webhookResult.error
          };
        }
      }
    } catch (webhookError) {
      console.error('[WEBHOOK] Fout bij registreren nieuwe webhook:', webhookError);
      webhookInfo = {
        registered: false,
        error: 'Interne fout bij webhook registratie'
      };
    }

    res.status(200).json({
      success: true,
      data: {
        ...updateResult.submission,
        github_url: github_url,
        repository: {
          owner,
          repo,
          default_branch: repoAccess.repoData?.default_branch
        },
        webhook: webhookInfo
      },
      message: webhookInfo.registered
        ? 'Repository succesvol gewijzigd met nieuwe webhook'
        : 'Repository gewijzigd (webhook registratie mislukt)',
      error: null
    });
  } catch (error) {
    console.error('Fout bij updaten submission:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij wijzigen repository',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/students/me/submissions/{submissionId}:
 *   delete:
 *     tags:
 *       - Studenten
 *     summary: Ontkoppel GitHub repository van een submission
 *     description: |
 *       Verwijdert de gekoppelde GitHub repository van een submission.
 *       De webhook wordt verwijderd van GitHub en de submission krijgt status 'unlinked'.
 *       Bestaande feedback blijft behouden voor history.
 *       Student kan later een nieuwe repository koppelen via PUT.
 *
 *       **Development mode:** Gebruik `studentId` query parameter.
 *       **Productie:** User ID wordt uit JWT token gehaald.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: studentId
 *         schema:
 *           type: integer
 *         description: Student ID (verplicht in development mode)
 *         example: 1
 *       - in: path
 *         name: submissionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de submission
 *     responses:
 *       200:
 *         description: Repository succesvol ontkoppeld
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     status:
 *                       type: string
 *                       example: unlinked
 *                     github_url:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                 message:
 *                   type: string
 *                   example: Repository succesvol ontkoppeld
 *       400:
 *         description: Ongeldig submission ID of repository al ontkoppeld
 *       403:
 *         description: Geen eigenaar van deze submission
 *       404:
 *         description: Submission niet gevonden
 *       500:
 *         description: Server error
 */
router.delete('/me/submissions/:submissionId', async (req, res) => {
  try {
    const studentId = req.user?.id ||
      (process.env.NODE_ENV !== 'production' && req.query.studentId
        ? parseInt(req.query.studentId, 10)
        : null);

    if (!studentId || !Number.isInteger(studentId) || studentId <= 0) {
      const isProduction = process.env.NODE_ENV === 'production';
      return res.status(isProduction ? 401 : 400).json({
        success: false,
        message: isProduction ? 'Authenticatie vereist' : 'studentId query parameter is verplicht en moet een geldig positief getal zijn',
        error: isProduction ? 'UNAUTHORIZED' : 'BAD_REQUEST'
      });
    }

    const submissionId = parseInt(req.params.submissionId);

    // Valideer submissionId
    if (isNaN(submissionId) || submissionId <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig submission ID',
        error: 'BAD_REQUEST'
      });
    }

    // Unlink submission
    const unlinkResult = await studentController.unlinkSubmission(submissionId, studentId);

    if (!unlinkResult.success) {
      if (unlinkResult.error === 'NOT_FOUND') {
        return res.status(404).json({
          success: false,
          message: 'Submission niet gevonden',
          error: 'NOT_FOUND'
        });
      }
      if (unlinkResult.error === 'FORBIDDEN') {
        return res.status(403).json({
          success: false,
          message: 'Je hebt geen toegang tot deze submission',
          error: 'FORBIDDEN'
        });
      }
      if (unlinkResult.error === 'ALREADY_UNLINKED') {
        return res.status(400).json({
          success: false,
          message: 'Deze submission heeft al geen repository gekoppeld',
          error: 'ALREADY_UNLINKED'
        });
      }
      // Default case for unknown errors
      return res.status(500).json({
        success: false,
        message: 'Fout bij ontkoppelen repository',
        error: 'INTERNAL_SERVER_ERROR'
      });
    }

    // Delete webhook van GitHub indien aanwezig
    if (unlinkResult.oldWebhookInfo) {
      try {
        await githubService.deleteWebhook(
          unlinkResult.oldWebhookInfo.owner,
          unlinkResult.oldWebhookInfo.repo,
          unlinkResult.oldWebhookInfo.webhookId
        );
        console.log(`[WEBHOOK] Webhook verwijderd voor ${unlinkResult.oldWebhookInfo.owner}/${unlinkResult.oldWebhookInfo.repo}`);
      } catch (webhookError) {
        console.warn('[WEBHOOK] Kon webhook niet verwijderen:', webhookError.message);
        // Geen error naar client - submission is wel ontkoppeld
      }
    }

    res.status(200).json({
      success: true,
      data: unlinkResult.submission,
      message: 'Repository succesvol ontkoppeld',
      error: null
    });
  } catch (error) {
    console.error('Fout bij ontkoppelen submission:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij ontkoppelen repository',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

module.exports = router;
