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
	getAssignmentSubmissions
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
 * /api/docent/assignments:
 *   get:
 *     tags:
 *       - Docenten
 *     summary: Haal alle opdrachten van de docent op
 *     description: Haalt alle opdrachten op van alle vakken waar de docent les aan geeft, met optionele filtering en sortering
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: courseId
 *         schema:
 *           type: integer
 *         description: Filter op specifiek vak (optioneel)
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [dueDate, title, createdAt, courseTitle]
 *           default: dueDate
 *         description: Sorteer veld
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sorteer richting
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
 *         description: Lijst met opdrachten en paginering metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 assignments:
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
 *                       courseId:
 *                         type: integer
 *                       courseTitle:
 *                         type: string
 *                       dueDate:
 *                         type: string
 *                         format: date-time
 *                       rubric:
 *                         type: string
 *                       aiGuidelines:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalItems:
 *                       type: integer
 *                     itemsPerPage:
 *                       type: integer
 *       401:
 *         description: Niet geauthenticeerd
 *       500:
 *         description: Interne serverfout
 */
router.get('/assignments', getDocentAssignments);

/**
 * @swagger
 * /api/docent/assignments/{assignmentId}:
 *   get:
 *     tags:
 *       - Docenten
 *     summary: Haal details van specifieke opdracht op
 *     description: Haalt gedetailleerde informatie op van een specifieke opdracht, inclusief statistieken en alle studentinzendingen
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de opdracht
 *     responses:
 *       200:
 *         description: Opdracht details met statistieken en inzendingen
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 assignment:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     courseId:
 *                       type: integer
 *                     dueDate:
 *                       type: string
 *                       format: date-time
 *                     rubric:
 *                       type: string
 *                     aiGuidelines:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                 course:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     title:
 *                       type: string
 *                 statistics:
 *                   type: object
 *                   properties:
 *                     totalSubmissions:
 *                       type: integer
 *                     studentsSubmitted:
 *                       type: integer
 *                     completedCount:
 *                       type: integer
 *                     gradedCount:
 *                       type: integer
 *                     avgScore:
 *                       type: number
 *                       nullable: true
 *                 submissions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       studentId:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       submissionId:
 *                         type: integer
 *                         nullable: true
 *                       status:
 *                         type: string
 *                         nullable: true
 *                       submissionDate:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       aiScore:
 *                         type: number
 *                         nullable: true
 *                       manualScore:
 *                         type: number
 *                         nullable: true
 *                       repoUrl:
 *                         type: string
 *                         nullable: true
 *                       branch:
 *                         type: string
 *                         nullable: true
 *                       feedbackCount:
 *                         type: integer
 *                       feedbackSeverityAvg:
 *                         type: number
 *                         nullable: true
 *       400:
 *         description: Ongeldige opdracht ID
 *       401:
 *         description: Niet geauthenticeerd
 *       404:
 *         description: Opdracht niet gevonden of geen toegang
 *       500:
 *         description: Interne serverfout
 */
router.get('/assignments/:assignmentId', getAssignmentDetail);

/**
 * @swagger
 * /api/docent/assignments/{assignmentId}/statistics:
 *   get:
 *     tags:
 *       - Docenten
 *     summary: Haal live statistieken voor een opdracht op
 *     description: Haalt real-time statistieken op voor een specifieke opdracht, inclusief inzendingspercentages en status distributie
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de opdracht
 *     responses:
 *       200:
 *         description: Opdracht statistieken
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 assignment:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     title:
 *                       type: string
 *                     courseId:
 *                       type: integer
 *                     courseTitle:
 *                       type: string
 *                 statistics:
 *                   type: object
 *                   properties:
 *                     totalStudents:
 *                       type: integer
 *                       description: Totaal aantal ingeschreven studenten
 *                     totalSubmissions:
 *                       type: integer
 *                       description: Totaal aantal inzendingen
 *                     studentsSubmitted:
 *                       type: integer
 *                       description: Aantal studenten dat heeft ingediend
 *                     studentsNoSubmission:
 *                       type: integer
 *                       description: Aantal studenten zonder inzending
 *                     submissionPercentage:
 *                       type: number
 *                       description: Percentage studenten dat heeft ingediend
 *                     statusDistribution:
 *                       type: object
 *                       properties:
 *                         noSubmission:
 *                           type: integer
 *                           description: Studenten zonder inzending
 *                         pending:
 *                           type: integer
 *                           description: Studenten met pending status
 *                         completed:
 *                           type: integer
 *                           description: Studenten met completed status
 *                         graded:
 *                           type: integer
 *                           description: Studenten met graded status
 *                     scores:
 *                       type: object
 *                       properties:
 *                         average:
 *                           type: number
 *                           nullable: true
 *                           description: Gemiddelde score
 *                         minimum:
 *                           type: number
 *                           nullable: true
 *                           description: Minimum score
 *                         maximum:
 *                           type: number
 *                           nullable: true
 *                           description: Maximum score
 *       400:
 *         description: Ongeldige opdracht ID
 *       401:
 *         description: Niet geauthenticeerd
 *       404:
 *         description: Opdracht niet gevonden of geen toegang
 *       500:
 *         description: Interne serverfout
 */
router.get('/assignments/:assignmentId/statistics', getAssignmentStatistics);

/**
 * @swagger
 * /api/docent/assignments/{assignmentId}/submissions:
 *   get:
 *     tags:
 *       - Docenten
 *     summary: Haal alle inzendingen voor een opdracht op
 *     description: Haalt alle student inzendingen voor een specifieke opdracht op met klasbrede statistieken inclusief gemiddelde AI scores en hoogste/laagste scores
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de opdracht
 *     responses:
 *       200:
 *         description: Opdracht inzendingen met statistieken
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 assignment:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     title:
 *                       type: string
 *                     courseId:
 *                       type: integer
 *                     courseTitle:
 *                       type: string
 *                     dueDate:
 *                       type: string
 *                       format: date-time
 *                 classStatistics:
 *                   type: object
 *                   properties:
 *                     totalStudents:
 *                       type: integer
 *                       description: Totaal aantal studenten
 *                     studentsSubmitted:
 *                       type: integer
 *                       description: Aantal studenten dat heeft ingediend
 *                     totalSubmissions:
 *                       type: integer
 *                       description: Totaal aantal inzendingen
 *                     submissionRate:
 *                       type: number
 *                       description: Percentage studenten dat heeft ingediend
 *                     aiScores:
 *                       type: object
 *                       properties:
 *                         average:
 *                           type: number
 *                           nullable: true
 *                           description: Gemiddelde AI score
 *                         minimum:
 *                           type: number
 *                           nullable: true
 *                           description: Laagste AI score
 *                         maximum:
 *                           type: number
 *                           nullable: true
 *                           description: Hoogste AI score
 *                     finalScores:
 *                       type: object
 *                       properties:
 *                         average:
 *                           type: number
 *                           nullable: true
 *                           description: Gemiddelde finale score
 *                         minimum:
 *                           type: number
 *                           nullable: true
 *                           description: Laagste finale score
 *                         maximum:
 *                           type: number
 *                           nullable: true
 *                           description: Hoogste finale score
 *                 students:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       studentId:
 *                         type: integer
 *                       studentName:
 *                         type: string
 *                       email:
 *                         type: string
 *                       githubId:
 *                         type: string
 *                       totalAttempts:
 *                         type: integer
 *                       averageScore:
 *                         type: number
 *                         nullable: true
 *                       highestScore:
 *                         type: number
 *                         nullable: true
 *                       lowestScore:
 *                         type: number
 *                         nullable: true
 *                       averageAiScore:
 *                         type: number
 *                         nullable: true
 *                       scoreImprovement:
 *                         type: number
 *                         nullable: true
 *                       latestSubmission:
 *                         type: object
 *                         nullable: true
 *                       attempts:
 *                         type: array
 *                         items:
 *                           type: object
 *       400:
 *         description: Ongeldige opdracht ID
 *       401:
 *         description: Niet geauthenticeerd
 *       404:
 *         description: Opdracht niet gevonden of geen toegang
 *       500:
 *         description: Interne serverfout
 */
router.get('/assignments/:assignmentId/submissions', getAssignmentSubmissions);

/**
 * @swagger
 * /api/docent/assignments/{assignmentId}:
 *   put:
 *     tags:
 *       - Docenten
 *     summary: Update een bestaande opdracht
 *     description: Werk de details van een opdracht bij. Alleen docenten van de cursus en admins kunnen opdrachten wijzigen.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de opdracht die moet worden bijgewerkt
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 255
 *                 description: Titel van de opdracht (mag niet leeg zijn indien opgegeven)
 *                 example: "Updated REST API Implementation"
 *               description:
 *                 type: string
 *                 description: Beschrijving van de opdracht
 *                 example: "Build a comprehensive RESTful API with Node.js, Express, and PostgreSQL"
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 description: Deadline voor de opdracht (ISO8601 format)
 *                 example: "2025-12-31T23:59:59Z"
 *               rubric:
 *                 type: string
 *                 description: Beoordelingsrubriek voor de opdracht
 *                 example: "Functionality (40%), Code quality (30%), Documentation (20%), Testing (10%)"
 *               aiGuidelines:
 *                 type: string
 *                 description: AI feedback richtlijnen
 *                 example: "Check for RESTful best practices, proper error handling, and security measures"
 *           example:
 *             title: "Updated REST API Implementation"
 *             description: "Build a comprehensive RESTful API with Node.js, Express, and PostgreSQL"
 *             dueDate: "2025-12-31T23:59:59Z"
 *             rubric: "Functionality (40%), Code quality (30%), Documentation (20%), Testing (10%)"
 *             aiGuidelines: "Check for RESTful best practices, proper error handling, and security measures"
 *     responses:
 *       200:
 *         description: Opdracht succesvol bijgewerkt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 assignment:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: Unieke ID van de opdracht
 *                     title:
 *                       type: string
 *                       description: Titel van de opdracht
 *                     description:
 *                       type: string
 *                       description: Beschrijving van de opdracht
 *                     courseId:
 *                       type: integer
 *                       description: ID van de cursus
 *                     dueDate:
 *                       type: string
 *                       format: date-time
 *                       description: Deadline voor de opdracht
 *                     rubric:
 *                       type: string
 *                       description: Beoordelingsrubriek
 *                     aiGuidelines:
 *                       type: string
 *                       description: AI feedback richtlijnen
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       description: Aanmaakdatum
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: Laatste wijzigingsdatum
 *             example:
 *               assignment:
 *                 id: 1
 *                 title: "Updated REST API Implementation"
 *                 description: "Build a comprehensive RESTful API with Node.js, Express, and PostgreSQL"
 *                 courseId: 1
 *                 dueDate: "2025-12-31T23:59:59.000Z"
 *                 rubric: "Functionality (40%), Code quality (30%), Documentation (20%), Testing (10%)"
 *                 aiGuidelines: "Check for RESTful best practices, proper error handling, and security measures"
 *                 createdAt: "2024-12-01T10:00:00.000Z"
 *                 updatedAt: "2024-12-18T14:30:00.000Z"
 *       400:
 *         description: Validatiefout (ongeldige invoer, lege titel, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *             examples:
 *               noFields:
 *                 value:
 *                   error: "No fields provided to update"
 *               emptyTitle:
 *                 value:
 *                   error: "Title cannot be empty"
 *               invalidDate:
 *                 value:
 *                   error: "Invalid dueDate format: must be a valid ISO8601 date"
 *       401:
 *         description: Niet geauthenticeerd
 *       403:
 *         description: Geen toestemming (gebruiker is geen docent van deze cursus)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Forbidden: You are not a teacher of this course"
 *       404:
 *         description: Opdracht niet gevonden
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Assignment not found"
 *       500:
 *         description: Interne serverfout
 */
router.put('/assignments/:assignmentId', authenticateToken, updateAssignment);

/**
 * @swagger
 * /api/docent/assignments/{assignmentId}:
 *   delete:
 *     tags:
 *       - Docenten
 *     summary: Verwijder opdracht
 *     description: Verwijdert een opdracht permanent. Deze actie kan niet ongedaan worden gemaakt. Alle gerelateerde data (inleveringen, feedback) wordt automatisch verwijderd door database CASCADE.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de te verwijderen opdracht
 *     responses:
 *       200:
 *         description: Opdracht succesvol verwijderd
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Assignment successfully deleted"
 *                 assignment:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 5
 *                     title:
 *                       type: string
 *                       example: "REST API Implementation"
 *                     description:
 *                       type: string
 *                       example: "Build a RESTful API with Node.js and Express"
 *                     courseId:
 *                       type: integer
 *                       example: 1
 *                     dueDate:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-12-31T23:59:59Z"
 *                     rubric:
 *                       type: string
 *                       nullable: true
 *                       example: "Functionality (40%), Code quality (30%), Documentation (30%)"
 *                     aiGuidelines:
 *                       type: string
 *                       nullable: true
 *                       example: "Check for RESTful best practices and proper error handling"
 *       400:
 *         description: Ongeldige assignment ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid assignment ID: must be an integer"
 *       401:
 *         description: Niet geauthenticeerd
 *       403:
 *         description: Geen toestemming (gebruiker is geen docent van dit vak)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Forbidden: You do not have permission to delete this assignment"
 *       404:
 *         description: Opdracht niet gevonden
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Assignment not found"
 *       500:
 *         description: Interne serverfout
 */
router.delete('/assignments/:assignmentId', authenticateToken, deleteAssignment);

/**
 * @swagger
 * /api/docent/courses/{courseId}/assignments:
 *   get:
 *     tags:
 *       - Docenten
 *     summary: Haal opdrachten van een specifiek vak op
 *     description: Haalt alle opdrachten op van een specifiek vak waar de docent les aan geeft, inclusief het aantal inzendingen per opdracht
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van het vak
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [dueDate, title, createdAt, submissionCount]
 *           default: dueDate
 *         description: Sorteer opdrachten op dit veld
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sorteervolgorde (oplopend of aflopend)
 *     responses:
 *       200:
 *         description: Lijst met opdrachten
 *       401:
 *         description: Niet geauthenticeerd
 *       403:
 *         description: Geen toegang tot dit vak
 *       404:
 *         description: Vak niet gevonden
 *       500:
 *         description: Interne serverfout
 */
router.get('/courses/:courseId/assignments', getDocentCourseAssignments);

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

/**
 * @swagger
 * /api/docent/courses:
 *   post:
 *     tags:
 *       - Docenten
 *     summary: Vak aanmaken
 *     description: Maakt een nieuw vak aan en voegt de ingelogde docent automatisch toe als docent van het vak
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: Titel van het vak
 *                 example: "Web Development 101"
 *               description:
 *                 type: string
 *                 description: Beschrijving van het vak (optioneel)
 *                 example: "Leer de basis van web development"
 *               join_code:
 *                 type: string
 *                 description: Unieke inschrijfcode voor het vak (optioneel)
 *                 example: "WEB2024"
 *     responses:
 *       201:
 *         description: Vak succesvol aangemaakt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 course:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     title:
 *                       type: string
 *                       example: "Web Development 101"
 *                     description:
 *                       type: string
 *                       example: "Leer de basis van web development"
 *                     join_code:
 *                       type: string
 *                       example: "WEB2024"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Ongeldige invoer (titel ontbreekt of is leeg)
 *       401:
 *         description: Niet geauthenticeerd
 *       403:
 *         description: Geen toestemming (alleen docenten en admins kunnen vakken aanmaken)
 *       409:
 *         description: Inschrijfcode bestaat al
 *       500:
 *         description: Interne serverfout
 */
router.post('/courses', createCourse);

/**
 * @swagger
 * /api/docent/assignments:
 *   post:
 *     tags:
 *       - Docenten
 *     summary: Nieuwe opdracht aanmaken
 *     description: Maakt een nieuwe opdracht aan voor een specifiek vak. Alleen docenten die les geven aan het vak kunnen opdrachten aanmaken.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - course_id
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 255
 *                 description: Titel van de opdracht
 *                 example: "Implementeer REST API"
 *               description:
 *                 type: string
 *                 description: Gedetailleerde beschrijving van de opdracht (optioneel)
 *                 example: "Bouw een RESTful API met Node.js en Express"
 *               course_id:
 *                 type: integer
 *                 description: ID van het vak waarin de opdracht wordt aangemaakt
 *                 example: 1
 *               due_date:
 *                 type: string
 *                 format: date-time
 *                 description: Inleverdatum en tijd (optioneel, ISO8601 formaat)
 *                 example: "2025-12-31T23:59:59Z"
 *               rubric:
 *                 type: string
 *                 description: Beoordelingscriteria voor studenten (optioneel)
 *                 example: "Functionaliteit (40%), Code kwaliteit (30%), Documentatie (30%)"
 *               ai_guidelines:
 *                 type: string
 *                 description: Richtlijnen voor AI-feedback (optioneel)
 *                 example: "Controleer op RESTful best practices en error handling"
 *     responses:
 *       201:
 *         description: Opdracht succesvol aangemaakt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 assignment:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     title:
 *                       type: string
 *                       example: "Implementeer REST API"
 *                     description:
 *                       type: string
 *                       example: "Bouw een RESTful API met Node.js en Express"
 *                     courseId:
 *                       type: integer
 *                       example: 1
 *                     dueDate:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-12-31T23:59:59.000Z"
 *                     rubric:
 *                       type: string
 *                       example: "Functionaliteit (40%), Code kwaliteit (30%), Documentatie (30%)"
 *                     aiGuidelines:
 *                       type: string
 *                       example: "Controleer op RESTful best practices en error handling"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Ongeldige invoer (titel ontbreekt, leeg, te lang, of course_id is ongeldig)
 *       401:
 *         description: Niet geauthenticeerd
 *       403:
 *         description: Geen toestemming (alleen docenten en admins die les geven aan het vak kunnen opdrachten aanmaken)
 *       404:
 *         description: Vak niet gevonden
 *       500:
 *         description: Interne serverfout
 */
router.post('/assignments', createAssignment);

/**
 * @swagger
 * /api/docent/courses/{courseId}:
 *   put:
 *     tags:
 *       - Docenten
 *     summary: Vak bewerken
 *     description: Bewerkt de gegevens van een bestaand vak. Alleen docenten die les geven aan dit vak kunnen het bewerken.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van het te bewerken vak
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 description: Nieuwe titel van het vak
 *                 example: "Advanced Web Development"
 *               description:
 *                 type: string
 *                 description: Nieuwe beschrijving van het vak (optioneel)
 *                 example: "Een gevorderde cursus over web development"
 *               join_code:
 *                 type: string
 *                 description: Nieuwe unieke inschrijfcode voor het vak (optioneel)
 *                 example: "WEB2024-ADV"
 *     responses:
 *       200:
 *         description: Vak succesvol bewerkt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 course:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     title:
 *                       type: string
 *                       example: "Advanced Web Development"
 *                     description:
 *                       type: string
 *                       example: "Een gevorderde cursus over web development"
 *                     join_code:
 *                       type: string
 *                       example: "WEB2024-ADV"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Ongeldige invoer (titel ontbreekt of is leeg)
 *       401:
 *         description: Niet geauthenticeerd
 *       403:
 *         description: Geen toestemming (gebruiker is geen docent van dit vak)
 *       404:
 *         description: Vak niet gevonden
 *       409:
 *         description: Inschrijfcode bestaat al
 *       500:
 *         description: Interne serverfout
 *   delete:
 *     tags:
 *       - Docenten
 *     summary: Vak verwijderen
 *     description: Verwijdert een vak permanent. Deze actie kan niet ongedaan worden gemaakt. Alle gerelateerde data (inschrijvingen, opdrachten, inleveringen, feedback) wordt automatisch verwijderd door database CASCADE.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van het te verwijderen vak
 *     responses:
 *       200:
 *         description: Vak succesvol verwijderd
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Course successfully deleted"
 *                 course:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     title:
 *                       type: string
 *                       example: "Web Development 101"
 *                     description:
 *                       type: string
 *                       example: "Leer de basis van web development"
 *                     join_code:
 *                       type: string
 *                       example: "WEB2024"
 *       400:
 *         description: Ongeldige invoer (courseId ontbreekt)
 *       401:
 *         description: Niet geauthenticeerd
 *       403:
 *         description: Geen toestemming (gebruiker is geen docent van dit vak)
 *       404:
 *         description: Vak niet gevonden
 *       500:
 *         description: Interne serverfout
 */
router.put('/courses/:courseId', updateCourse);

router.delete('/courses/:courseId', deleteCourse);

/**
 * @swagger
 * /api/docent/courses/{courseId}/students:
 *   post:
 *     tags:
 *       - Docenten
 *     summary: Voeg student toe aan cursus
 *     description: Voegt een student toe aan een cursus op basis van e-mailadres. De student moet al geregistreerd zijn in het systeem.
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
 *                 description: E-mailadres van de student die moet worden toegevoegd
 *                 example: "student@example.com"
 *     responses:
 *       201:
 *         description: Student succesvol toegevoegd aan de cursus
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Student successfully added to the course"
 *                 enrollment:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 42
 *                     course_id:
 *                       type: integer
 *                       example: 8
 *                     user_id:
 *                       type: integer
 *                       example: 15
 *                     enrolled_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Ongeldige input - e-mail ontbreekt of is ongeldig
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Email is required"
 *       401:
 *         description: Niet geauthenticeerd
 *       403:
 *         description: Geen toestemming (gebruiker is geen docent van dit vak)
 *       404:
 *         description: Student of cursus niet gevonden
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Student not found"
 *       409:
 *         description: Student is al ingeschreven in deze cursus
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Student is already enrolled in this course"
 *       500:
 *         description: Interne serverfout
 */
router.post('/courses/:courseId/students', addStudentToCourse);

/**
 * @swagger
 * /api/docent/courses/{courseId}/students/{studentId}:
 *   delete:
 *     tags:
 *       - Docenten
 *     summary: Verwijder student uit cursus
 *     description: Verwijdert een student uit een specifieke cursus. De inschrijving wordt permanent verwijderd.
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
 *         description: ID van de student die moet worden verwijderd
 *     responses:
 *       200:
 *         description: Student succesvol verwijderd uit de cursus
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Student successfully removed from the course"
 *       400:
 *         description: Ontbrekende of ongeldige parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "courseId and studentId are required"
 *       401:
 *         description: Niet geauthenticeerd
 *       403:
 *         description: Geen toestemming (gebruiker is geen docent van dit vak)
 *       404:
 *         description: Student is niet ingeschreven in deze cursus
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Student is not enrolled in this course"
 *       500:
 *         description: Interne serverfout
 */
router.delete('/courses/:courseId/students/:studentId', removeStudentFromCourse);

module.exports = router;