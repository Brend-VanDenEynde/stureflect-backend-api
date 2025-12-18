const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const {
	getEnrolledStudents,
	getStudentStatusByCourse,
	getStudentStatusForStudent,
	addStudentToCourse,
	removeStudentFromCourse,
	getDocentCourses,
	createCourse,
	streamCourseStatistics
} = require('../controllers/docentController');

/**
 * @swagger
 * /api/docent/courses/{courseId}/statistics/stream:
 *   get:
 *     tags:
 *       - Docenten
 *     summary: Real-time statistieken stream (SSE)
 *     description: Server-Sent Events stream voor live updates van cursusstatistieken. Authenticatie via query parameter token= voor EventSource compatibiliteit.
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de cursus
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: JWT access token (omdat EventSource geen headers ondersteunt)
 *     responses:
 *       200:
 *         description: SSE stream gestart
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *       400:
 *         description: Ontbrekende cursus ID
 *       401:
 *         description: Ongeldige of ontbrekende token
 *       403:
 *         description: Geen toegang tot deze cursus
 */
// ✅ SSE route VOOR authenticatie middleware (gebruikt query token in plaats van header)
router.get('/courses/:courseId/statistics/stream', streamCourseStatistics);

// Authenticatie middleware toepassen op alle overige docent routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/docent/courses:
 *   get:
 *     tags:
 *       - Docenten
 *     summary: Haal vakken van docent op
 *     description: Haalt alle vakken op waar de ingelogde docent les aan geeft, inclusief aantallen studenten en opdrachten
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lijst met vakken van de docent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 courses:
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
 *                       joinCode:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                       studentCount:
 *                         type: integer
 *                       assignmentCount:
 *                         type: integer
 *       401:
 *         description: Niet geauthenticeerd
 *       500:
 *         description: Interne serverfout
 */
router.get('/courses', getDocentCourses);

/**
 * @swagger
 * /api/docent/courses/{courseId}/students:
 *   get:
 *     tags:
 *       - Docenten
 *     summary: Haal ingeschreven studenten op
 *     description: Haalt een gepagineerde lijst op van studenten die zijn ingeschreven voor een specifieke cursus
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de cursus
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Paginanummer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Aantal items per pagina
 *     responses:
 *       200:
 *         description: Lijst met studenten en paginering metadata
 *       400:
 *         description: Ontbrekende verplichte parameters
 *       500:
 *         description: Interne serverfout
 *   post:
 *     tags:
 *       - Docenten
 *     summary: Voeg student toe aan cursus
 *     description: Voegt een student toe aan een cursus op basis van e-mailadres
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de cursus
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: E-mailadres van de student
 *     responses:
 *       201:
 *         description: Student succesvol toegevoegd
 *       400:
 *         description: Ongeldige input of missende velden
 *       404:
 *         description: Student niet gevonden
 *       409:
 *         description: Student is al ingeschreven
 */
router.get('/courses/:courseId/students', getEnrolledStudents);

/**
 * @swagger
 * /api/docent/courses/{courseId}/student-status:
 *   get:
 *     tags:
 *       - Docenten
 *     summary: Haal student status per cursus op
 *     description: Haalt de status op van alle studenten voor een specifieke cursus
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de cursus
 *     responses:
 *       200:
 *         description: Status informatie van alle studenten in de cursus
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Ontbrekende cursus ID
 *       500:
 *         description: Interne serverfout
 */
router.get('/courses/:courseId/student-status', getStudentStatusByCourse);

/**
 * @swagger
 * /api/docent/courses/{courseId}/students/{studentId}/status:
 *   get:
 *     tags:
 *       - Docenten
 *     summary: Haal status voor specifieke student op
 *     description: Haalt gedetailleerde statusinformatie op voor een specifieke student in een cursus
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de cursus
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de student
 *     responses:
 *       200:
 *         description: Gedetailleerde status informatie van de student
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Ontbrekende parameters
 *       404:
 *         description: Student of cursus niet gevonden
 *       500:
 *         description: Interne serverfout
 */
router.get('/courses/:courseId/students/:studentId/status', getStudentStatusForStudent);

router.post('/courses', createCourse);

router.post('/courses/:courseId/students', addStudentToCourse);

/**
 * @swagger
 * /api/docent/courses/{courseId}/students/{studentId}:
 *   delete:
 *     tags:
 *       - Docenten
 *     summary: Verwijder student uit cursus
 *     description: Verwijdert een student uit een specifieke cursus
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de cursus
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de te verwijderen student
 *     responses:
 *       200:
 *         description: Student succesvol verwijderd
 *       400:
 *         description: Missing parameters
 *       404:
 *         description: Student niet ingeschreven
 */
router.delete('/courses/:courseId/students/:studentId', removeStudentFromCourse);

module.exports = router;