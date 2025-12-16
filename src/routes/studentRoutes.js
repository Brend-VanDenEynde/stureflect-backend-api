const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/authMiddleware');
const studentController = require('../controllers/studentController');
const githubService = require('../services/githubService');

// TODO: Authenticatie tijdelijk uitgeschakeld voor testing
// router.use(authenticateToken);

/**
 * @swagger
 * /api/students/me/courses:
 *   get:
 *     tags:
 *       - Studenten
 *     summary: Haal cursussen van ingelogde student op
 *     description: Retourneert alle cursussen waar de ingelogde student voor is ingeschreven, inclusief het aantal opdrachten per cursus.
 *     security:
 *       - bearerAuth: []
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
 * @swagger
 * /api/students/me/submissions:
 *   get:
 *     tags:
 *       - Studenten
 *     summary: Haal alle submissions van student op
 *     description: Haalt alle submissions op van de ingelogde student met optionele filters
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 * @swagger
 * /api/students/me/submissions/{submissionId}:
 *   get:
 *     tags:
 *       - Studenten
 *     summary: Haal submission detail op
 *     description: Haalt detail van een specifieke submission op inclusief feedback. Alleen toegankelijk voor de eigenaar.
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
    const studentId = req.user?.id || parseInt(req.query.studentId) || 1;
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

    // Autorisatie: check of submission van deze student is
    if (detail.submission.user_id !== studentId) {
      return res.status(403).json({
        success: false,
        message: 'Je hebt geen toegang tot deze submission',
        error: 'FORBIDDEN'
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
 * @swagger
 * /api/students/me/courses/{courseId}/assignments:
 *   get:
 *     tags:
 *       - Studenten
 *     summary: Haal opdrachten van een cursus op
 *     description: Haalt alle opdrachten op voor een specifieke cursus waar de student is ingeschreven
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
 *                     $ref: '#/components/schemas/Assignment'
 *       400:
 *         description: Ongeldig cursus ID
 *       403:
 *         description: Niet ingeschreven voor cursus
 *       500:
 *         description: Server error
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

/**
 * @swagger
 * /api/students/me/assignments/{assignmentId}/submissions:
 *   post:
 *     tags:
 *       - Studenten
 *     summary: Dien GitHub repository in
 *     description: Dien een GitHub repository in voor een opdracht. De repository wordt gevalideerd.
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *                   $ref: '#/components/schemas/Submission'
 *                 message:
 *                   type: string
 *       400:
 *         description: Ongeldige GitHub URL of assignment ID
 *       403:
 *         description: Niet ingeschreven voor cursus
 *       404:
 *         description: Opdracht niet gevonden
 *       409:
 *         description: Al een submission voor deze opdracht
 */
router.post('/me/assignments/:assignmentId/submissions', async (req, res) => {
  try {
    const studentId = req.user?.id || parseInt(req.query.studentId) || 1;
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
    const assignment = await studentController.getAssignmentWithCourse(assignmentId);
    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Opdracht niet gevonden',
        error: 'NOT_FOUND'
      });
    }

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
    const existingSubmission = await studentController.getExistingSubmission(studentId, assignmentId);
    if (existingSubmission) {
      return res.status(409).json({
        success: false,
        message: 'Je hebt al een inzending voor deze opdracht',
        error: 'CONFLICT',
        data: { existing_submission_id: existingSubmission.id }
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
        truncated: treeResult.truncated
      },
      message: 'Inzending succesvol aangemaakt',
      error: null
    });
  } catch (error) {
    console.error('Fout bij aanmaken submission:', error);
    res.status(500).json({
      success: false,
      message: 'Fout bij aanmaken inzending',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

module.exports = router;
