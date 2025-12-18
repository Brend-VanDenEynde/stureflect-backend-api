const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authenticateToken = require('../middleware/authMiddleware');
const db = require('../config/db');

/**
 * @swagger
 * /api/admin/students:
 *   get:
 *     tags:
 *       - Admin - Students
 *     summary: Haal alle studenten op
 *     description: Verkrijg een lijst van alle geregistreerde studenten (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lijst van studenten
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
 *                     $ref: '#/components/schemas/User'
 *                 message:
 *                   type: string
 *       403:
 *         description: Geen admin rechten
 */
router.get('/admin/students', authenticateToken, async (req, res) => {
  // Development: query param fallback, Productie: alleen req.user.id
  const adminId = req.user?.id || parseInt(req.query.adminId);

  // Audit log: request ontvangen
  console.log(`[API] Admin ${adminId || 'unknown'} requested all students at ${new Date().toISOString()}`);

  try {
    // Autorisatie: controleer of gebruiker admin is
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze data',
        error: 'FORBIDDEN'
      });
    }

    const students = await adminController.getAllStudents();

    // Audit log: succesvolle request
    console.log(`[API] Admin ${adminId} retrieved ${students.length} students`);

    // Validatie: controleer of er studenten beschikbaar zijn
    if (students.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'Geen studenten gevonden',
        error: null
      });
    }

    res.status(200).json({
      success: true,
      data: students,
      message: `${students.length} studenten gevonden`,
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId} failed to retrieve students`, error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen studenten',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/students/{studentId}:
 *   get:
 *     tags:
 *       - Admin - Students
 *     summary: Haal een specifieke student op
 *     description: Verkrijg gedetailleerde informatie van een specifieke student (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de student
 *     responses:
 *       200:
 *         description: Student gevonden
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
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     github_id:
 *                       type: string
 *                     role:
 *                       type: string
 *                     enrolled_courses_count:
 *                       type: integer
 *                     submissions_count:
 *                       type: integer
 *                     created_at:
 *                       type: string
 *                     updated_at:
 *                       type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Ongeldige student ID
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Student niet gevonden
 */
router.get('/admin/students/:studentId', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const studentId = parseInt(req.params.studentId);

  console.log(`[AUDIT] Admin ${adminId || 'unknown'} requested student ${studentId} at ${new Date().toISOString()}`);

  try {
    // Validatie: controleer student ID
    if (!studentId || isNaN(studentId)) {
      console.log(`[AUDIT] Invalid student ID: ${req.params.studentId}`);
      return res.status(400).json({
        success: false,
        message: 'Ongeldig student ID',
        error: 'BAD_REQUEST'
      });
    }

    // Autorisatie: controleer of gebruiker admin is
    if (!adminId) {
      console.log(`[AUDIT] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[AUDIT] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze data',
        error: 'FORBIDDEN'
      });
    }

    const student = await adminController.getStudentById(studentId);

    if (!student) {
      console.log(`[AUDIT] Student ${studentId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Student niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    console.log(`[AUDIT] Admin ${adminId} retrieved student ${studentId}`);

    res.status(200).json({
      success: true,
      data: student,
      message: 'Student succesvol opgehaald',
      error: null
    });
  } catch (error) {
    console.error(`[AUDIT] Admin ${adminId} failed to retrieve student ${studentId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen student',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/students/{studentId}:
 *   put:
 *     tags:
 *       - Admin - Students
 *     summary: Werk een studentaccount bij
 *     description: Wijzig gegevens van een studentaccount (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de student
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Nieuwe email van de student
 *               name:
 *                 type: string
 *                 description: Nieuwe naam van de student
 *               github_id:
 *                 type: string
 *                 description: Nieuwe GitHub ID van de student
 *     responses:
 *       200:
 *         description: Student succesvol bijgewerkt
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
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     github_id:
 *                       type: string
 *                     role:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                     updated_at:
 *                       type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Ongeldige input of geen velden om bij te werken
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Student niet gevonden
 *       409:
 *         description: Email al in gebruik door een andere gebruiker
 */
router.put('/admin/students/:studentId', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const studentId = parseInt(req.params.studentId);
  const { email, name, github_id } = req.body;

  console.log(`[AUDIT] Admin ${adminId || 'unknown'} attempting to update student ${studentId} at ${new Date().toISOString()}`);

  try {
    // Validatie: controleer student ID
    if (!studentId || isNaN(studentId)) {
      console.log(`[AUDIT] Invalid student ID: ${req.params.studentId}`);
      return res.status(400).json({
        success: false,
        message: 'Ongeldig student ID',
        error: 'BAD_REQUEST'
      });
    }

    // Autorisatie: controleer of gebruiker admin is
    if (!adminId) {
      console.log(`[AUDIT] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[AUDIT] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze functie',
        error: 'FORBIDDEN'
      });
    }

    // Validatie: controleer of er tenminste één veld is om bij te werken
    if (email === undefined && name === undefined && github_id === undefined) {
      console.log(`[AUDIT] No fields provided for update`);
      return res.status(400).json({
        success: false,
        message: 'Geen velden om bij te werken',
        error: 'BAD_REQUEST'
      });
    }

    // Validatie: controleer of student bestaat
    const existingStudent = await adminController.getStudentById(studentId);
    if (!existingStudent) {
      console.log(`[AUDIT] Student ${studentId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Student niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    // Validatie: controleer email format indien opgegeven
    if (email !== undefined && email !== null) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.log(`[AUDIT] Invalid email format: ${email}`);
        return res.status(400).json({
          success: false,
          message: 'Ongeldig email formaat',
          error: 'BAD_REQUEST'
        });
      }

      // Controleer of email al in gebruik is door een andere gebruiker
      const existingUser = await db.query(
        `SELECT id FROM "user" WHERE email = $1 AND id != $2`,
        [email, studentId]
      );

      if (existingUser.rows.length > 0) {
        console.log(`[AUDIT] Email ${email} already in use by another user`);
        return res.status(409).json({
          success: false,
          message: 'Email is al in gebruik door een andere gebruiker',
          error: 'CONFLICT'
        });
      }
    }

    // Validatie: controleer name indien opgegeven
    if (name !== undefined && name !== null && name.trim() === '') {
      console.log(`[AUDIT] Invalid name: empty string`);
      return res.status(400).json({
        success: false,
        message: 'Naam mag niet leeg zijn',
        error: 'BAD_REQUEST'
      });
    }

    const updatedStudent = await adminController.updateStudent(studentId, {
      email,
      name,
      github_id
    });

    if (!updatedStudent) {
      console.log(`[AUDIT] Failed to update student ${studentId}`);
      return res.status(500).json({
        success: false,
        message: 'Fout bij bijwerken student',
        error: 'INTERNAL_SERVER_ERROR'
      });
    }

    console.log(`[AUDIT] Admin ${adminId} successfully updated student ${studentId}`);

    res.status(200).json({
      success: true,
      data: updatedStudent,
      message: 'Student succesvol bijgewerkt',
      error: null
    });
  } catch (error) {
    console.error(`[AUDIT] Admin ${adminId} failed to update student ${studentId}:`, error);
    
    // Handle unique constraint violation
    if (error.code === '23505' && error.constraint === 'user_email_key') {
      return res.status(409).json({
        success: false,
        message: 'Email is al in gebruik',
        error: 'CONFLICT'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Fout bij bijwerken student',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/students/{studentId}:
 *   delete:
 *     tags:
 *       - Admin - Students
 *     summary: Verwijder een studentaccount
 *     description: Verwijder een studentaccount permanent uit het systeem (alleen voor admins). Let op - cascade delete voor enrollments en submissions.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de student
 *     responses:
 *       200:
 *         description: Student succesvol verwijderd
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
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Ongeldige student ID
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Student niet gevonden
 */
router.delete('/admin/students/:studentId', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const studentId = parseInt(req.params.studentId);

  console.log(`[AUDIT] Admin ${adminId || 'unknown'} attempting to delete student ${studentId} at ${new Date().toISOString()}`);

  try {
    // Validatie: controleer student ID
    if (!studentId || isNaN(studentId)) {
      console.log(`[AUDIT] Invalid student ID: ${req.params.studentId}`);
      return res.status(400).json({
        success: false,
        message: 'Ongeldig student ID',
        error: 'BAD_REQUEST'
      });
    }

    // Autorisatie: controleer of gebruiker admin is
    if (!adminId) {
      console.log(`[AUDIT] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[AUDIT] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze functie',
        error: 'FORBIDDEN'
      });
    }

    // Controleer of student bestaat voordat we verwijderen
    const existingStudent = await adminController.getStudentById(studentId);
    if (!existingStudent) {
      console.log(`[AUDIT] Student ${studentId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Student niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    const deletedStudent = await adminController.deleteStudent(studentId);

    if (!deletedStudent) {
      console.log(`[AUDIT] Failed to delete student ${studentId}`);
      return res.status(500).json({
        success: false,
        message: 'Fout bij verwijderen student',
        error: 'INTERNAL_SERVER_ERROR'
      });
    }

    console.log(`[AUDIT] Admin ${adminId} successfully deleted student ${studentId} (${deletedStudent.email})`);

    res.status(200).json({
      success: true,
      data: deletedStudent,
      message: 'Student succesvol verwijderd',
      error: null
    });
  } catch (error) {
    console.error(`[AUDIT] Admin ${adminId} failed to delete student ${studentId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Fout bij verwijderen student',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/students/{studentId}/courses:
 *   get:
 *     tags:
 *       - Admin - Students
 *     summary: Haal alle vakken op waarin een student is ingeschreven
 *     description: Verkrijg een lijst van alle vakken met enrollment informatie en statistieken voor een specifieke student (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de student
 *     responses:
 *       200:
 *         description: Lijst van vakken
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
 *                       enrolled_at:
 *                         type: string
 *                       assignment_count:
 *                         type: integer
 *                       submission_count:
 *                         type: integer
 *                       avg_ai_score:
 *                         type: number
 *                       avg_manual_score:
 *                         type: number
 *                 message:
 *                   type: string
 *       400:
 *         description: Ongeldige student ID
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Student niet gevonden
 */
router.get('/admin/students/:studentId/courses', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const studentId = parseInt(req.params.studentId);

  console.log(`[AUDIT] Admin ${adminId || 'unknown'} requested enrollments for student ${studentId} at ${new Date().toISOString()}`);

  try {
    // Validatie: controleer student ID
    if (!studentId || isNaN(studentId)) {
      console.log(`[AUDIT] Invalid student ID: ${req.params.studentId}`);
      return res.status(400).json({
        success: false,
        message: 'Ongeldig student ID',
        error: 'BAD_REQUEST'
      });
    }

    // Autorisatie: controleer of gebruiker admin is
    if (!adminId) {
      console.log(`[AUDIT] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[AUDIT] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze data',
        error: 'FORBIDDEN'
      });
    }

    // Controleer of student bestaat
    const student = await adminController.getStudentById(studentId);
    if (!student) {
      console.log(`[AUDIT] Student ${studentId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Student niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    const enrollments = await adminController.getStudentEnrollments(studentId);

    console.log(`[AUDIT] Admin ${adminId} retrieved ${enrollments.length} enrollments for student ${studentId}`);

    res.status(200).json({
      success: true,
      data: enrollments,
      message: `${enrollments.length} vak(ken) gevonden`,
      error: null
    });
  } catch (error) {
    console.error(`[AUDIT] Admin ${adminId} failed to retrieve enrollments for student ${studentId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen vakken',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/students/{studentId}/submissions:
 *   get:
 *     tags:
 *       - Admin - Students
 *     summary: Haal alle submissions van een student op
 *     description: Verkrijg een lijst van alle submissions met scores en feedback informatie voor een specifieke student (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de student
 *     responses:
 *       200:
 *         description: Lijst van submissions
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
 *                       github_url:
 *                         type: string
 *                       status:
 *                         type: string
 *                       ai_score:
 *                         type: integer
 *                       manual_score:
 *                         type: integer
 *                       assignment_title:
 *                         type: string
 *                       course_title:
 *                         type: string
 *                       feedback_count:
 *                         type: integer
 *                       created_at:
 *                         type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Ongeldige student ID
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Student niet gevonden
 */
router.get('/admin/students/:studentId/submissions', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const studentId = parseInt(req.params.studentId);

  console.log(`[AUDIT] Admin ${adminId || 'unknown'} requested submissions for student ${studentId} at ${new Date().toISOString()}`);

  try {
    // Validatie: controleer student ID
    if (!studentId || isNaN(studentId)) {
      console.log(`[AUDIT] Invalid student ID: ${req.params.studentId}`);
      return res.status(400).json({
        success: false,
        message: 'Ongeldig student ID',
        error: 'BAD_REQUEST'
      });
    }

    // Autorisatie: controleer of gebruiker admin is
    if (!adminId) {
      console.log(`[AUDIT] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[AUDIT] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze data',
        error: 'FORBIDDEN'
      });
    }

    // Controleer of student bestaat
    const student = await adminController.getStudentById(studentId);
    if (!student) {
      console.log(`[AUDIT] Student ${studentId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Student niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    const submissions = await adminController.getStudentSubmissions(studentId);

    console.log(`[AUDIT] Admin ${adminId} retrieved ${submissions.length} submissions for student ${studentId}`);

    res.status(200).json({
      success: true,
      data: submissions,
      message: `${submissions.length} submission(s) gevonden`,
      error: null
    });
  } catch (error) {
    console.error(`[AUDIT] Admin ${adminId} failed to retrieve submissions for student ${studentId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen submissions',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/admins:
 *   get:
 *     tags:
 *       - Admin - System
 *     summary: Haal alle admins op
 *     description: Verkrijg een lijst van alle geregistreerde admins (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lijst van admins
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
 *                     $ref: '#/components/schemas/User'
 *                 message:
 *                   type: string
 *       403:
 *         description: Geen admin rechten
 */
router.get('/admin/admins', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);

  console.log(`[API] Admin ${adminId || 'unknown'} requested all admins at ${new Date().toISOString()}`);

  try {
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze data',
        error: 'FORBIDDEN'
      });
    }

    const admins = await adminController.getAllAdmins();

    console.log(`[API] Admin ${adminId} retrieved ${admins.length} admins`);

    if (admins.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'Geen admins gevonden',
        error: null
      });
    }

    res.status(200).json({
      success: true,
      data: admins,
      message: `${admins.length} admins gevonden`,
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId} failed to retrieve admins`, error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen admins',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/teachers:
 *   get:
 *     tags:
 *       - Admin - Teachers
 *     summary: Haal alle docenten op
 *     description: Verkrijg een lijst van alle geregistreerde docenten (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lijst van docenten
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
 *                     $ref: '#/components/schemas/User'
 *                 message:
 *                   type: string
 *       403:
 *         description: Geen admin rechten
 */
router.get('/admin/teachers', authenticateToken, async (req, res) => {
  // Development: query param fallback, Productie: alleen req.user.id
  const adminId = req.user?.id || parseInt(req.query.adminId);

  // Audit log: request ontvangen
  console.log(`[API] Admin ${adminId || 'unknown'} requested all teachers at ${new Date().toISOString()}`);

  try {
    // Autorisatie: controleer of gebruiker admin is
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze data',
        error: 'FORBIDDEN'
      });
    }

    const teachers = await adminController.getAllTeachers();

    // Audit log: succesvolle request
    console.log(`[API] Admin ${adminId} retrieved ${teachers.length} teachers`);

    // Validatie: controleer of er docenten beschikbaar zijn
    if (teachers.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'Geen docenten gevonden',
        error: null
      });
    }

    res.status(200).json({
      success: true,
      data: teachers,
      message: `${teachers.length} docenten gevonden`,
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId} failed to retrieve teachers`, error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen docenten',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/teachers/{teacherId}/courses:
 *   get:
 *     tags:
 *       - Admin - Teachers
 *     summary: Haal alle vakken van een docent op
 *     description: Verkrijg een lijst van alle vakken waar een specifieke docent les aan geeft, inclusief student- en opdracht-aantallen (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teacherId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de docent
 *     responses:
 *       200:
 *         description: Lijst van vakken gekoppeld aan de docent
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
 *                     teacher:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *                     courses:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           title:
 *                             type: string
 *                           description:
 *                             type: string
 *                           join_code:
 *                             type: string
 *                           student_count:
 *                             type: integer
 *                           assignment_count:
 *                             type: integer
 *                           teacher_assigned_at:
 *                             type: string
 *                           created_at:
 *                             type: string
 *                           updated_at:
 *                             type: string
 *                 message:
 *                   type: string
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Docent niet gevonden
 */
router.get('/admin/teachers/:teacherId/courses', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const teacherId = parseInt(req.params.teacherId);

  // Audit log: request ontvangen
  console.log(`[API] Admin ${adminId || 'unknown'} requested courses for teacher ${teacherId} at ${new Date().toISOString()}`);

  try {
    // Autorisatie: controleer of gebruiker admin is
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze data',
        error: 'FORBIDDEN'
      });
    }

    // Validatie: controleer of de docent bestaat
    const teacher = await adminController.getUserById(teacherId);
    if (!teacher) {
      console.log(`[API] Teacher ${teacherId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Docent niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    // Validatie: controleer of de gebruiker daadwerkelijk een docent is
    if (teacher.role !== 'teacher') {
      console.log(`[API] User ${teacherId} is not a teacher (role: ${teacher.role})`);
      return res.status(400).json({
        success: false,
        message: `Gebruiker is geen docent (rol: ${teacher.role})`,
        error: 'INVALID_ROLE'
      });
    }

    // Haal vakken van de docent op
    const courses = await adminController.getTeacherCourses(teacherId);

    // Audit log: succesvolle request
    console.log(`[API] Admin ${adminId} retrieved ${courses.length} courses for teacher ${teacherId}`);

    // Validatie: controleer of er vakken beschikbaar zijn
    if (courses.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          teacher: {
            id: teacher.id,
            name: teacher.name,
            email: teacher.email
          },
          courses: []
        },
        message: 'Geen vakken gevonden voor deze docent',
        error: null
      });
    }

    res.status(200).json({
      success: true,
      data: {
        teacher: {
          id: teacher.id,
          name: teacher.name,
          email: teacher.email
        },
        courses: courses
      },
      message: `${courses.length} vakken gevonden voor docent ${teacher.name}`,
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId} failed to retrieve courses for teacher ${teacherId}:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen vakken voor docent',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/users/{userId}/role/teacher:
 *   put:
 *     tags:
 *       - Admin - Teachers
 *     summary: Wijzig gebruiker naar docent
 *     description: Wijzig de rol van een gebruiker naar 'teacher' vanuit elke andere rol (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de gebruiker
 *     responses:
 *       200:
 *         description: Gebruiker succesvol gewijzigd naar docent
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Gebruiker niet gevonden
 */
router.put('/admin/users/:userId/role/teacher', authenticateToken, async (req, res) => {
  const adminId = req.user?.id;
  const targetUserId = parseInt(req.params.userId);

  console.log(`[API] Admin ${adminId || 'unknown'} requested to change user ${targetUserId} to teacher at ${new Date().toISOString()}`);

  try {
    // Validatie: controleer admin ID
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID`);
      return res.status(401).json({
        success: false,
        message: 'Authenticatie vereist',
        error: 'UNAUTHORIZED'
      });
    }

    // Autorisatie: controleer of gebruiker admin is
    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins kunnen rollen wijzigen',
        error: 'FORBIDDEN'
      });
    }

    // Validatie: controleer of target user bestaat
    const targetUser = await adminController.getUserById(targetUserId);
    if (!targetUser) {
      console.log(`[API] User ${targetUserId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Gebruiker niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    // Validatie: voorkom dat admin zichzelf demoveert
    if (targetUser.role === 'admin' && adminId === targetUserId) {
      console.log(`[API] Admin ${adminId} attempted to demote themselves`);
      return res.status(400).json({
        success: false,
        message: 'Je kunt je eigen admin rol niet wijzigen',
        error: 'BAD_REQUEST'
      });
    }

    // Validatie: controleer of rol al correct is
    if (targetUser.role === 'teacher') {
      console.log(`[API] User ${targetUserId} already has teacher role`);
      return res.status(400).json({
        success: false,
        message: 'Gebruiker is al een docent',
        error: 'BAD_REQUEST'
      });
    }

    // Rol wijzigen
    const updatedUser = await adminController.changeUserRole(targetUserId, 'teacher');

    console.log(`[API] Admin ${adminId} changed user ${targetUserId} role from ${targetUser.role} to teacher`);

    res.status(200).json({
      success: true,
      data: updatedUser,
      message: 'Gebruiker is succesvol omgezet naar docent',
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId} failed to change user ${targetUserId} to teacher`, error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij wijzigen van gebruikersrol',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/users/{userId}/role/student:
 *   put:
 *     tags:
 *       - Admin - Students
 *     summary: Wijzig gebruiker naar student
 *     description: Wijzig de rol van een gebruiker naar 'student' vanuit elke andere rol (alleen voor admins). Admins kunnen zichzelf niet degraderen.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de gebruiker
 *     responses:
 *       200:
 *         description: Gebruiker succesvol gewijzigd naar student
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Gebruiker niet gevonden
 */
router.put('/admin/users/:userId/role/student', authenticateToken, async (req, res) => {
  const adminId = req.user?.id;
  const targetUserId = parseInt(req.params.userId);

  console.log(`[API] Admin ${adminId || 'unknown'} requested to change user ${targetUserId} to student at ${new Date().toISOString()}`);

  try {
    // Validatie: controleer admin ID
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID`);
      return res.status(401).json({
        success: false,
        message: 'Authenticatie vereist',
        error: 'UNAUTHORIZED'
      });
    }

    // Autorisatie: controleer of gebruiker admin is
    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins kunnen rollen wijzigen',
        error: 'FORBIDDEN'
      });
    }

    // Validatie: controleer of target user bestaat
    const targetUser = await adminController.getUserById(targetUserId);
    if (!targetUser) {
      console.log(`[API] User ${targetUserId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Gebruiker niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    // Validatie: voorkom dat admin zichzelf demoveert
    if (targetUser.role === 'admin' && adminId === targetUserId) {
      console.log(`[API] Admin ${adminId} attempted to demote themselves`);
      return res.status(400).json({
        success: false,
        message: 'Je kunt je eigen admin rol niet wijzigen',
        error: 'BAD_REQUEST'
      });
    }

    // Validatie: controleer of rol al correct is
    if (targetUser.role === 'student') {
      console.log(`[API] User ${targetUserId} already has student role`);
      return res.status(400).json({
        success: false,
        message: 'Gebruiker is al een student',
        error: 'BAD_REQUEST'
      });
    }

    // Rol wijzigen
    const updatedUser = await adminController.changeUserRole(targetUserId, 'student');

    console.log(`[API] Admin ${adminId} changed user ${targetUserId} role from ${targetUser.role} to student`);

    res.status(200).json({
      success: true,
      data: updatedUser,
      message: 'Gebruiker is succesvol omgezet naar student',
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId} failed to change user ${targetUserId} to student`, error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij wijzigen van gebruikersrol',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/users/{userId}/role/admin:
 *   put:
 *     tags:
 *       - Admin - System
 *     summary: Wijzig gebruiker naar admin
 *     description: Wijzig de rol van een gebruiker naar 'admin' vanuit elke andere rol (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de gebruiker
 *     responses:
 *       200:
 *         description: Gebruiker succesvol gewijzigd naar admin
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Gebruiker niet gevonden
 */
router.put('/admin/users/:userId/role/admin', authenticateToken, async (req, res) => {
  const adminId = req.user?.id;
  const targetUserId = parseInt(req.params.userId);

  console.log(`[API] Admin ${adminId || 'unknown'} requested to change user ${targetUserId} to admin at ${new Date().toISOString()}`);

  try {
    // Validatie: controleer admin ID
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID`);
      return res.status(401).json({
        success: false,
        message: 'Authenticatie vereist',
        error: 'UNAUTHORIZED'
      });
    }

    // Autorisatie: controleer of gebruiker admin is
    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins kunnen rollen wijzigen',
        error: 'FORBIDDEN'
      });
    }

    // Validatie: controleer of target user bestaat
    const targetUser = await adminController.getUserById(targetUserId);
    if (!targetUser) {
      console.log(`[API] User ${targetUserId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Gebruiker niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    // Validatie: controleer of gebruiker al admin is
    if (targetUser.role === 'admin') {
      console.log(`[API] User ${targetUserId} is already an admin`);
      return res.status(400).json({
        success: false,
        message: 'Gebruiker is al een admin',
        error: 'BAD_REQUEST'
      });
    }

    // Rol wijzigen
    const updatedUser = await adminController.changeUserRole(targetUserId, 'admin');

    console.log(`[API] Admin ${adminId} changed user ${targetUserId} role from ${targetUser.role} to admin`);

    res.status(200).json({
      success: true,
      data: updatedUser,
      message: 'Gebruiker is succesvol omgezet naar admin',
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId} failed to change user ${targetUserId} to admin`, error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij wijzigen van gebruikersrol',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/users/{userId}:
 *   delete:
 *     tags:
 *       - Admin - Users
 *     summary: Verwijder een gebruiker
 *     description: Verwijder een gebruikersaccount permanent uit het systeem (alleen voor admins). Let op - cascade delete voor alle gerelateerde gegevens zoals enrollments, submissions, courses (indien docent), etc.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de gebruiker
 *     responses:
 *       200:
 *         description: Gebruiker succesvol verwijderd
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
 *                     email:
 *                       type: string
 *                     name:
 *                       type: string
 *                     role:
 *                       type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Ongeldige gebruiker ID
 *       403:
 *         description: Geen admin rechten of poging om zichzelf te verwijderen
 *       404:
 *         description: Gebruiker niet gevonden
 */
router.delete('/admin/users/:userId', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const userId = parseInt(req.params.userId);

  console.log(`[AUDIT] Admin ${adminId || 'unknown'} attempting to delete user ${userId} at ${new Date().toISOString()}`);

  try {
    // Validatie: controleer gebruiker ID
    if (!userId || isNaN(userId)) {
      console.log(`[AUDIT] Invalid user ID: ${req.params.userId}`);
      return res.status(400).json({
        success: false,
        message: 'Ongeldig gebruiker ID',
        error: 'BAD_REQUEST'
      });
    }

    // Autorisatie: controleer of uitvoerende gebruiker admin is
    if (!adminId) {
      console.log(`[AUDIT] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[AUDIT] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins kunnen gebruikers verwijderen',
        error: 'FORBIDDEN'
      });
    }

    // Validatie: voorkom dat admin zichzelf verwijdert
    if (adminId === userId) {
      console.log(`[AUDIT] Admin ${adminId} attempted to delete themselves`);
      return res.status(403).json({
        success: false,
        message: 'Je kunt jezelf niet verwijderen',
        error: 'FORBIDDEN'
      });
    }

    // Validatie: controleer of gebruiker bestaat
    const user = await adminController.getUserById(userId);
    if (!user) {
      console.log(`[AUDIT] User ${userId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Gebruiker niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    // Gebruiker verwijderen (hard delete)
    const deletedUser = await adminController.deleteUser(userId);

    if (!deletedUser) {
      console.log(`[AUDIT] Failed to delete user ${userId}`);
      return res.status(500).json({
        success: false,
        message: 'Fout bij verwijderen gebruiker',
        error: 'INTERNAL_SERVER_ERROR'
      });
    }

    console.log(`[AUDIT] Admin ${adminId} successfully deleted user ${userId} (${deletedUser.email}, role: ${deletedUser.role})`);

    res.status(200).json({
      success: true,
      data: deletedUser,
      message: `Gebruiker ${deletedUser.name} (${deletedUser.role}) succesvol verwijderd`,
      error: null
    });
  } catch (error) {
    console.error(`[AUDIT] Admin ${adminId} failed to delete user ${userId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Fout bij verwijderen gebruiker',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/courses:
 *   get:
 *     tags:
 *       - Admin - Courses
 *     summary: Haal alle vakken op
 *     description: Verkrijg een lijst van alle vakken met basisinformatie (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lijst van vakken
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
 *                       join_code:
 *                         type: string
 *                       student_count:
 *                         type: integer
 *                       teacher_count:
 *                         type: integer
 *                       created_at:
 *                         type: string
 *                       updated_at:
 *                         type: string
 *       403:
 *         description: Geen admin rechten
 */
router.get('/admin/courses', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);

  console.log(`[API] Admin ${adminId || 'unknown'} requested all courses at ${new Date().toISOString()}`);

  try {
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze data',
        error: 'FORBIDDEN'
      });
    }

    const courses = await adminController.getAllCourses();

    console.log(`[API] Admin ${adminId} retrieved ${courses.length} courses`);

    if (courses.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'Geen vakken gevonden',
        error: null
      });
    }

    res.status(200).json({
      success: true,
      data: courses,
      message: `${courses.length} vakken gevonden`,
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId} failed to retrieve courses`, error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen vakken',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/courses:
 *   post:
 *     tags:
 *       - Admin - Courses
 *     summary: Maak een nieuw vak aan
 *     description: Creëer een nieuw vak in het systeem (alleen voor admins)
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
 *               - teacher_id
 *             properties:
 *               title:
 *                 type: string
 *                 description: Titel van het vak
 *                 example: "Web Development"
 *               description:
 *                 type: string
 *                 description: Beschrijving van het vak
 *                 example: "Introductie tot moderne webtechnologieën"
 *               join_code:
 *                 type: string
 *                 description: Join code voor het vak (optioneel, moet uniek zijn)
 *                 example: "WEB2024"
 *               teacher_id:
 *                 type: integer
 *                 description: ID van de docent die eigenaar wordt van het vak
 *                 example: 5
 *     responses:
 *       201:
 *         description: Vak succesvol aangemaakt
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
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     join_code:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                     updated_at:
 *                       type: string
 *                     teacher:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         name:
 *                           type: string
 *                         email:
 *                           type: string
 *       400:
 *         description: Ongeldige input of docent is geen teacher
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Docent niet gevonden
 *       409:
 *         description: Join code is al in gebruik
 */
router.post('/admin/courses', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const { title, description, join_code, teacher_id } = req.body;

  console.log(`[API] Admin ${adminId || 'unknown'} requested to create course at ${new Date().toISOString()}`);

  try {
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze functie',
        error: 'FORBIDDEN'
      });
    }

    // Validatie: title is verplicht
    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Titel is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    // Validatie: teacher_id is verplicht
    if (!teacher_id) {
      return res.status(400).json({
        success: false,
        message: 'Een docent (teacher_id) is verplicht bij het aanmaken van een vak',
        error: 'BAD_REQUEST'
      });
    }

    // Validatie: controleer of teacher bestaat en een docent is
    const teacher = await adminController.getUserById(teacher_id);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Docent niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    if (teacher.role !== 'teacher') {
      return res.status(400).json({
        success: false,
        message: `Gebruiker is geen docent (huidige rol: ${teacher.role})`,
        error: 'BAD_REQUEST'
      });
    }

    // Create het vak
    const newCourse = await adminController.createCourse({
      title: title.trim(),
      description,
      join_code
    });

    // Voeg docent toe aan het vak
    await adminController.addTeacherToCourse(newCourse.id, teacher_id);

    console.log(`[API] Admin ${adminId} created course ${newCourse.id}: ${newCourse.title} with teacher ${teacher.name}`);

    res.status(201).json({
      success: true,
      data: {
        ...newCourse,
        teacher: {
          id: teacher.id,
          name: teacher.name,
          email: teacher.email
        }
      },
      message: `Vak '${newCourse.title}' succesvol aangemaakt met docent '${teacher.name}'`,
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId} failed to create course`, error.message);
    
    // Check voor unique constraint violation (duplicate join_code)
    if (error.code === '23505' && error.constraint === 'course_join_code_key') {
      return res.status(409).json({
        success: false,
        message: 'Deze join code is al in gebruik door een ander vak',
        error: 'DUPLICATE_JOIN_CODE'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Fout bij aanmaken vak',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/courses/{courseId}:
 *   get:
 *     tags:
 *       - Admin - Courses
 *     summary: Haal gedetailleerde informatie van een vak op
 *     description: Verkrijg alle informatie van een vak inclusief eigenaren (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van het vak
 *     responses:
 *       200:
 *         description: Gedetailleerde informatie van het vak
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
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     join_code:
 *                       type: string
 *                     student_count:
 *                       type: integer
 *                     assignment_count:
 *                       type: integer
 *                     owners:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           email:
 *                             type: string
 *                           name:
 *                             type: string
 *                           role:
 *                             type: string
 *                           assigned_at:
 *                             type: string
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Vak niet gevonden
 */
router.get('/admin/courses/:courseId', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const courseId = parseInt(req.params.courseId);

  console.log(`[API] Admin ${adminId || 'unknown'} requested details for course ${courseId} at ${new Date().toISOString()}`);

  try {
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    if (!courseId || isNaN(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig vak ID',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze data',
        error: 'FORBIDDEN'
      });
    }

    const courseDetails = await adminController.getCourseDetails(courseId);

    if (!courseDetails) {
      console.log(`[API] Course ${courseId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Vak niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    console.log(`[API] Admin ${adminId} retrieved details for course ${courseId}`);

    res.status(200).json({
      success: true,
      data: courseDetails,
      message: 'Vak details succesvol opgehaald',
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId} failed to retrieve course ${courseId} details`, error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen vak details',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/courses/{courseId}:
 *   delete:
 *     tags:
 *       - Admin - Courses
 *     summary: Verwijder een vak
 *     description: Verwijdert een vak en alle gerelateerde data (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van het vak om te verwijderen
 *     responses:
 *       200:
 *         description: Vak succesvol verwijderd
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
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     join_code:
 *                       type: string
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Vak niet gevonden
 */
router.delete('/admin/courses/:courseId', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const courseId = parseInt(req.params.courseId);

  console.log(`[API] Admin ${adminId || 'unknown'} requested to delete course ${courseId} at ${new Date().toISOString()}`);

  try {
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    if (!courseId || isNaN(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig vak ID',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze functie',
        error: 'FORBIDDEN'
      });
    }

    const deletedCourse = await adminController.deleteCourse(courseId);

    if (!deletedCourse) {
      console.log(`[API] Course ${courseId} not found for deletion`);
      return res.status(404).json({
        success: false,
        message: 'Vak niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    console.log(`[API] Admin ${adminId} deleted course ${courseId}: ${deletedCourse.title}`);

    res.status(200).json({
      success: true,
      data: deletedCourse,
      message: `Vak '${deletedCourse.title}' succesvol verwijderd`,
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId} failed to delete course ${courseId}`, error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij verwijderen vak',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/courses/{courseId}:
 *   put:
 *     tags:
 *       - Admin - Courses
 *     summary: Wijzig vakgegevens
 *     description: Update de gegevens van een vak (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van het vak om te wijzigen
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: Nieuwe titel van het vak
 *                 example: "Web Development Advanced"
 *               description:
 *                 type: string
 *                 description: Nieuwe beschrijving van het vak
 *                 example: "Geavanceerde webtechnologieën"
 *               join_code:
 *                 type: string
 *                 description: Nieuwe join code voor het vak
 *                 example: "WEB2024"
 *     responses:
 *       200:
 *         description: Vak succesvol gewijzigd
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
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     join_code:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                     updated_at:
 *                       type: string
 *       400:
 *         description: Geen velden om te updaten of ongeldige data
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Vak niet gevonden
 *       409:
 *         description: Join code is al in gebruik
 */
router.put('/admin/courses/:courseId', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const courseId = parseInt(req.params.courseId);
  const { title, description, join_code } = req.body;

  console.log(`[API] Admin ${adminId || 'unknown'} requested to update course ${courseId} at ${new Date().toISOString()}`);

  try {
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    if (!courseId || isNaN(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig vak ID',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze functie',
        error: 'FORBIDDEN'
      });
    }

    // Validatie: minimaal één veld moet worden geüpdatet
    if (title === undefined && description === undefined && join_code === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Minimaal één veld (title, description, join_code) moet worden opgegeven',
        error: 'BAD_REQUEST'
      });
    }

    // Validatie: controleer of vak bestaat
    const existingCourse = await adminController.getCourseDetails(courseId);
    if (!existingCourse) {
      console.log(`[API] Course ${courseId} not found for update`);
      return res.status(404).json({
        success: false,
        message: 'Vak niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    // Update het vak
    const updatedCourse = await adminController.updateCourse(courseId, {
      title,
      description,
      join_code
    });

    if (!updatedCourse) {
      return res.status(500).json({
        success: false,
        message: 'Fout bij updaten vak',
        error: 'INTERNAL_SERVER_ERROR'
      });
    }

    console.log(`[API] Admin ${adminId} updated course ${courseId}: ${updatedCourse.title}`);

    res.status(200).json({
      success: true,
      data: updatedCourse,
      message: `Vak '${updatedCourse.title}' succesvol gewijzigd`,
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId} failed to update course ${courseId}`, error.message);
    
    // Check voor unique constraint violation (duplicate join_code)
    if (error.code === '23505' && error.constraint === 'course_join_code_key') {
      return res.status(409).json({
        success: false,
        message: 'Deze join code is al in gebruik door een ander vak',
        error: 'DUPLICATE_JOIN_CODE'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Fout bij wijzigen vak',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/courses/{courseId}/teachers/{teacherId}:
 *   post:
 *     tags:
 *       - Admin - Courses
 *     summary: Voeg docent toe aan vak
 *     description: Koppel een docent als eigenaar aan een vak (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van het vak
 *       - in: path
 *         name: teacherId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de docent om toe te voegen
 *     responses:
 *       201:
 *         description: Docent succesvol toegevoegd aan vak
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
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     course_title:
 *                       type: string
 *                     course_id:
 *                       type: integer
 *                 message:
 *                   type: string
 *       400:
 *         description: Docent is al gekoppeld aan dit vak of geen docent rol
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Vak of docent niet gevonden
 */
router.post('/admin/courses/:courseId/teachers/:teacherId', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const courseId = parseInt(req.params.courseId);
  const teacherId = parseInt(req.params.teacherId);

  console.log(`[API] Admin ${adminId || 'unknown'} requested to add teacher ${teacherId} to course ${courseId} at ${new Date().toISOString()}`);

  try {
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    if (!courseId || isNaN(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig vak ID',
        error: 'BAD_REQUEST'
      });
    }

    if (!teacherId || isNaN(teacherId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig docent ID',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze functie',
        error: 'FORBIDDEN'
      });
    }

    // Validatie: controleer of vak bestaat
    const course = await adminController.getCourseDetails(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Vak niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    // Validatie: controleer of gebruiker bestaat en een docent is
    const teacher = await adminController.getUserById(teacherId);
    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: 'Docent niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    if (teacher.role !== 'teacher') {
      return res.status(400).json({
        success: false,
        message: `Gebruiker is geen docent (huidige rol: ${teacher.role})`,
        error: 'BAD_REQUEST'
      });
    }

    // Voeg docent toe aan vak
    const result = await adminController.addTeacherToCourse(courseId, teacherId);

    if (result.exists) {
      console.log(`[API] Teacher ${teacherId} already assigned to course ${courseId}`);
      return res.status(400).json({
        success: false,
        message: 'Deze docent is al gekoppeld aan dit vak',
        error: 'ALREADY_EXISTS'
      });
    }

    console.log(`[API] Admin ${adminId} added teacher ${teacherId} (${result.name}) to course ${courseId} (${result.course_title})`);

    res.status(201).json({
      success: true,
      data: {
        id: result.id,
        name: result.name,
        email: result.email,
        course_title: result.course_title,
        course_id: result.course_id
      },
      message: `Docent '${result.name}' succesvol toegevoegd aan vak '${result.course_title}'`,
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId} failed to add teacher ${teacherId} to course ${courseId}`, error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij toevoegen docent aan vak',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/courses/{courseId}/teachers/{teacherId}:
 *   delete:
 *     tags:
 *       - Admin - Courses
 *     summary: Verwijder docent van vak
 *     description: Verwijdert een docent als eigenaar van een vak (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van het vak
 *       - in: path
 *         name: teacherId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de docent om te verwijderen
 *     responses:
 *       200:
 *         description: Docent succesvol verwijderd van het vak
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
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     course_title:
 *                       type: string
 *                 message:
 *                   type: string
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Vak, docent of relatie niet gevonden
 */
router.delete('/admin/courses/:courseId/teachers/:teacherId', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const courseId = parseInt(req.params.courseId);
  const teacherId = parseInt(req.params.teacherId);

  console.log(`[API] Admin ${adminId || 'unknown'} requested to remove teacher ${teacherId} from course ${courseId} at ${new Date().toISOString()}`);

  try {
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    if (!courseId || isNaN(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig vak ID',
        error: 'BAD_REQUEST'
      });
    }

    if (!teacherId || isNaN(teacherId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig docent ID',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze functie',
        error: 'FORBIDDEN'
      });
    }

    // Verwijder docent van vak
    const removedRelation = await adminController.removeTeacherFromCourse(courseId, teacherId);

    if (!removedRelation) {
      console.log(`[API] Teacher ${teacherId} is not assigned to course ${courseId}`);
      return res.status(404).json({
        success: false,
        message: 'Deze docent is niet gekoppeld aan dit vak',
        error: 'NOT_FOUND'
      });
    }

    console.log(`[API] Admin ${adminId} removed teacher ${teacherId} (${removedRelation.name}) from course ${courseId} (${removedRelation.course_title})`);

    res.status(200).json({
      success: true,
      data: {
        name: removedRelation.name,
        email: removedRelation.email,
        course_title: removedRelation.course_title
      },
      message: `Docent '${removedRelation.name}' succesvol verwijderd van vak '${removedRelation.course_title}'`,
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId} failed to remove teacher ${teacherId} from course ${courseId}`, error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij verwijderen docent van vak',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});











/**
 * @swagger
 * /api/admin/courses/{courseId}/students:
 *   get:
 *     tags:
 *       - Admin - Courses
 *     summary: Haal alle studenten van een vak op
 *     description: Verkrijg een lijst van alle ingeschreven studenten voor een vak (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van het vak
 *     responses:
 *       200:
 *         description: Lijst van ingeschreven studenten
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
 *                       email:
 *                         type: string
 *                       name:
 *                         type: string
 *                       enrolled_at:
 *                         type: string
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Vak niet gevonden
 */
router.get('/admin/courses/:courseId/students', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const courseId = parseInt(req.params.courseId);

  console.log(`[API] Admin ${adminId || 'unknown'} requested students for course ${courseId} at ${new Date().toISOString()}`);

  try {
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    if (!courseId || isNaN(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig vak ID',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze functie',
        error: 'FORBIDDEN'
      });
    }

    // Controleer of vak bestaat
    const course = await adminController.getCourseDetails(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Vak niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    const students = await adminController.getCourseStudents(courseId);

    console.log(`[API] Admin ${adminId} retrieved ${students.length} students for course ${courseId}`);

    res.status(200).json({
      success: true,
      data: students,
      message: `${students.length} studenten gevonden voor vak '${course.title}'`,
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId} failed to retrieve students for course ${courseId}`, error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen studenten',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/courses/{courseId}/students/{studentId}:
 *   post:
 *     tags:
 *       - Admin - Courses
 *     summary: Schrijf student in voor vak
 *     description: Schrijf een student handmatig in voor een vak (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van het vak
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de student
 *     responses:
 *       201:
 *         description: Student succesvol ingeschreven
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
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     course_title:
 *                       type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Student is al ingeschreven of geen student rol
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Vak of student niet gevonden
 */
router.post('/admin/courses/:courseId/students/:studentId', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const courseId = parseInt(req.params.courseId);
  const studentId = parseInt(req.params.studentId);

  console.log(`[API] Admin ${adminId || 'unknown'} requested to enroll student ${studentId} in course ${courseId} at ${new Date().toISOString()}`);

  try {
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    if (!courseId || isNaN(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig vak ID',
        error: 'BAD_REQUEST'
      });
    }

    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig student ID',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze functie',
        error: 'FORBIDDEN'
      });
    }

    // Controleer of vak bestaat
    const course = await adminController.getCourseDetails(courseId);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: 'Vak niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    // Controleer of gebruiker bestaat en een student is
    const student = await adminController.getUserById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    if (student.role !== 'student') {
      return res.status(400).json({
        success: false,
        message: `Gebruiker is geen student (huidige rol: ${student.role})`,
        error: 'BAD_REQUEST'
      });
    }

    // Schrijf student in
    const result = await adminController.enrollStudent(courseId, studentId);

    if (result.exists) {
      console.log(`[API] Student ${studentId} already enrolled in course ${courseId}`);
      return res.status(400).json({
        success: false,
        message: 'Deze student is al ingeschreven voor dit vak',
        error: 'ALREADY_EXISTS'
      });
    }

    console.log(`[API] Admin ${adminId} enrolled student ${studentId} (${result.name}) in course ${courseId} (${result.course_title})`);

    res.status(201).json({
      success: true,
      data: {
        id: result.id,
        name: result.name,
        email: result.email,
        course_title: result.course_title,
        course_id: result.course_id
      },
      message: `Student '${result.name}' succesvol ingeschreven voor vak '${result.course_title}'`,
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId} failed to enroll student ${studentId} in course ${courseId}`, error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij inschrijven student',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/courses/{courseId}/students/{studentId}:
 *   delete:
 *     tags:
 *       - Admin - Courses
 *     summary: Schrijf student uit van vak
 *     description: Schrijf een student uit van een vak (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van het vak
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van de student
 *     responses:
 *       200:
 *         description: Student succesvol uitgeschreven
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
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     course_title:
 *                       type: string
 *                 message:
 *                   type: string
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Student is niet ingeschreven voor dit vak
 */
router.delete('/admin/courses/:courseId/students/:studentId', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const courseId = parseInt(req.params.courseId);
  const studentId = parseInt(req.params.studentId);

  console.log(`[API] Admin ${adminId || 'unknown'} requested to unenroll student ${studentId} from course ${courseId} at ${new Date().toISOString()}`);

  try {
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    if (!courseId || isNaN(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig vak ID',
        error: 'BAD_REQUEST'
      });
    }

    if (!studentId || isNaN(studentId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig student ID',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze functie',
        error: 'FORBIDDEN'
      });
    }

    // Schrijf student uit
    const result = await adminController.unenrollStudent(courseId, studentId);

    if (!result) {
      console.log(`[API] Student ${studentId} not enrolled in course ${courseId}`);
      return res.status(404).json({
        success: false,
        message: 'Deze student is niet ingeschreven voor dit vak',
        error: 'NOT_FOUND'
      });
    }

    console.log(`[API] Admin ${adminId} unenrolled student ${studentId} (${result.name}) from course ${courseId} (${result.course_title})`);

    res.status(200).json({
      success: true,
      data: {
        name: result.name,
        email: result.email,
        course_title: result.course_title
      },
      message: `Student '${result.name}' succesvol uitgeschreven van vak '${result.course_title}'`,
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId} failed to unenroll student ${studentId} from course ${courseId}`, error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij uitschrijven student',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/courses/{courseId}/assignments:
 *   get:
 *     tags:
 *       - Admin - Courses
 *     summary: Haal alle opdrachten van een vak op
 *     description: Verkrijg een lijst van alle opdrachten voor een vak (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van het vak
 *     responses:
 *       200:
 *         description: Lijst van opdrachten
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
 *                       due_date:
 *                         type: string
 *                       submission_count:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                       updated_at:
 *                         type: string
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Vak niet gevonden
 */
/**
 * @swagger
 * /api/admin/assignments:
 *   get:
 *     tags:
 *       - Admin - Courses
 *     summary: Haal alle opdrachten op
 *     description: Verkrijg een lijst van alle opdrachten ongeacht vak, inclusief vakinformatie (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lijst van alle opdrachten met vakinformatie
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
 *                       due_date:
 *                         type: string
 *                         format: date-time
 *                       rubric:
 *                         type: string
 *                       ai_guidelines:
 *                         type: string
 *                       course_id:
 *                         type: integer
 *                       course_title:
 *                         type: string
 *                       course_description:
 *                         type: string
 *                       submission_count:
 *                         type: integer
 *                       enrolled_students_count:
 *                         type: integer
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *                 message:
 *                   type: string
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Geen opdrachten gevonden
 */
router.get('/admin/assignments', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);

  console.log(`[API] Admin ${adminId || 'unknown'} requested all assignments at ${new Date().toISOString()}`);

  try {
    // Validatie: controleer of admin ID aanwezig is
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    // Autorisatie: controleer of gebruiker admin is
    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze data',
        error: 'FORBIDDEN'
      });
    }

    // Haal alle opdrachten op
    const assignments = await adminController.getAllAssignments();

    // Audit log: succesvolle request
    console.log(`[API] Admin ${adminId} retrieved ${assignments.length} assignments`);

    // Validatie: controleer of er opdrachten bestaan
    if (assignments.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'Geen opdrachten gevonden',
        error: null
      });
    }

    res.status(200).json({
      success: true,
      data: assignments,
      message: `${assignments.length} opdrachten gevonden`,
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId || 'unknown'} failed to retrieve assignments:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen opdrachten',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/submissions:
 *   get:
 *     tags:
 *       - Admin - Courses
 *     summary: Haal alle ingediende opdrachten op
 *     description: Verkrijg een lijst van alle submissions ongeacht vak, inclusief vak-, opdracht- en studentinformatie (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lijst van alle submissions met metadata
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
 *                       github_url:
 *                         type: string
 *                       commit_sha:
 *                         type: string
 *                       status:
 *                         type: string
 *                       ai_score:
 *                         type: integer
 *                       manual_score:
 *                         type: integer
 *                       assignment_id:
 *                         type: integer
 *                       assignment_title:
 *                         type: string
 *                       assignment_description:
 *                         type: string
 *                       assignment_due_date:
 *                         type: string
 *                         format: date-time
 *                       course_id:
 *                         type: integer
 *                       course_title:
 *                         type: string
 *                       course_description:
 *                         type: string
 *                       student_id:
 *                         type: integer
 *                       student_name:
 *                         type: string
 *                       student_email:
 *                         type: string
 *                       feedback_count:
 *                         type: integer
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *                 message:
 *                   type: string
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Geen submissions gevonden
 */
router.get('/admin/submissions', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);

  console.log(`[API] Admin ${adminId || 'unknown'} requested all submissions at ${new Date().toISOString()}`);

  try {
    // Validatie: controleer of admin ID aanwezig is
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    // Autorisatie: controleer of gebruiker admin is
    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze data',
        error: 'FORBIDDEN'
      });
    }

    // Haal alle submissions op
    const submissions = await adminController.getAllSubmissions();

    // Audit log: succesvolle request
    console.log(`[API] Admin ${adminId} retrieved ${submissions.length} submissions`);

    // Validatie: controleer of er submissions bestaan
    if (submissions.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'Geen ingediende opdrachten gevonden',
        error: null
      });
    }

    res.status(200).json({
      success: true,
      data: submissions,
      message: `${submissions.length} ingediende opdrachten gevonden`,
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId || 'unknown'} failed to retrieve submissions:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen ingediende opdrachten',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/courses/{courseId}/submissions:
 *   get:
 *     tags:
 *       - Admin - Courses
 *     summary: Haal alle ingediende opdrachten van een specifiek vak op
 *     description: Verkrijg een lijst van alle submissions voor een specifiek vak, inclusief opdracht- en studentinformatie (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van het vak
 *     responses:
 *       200:
 *         description: Lijst van submissions voor het vak
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
 *                       github_url:
 *                         type: string
 *                       commit_sha:
 *                         type: string
 *                       status:
 *                         type: string
 *                       ai_score:
 *                         type: integer
 *                       manual_score:
 *                         type: integer
 *                       assignment_id:
 *                         type: integer
 *                       assignment_title:
 *                         type: string
 *                       assignment_description:
 *                         type: string
 *                       assignment_due_date:
 *                         type: string
 *                         format: date-time
 *                       student_id:
 *                         type: integer
 *                       student_name:
 *                         type: string
 *                       student_email:
 *                         type: string
 *                       feedback_count:
 *                         type: integer
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *                 message:
 *                   type: string
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Vak niet gevonden of geen submissions
 */
router.get('/admin/courses/:courseId/submissions', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const courseId = parseInt(req.params.courseId);

  console.log(`[API] Admin ${adminId || 'unknown'} requested submissions for course ${courseId} at ${new Date().toISOString()}`);

  try {
    // Validatie: controleer of admin ID en course ID aanwezig zijn
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    if (!courseId || isNaN(courseId)) {
      console.log(`[API] Request denied: invalid course ID`);
      return res.status(400).json({
        success: false,
        message: 'Geldig vak ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    // Autorisatie: controleer of gebruiker admin is
    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze data',
        error: 'FORBIDDEN'
      });
    }

    // Haal submissions voor dit vak op (inclusief validatie of vak bestaat)
    const submissions = await adminController.getSubmissionsByCourse(courseId);

    // Audit log: succesvolle request
    console.log(`[API] Admin ${adminId} retrieved ${submissions.length} submissions for course ${courseId}`);

    // Validatie: controleer of er submissions bestaan
    if (submissions.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'Geen ingediende opdrachten gevonden voor dit vak',
        error: null
      });
    }

    res.status(200).json({
      success: true,
      data: submissions,
      message: `${submissions.length} ingediende opdrachten gevonden voor dit vak`,
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId || 'unknown'} failed to retrieve submissions for course ${courseId}:`, error.message);
    
    // Specifieke error handling voor niet-bestaand vak
    if (error.message === 'COURSE_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Vak niet gevonden',
        error: 'COURSE_NOT_FOUND'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen ingediende opdrachten',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/courses/{courseId}/assignments:
 *   get:
 *     tags:
 *       - Admin - Courses
 *     summary: Haal alle opdrachten van een specifiek vak op
 *     description: Verkrijg een lijst van alle opdrachten voor een specifiek vak, inclusief vakinformatie en statistieken (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van het vak
 *     responses:
 *       200:
 *         description: Lijst van opdrachten voor het vak met vakinformatie
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
 *                         title:
 *                           type: string
 *                         description:
 *                           type: string
 *                         join_code:
 *                           type: string
 *                         student_count:
 *                           type: integer
 *                         assignment_count:
 *                           type: integer
 *                     assignments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           title:
 *                             type: string
 *                           description:
 *                             type: string
 *                           due_date:
 *                             type: string
 *                             format: date-time
 *                           submission_count:
 *                             type: integer
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                           updated_at:
 *                             type: string
 *                             format: date-time
 *                 message:
 *                   type: string
 *       400:
 *         description: Ongeldig vak ID
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Vak niet gevonden
 */
router.get('/admin/courses/:courseId/assignments', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const courseId = parseInt(req.params.courseId);

  console.log(`[API] Admin ${adminId || 'unknown'} requested assignments for course ${courseId} at ${new Date().toISOString()}`);

  try {
    // Validatie: controleer of admin ID aanwezig is
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    // Validatie: controleer of vak ID geldig is
    if (!courseId || isNaN(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig vak ID',
        error: 'BAD_REQUEST'
      });
    }

    // Autorisatie: controleer of gebruiker admin is
    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze functie',
        error: 'FORBIDDEN'
      });
    }

    // Validatie: controleer of vak bestaat
    const course = await adminController.getCourseDetails(courseId);
    if (!course) {
      console.log(`[API] Course ${courseId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Vak niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    // Haal opdrachten op voor dit vak
    const assignments = await adminController.getCourseAssignments(courseId);

    // Audit log: succesvolle request
    console.log(`[API] Admin ${adminId} retrieved ${assignments.length} assignments for course ${courseId} ('${course.title}')`);

    // Datastructuur: vak + opdrachten
    res.status(200).json({
      success: true,
      data: {
        course: {
          id: course.id,
          title: course.title,
          description: course.description,
          join_code: course.join_code,
          student_count: course.student_count,
          assignment_count: course.assignment_count
        },
        assignments: assignments
      },
      message: `${assignments.length} opdrachten gevonden voor vak '${course.title}'`,
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId} failed to retrieve assignments for course ${courseId}:`, error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen opdrachten',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/courses/{courseId}/assignments:
 *   post:
 *     tags:
 *       - Admin - Courses
 *     summary: Voeg een nieuwe opdracht toe aan een vak
 *     description: Maak een nieuwe opdracht aan en koppel deze aan het opgegeven vak (alleen voor admins)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID van het vak
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *             properties:
 *               title:
 *                 type: string
 *                 description: Titel van de opdracht
 *                 example: "REST API Implementatie"
 *               description:
 *                 type: string
 *                 description: Beschrijving van de opdracht
 *                 example: "Bouw een RESTful API met Node.js en Express"
 *               due_date:
 *                 type: string
 *                 format: date-time
 *                 description: Deadline voor de opdracht (optioneel)
 *                 example: "2025-12-31T23:59:59Z"
 *               rubric:
 *                 type: string
 *                 description: Beoordelingsrichtlijnen (optioneel)
 *                 example: "Code kwaliteit: 40%, Functionaliteit: 40%, Documentatie: 20%"
 *               ai_guidelines:
 *                 type: string
 *                 description: AI feedback richtlijnen (optioneel)
 *                 example: "Let op code style, error handling en API design"
 *     responses:
 *       201:
 *         description: Opdracht succesvol aangemaakt
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
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     course_id:
 *                       type: integer
 *                     due_date:
 *                       type: string
 *                       format: date-time
 *                     rubric:
 *                       type: string
 *                     ai_guidelines:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                 message:
 *                   type: string
 *       400:
 *         description: Ongeldige input (missing fields, invalid date)
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Vak niet gevonden
 */
router.post('/admin/courses/:courseId/assignments', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const courseId = parseInt(req.params.courseId);
  const { title, description, due_date, rubric, ai_guidelines } = req.body;

  console.log(`[API] Admin ${adminId || 'unknown'} creating assignment for course ${courseId} at ${new Date().toISOString()}`);

  try {
    // Validatie: controleer of admin ID aanwezig is
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    // Validatie: controleer of vak ID geldig is
    if (!courseId || isNaN(courseId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig vak ID',
        error: 'BAD_REQUEST'
      });
    }

    // Autorisatie: controleer of gebruiker admin is
    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze functie',
        error: 'FORBIDDEN'
      });
    }

    // Maak opdracht aan (inclusief validatie van vak en input)
    const newAssignment = await adminController.createAssignment(courseId, {
      title,
      description,
      due_date,
      rubric,
      ai_guidelines
    });

    // Audit log: succesvolle aanmaak
    console.log(`[API] Admin ${adminId} created assignment ${newAssignment.id} ('${newAssignment.title}') for course ${courseId}`);

    res.status(201).json({
      success: true,
      data: newAssignment,
      message: `Opdracht '${newAssignment.title}' succesvol aangemaakt`,
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId || 'unknown'} failed to create assignment for course ${courseId}:`, error.message);
    
    // Specifieke error handling
    if (error.message === 'COURSE_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Vak niet gevonden',
        error: 'COURSE_NOT_FOUND'
      });
    }

    if (error.message === 'TITLE_REQUIRED') {
      return res.status(400).json({
        success: false,
        message: 'Titel is verplicht',
        error: 'TITLE_REQUIRED'
      });
    }

    if (error.message === 'DESCRIPTION_REQUIRED') {
      return res.status(400).json({
        success: false,
        message: 'Beschrijving is verplicht',
        error: 'DESCRIPTION_REQUIRED'
      });
    }

    if (error.message === 'INVALID_DUE_DATE') {
      return res.status(400).json({
        success: false,
        message: 'Ongeldige deadline datum',
        error: 'INVALID_DUE_DATE'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Fout bij aanmaken opdracht',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/assignments/{assignmentId}:
 *   delete:
 *     tags:
 *       - Admin - Courses
 *     summary: Verwijder een opdracht
 *     description: Verwijdert een opdracht en alle gerelateerde data (alleen voor admins)
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
 *         description: Opdracht succesvol verwijderd
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
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     course_id:
 *                       type: integer
 *                     due_date:
 *                       type: string
 *                 message:
 *                   type: string
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Opdracht niet gevonden
 */
router.delete('/admin/assignments/:assignmentId', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const assignmentId = parseInt(req.params.assignmentId);

  console.log(`[API] Admin ${adminId || 'unknown'} requested to delete assignment ${assignmentId} at ${new Date().toISOString()}`);

  try {
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    if (!assignmentId || isNaN(assignmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig opdracht ID',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze functie',
        error: 'FORBIDDEN'
      });
    }

    // Verwijder assignment
    const deletedAssignment = await adminController.deleteAssignment(assignmentId);

    if (!deletedAssignment) {
      console.log(`[API] Assignment ${assignmentId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Opdracht niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    console.log(`[API] Admin ${adminId} deleted assignment ${assignmentId}: ${deletedAssignment.title}`);

    res.status(200).json({
      success: true,
      data: deletedAssignment,
      message: `Opdracht '${deletedAssignment.title}' succesvol verwijderd`,
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId} failed to delete assignment ${assignmentId}`, error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij verwijderen opdracht',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/assignments/{assignmentId}/settings:
 *   get:
 *     tags:
 *       - Admin - Assignments
 *     summary: Haal opdracht instellingen op
 *     description: Verkrijg de instellingen (rubric en AI guidelines) van een opdracht (alleen voor admins)
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
 *         description: Opdracht instellingen succesvol opgehaald
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Opdracht niet gevonden
 */
router.get('/admin/assignments/:assignmentId/settings', authenticateToken, async (req, res) => {
  const logger = require('../utils/logger');
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const assignmentId = parseInt(req.params.assignmentId);

  logger.info('Admin-AssignmentSettings', `Admin ${adminId || 'unknown'} requesting settings for assignment ${assignmentId}`);

  try {
    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    if (!assignmentId || isNaN(assignmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig opdracht ID',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze functie',
        error: 'FORBIDDEN'
      });
    }

    const settings = await adminController.getAssignmentSettings(assignmentId);

    if (!settings) {
      return res.status(404).json({
        success: false,
        message: 'Opdracht niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    logger.success('Admin-AssignmentSettings', `Retrieved settings for assignment ${assignmentId}`);

    res.status(200).json({
      success: true,
      data: settings,
      message: 'Opdracht instellingen succesvol opgehaald',
      error: null
    });
  } catch (error) {
    logger.error('Admin-AssignmentSettings', `Failed to retrieve settings for assignment ${assignmentId}`, error);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen opdracht instellingen',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/assignments/{assignmentId}/settings:
 *   put:
 *     tags:
 *       - Admin - Assignments
 *     summary: Update opdracht instellingen
 *     description: Werk de instellingen (rubric en AI guidelines) van een opdracht bij (alleen voor admins)
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
 *             properties:
 *               rubric:
 *                 type: string
 *                 description: Beoordelingsrubric voor de opdracht
 *               ai_guidelines:
 *                 type: string
 *                 description: AI feedback richtlijnen
 *     responses:
 *       200:
 *         description: Opdracht instellingen succesvol bijgewerkt
 *       400:
 *         description: Geen velden om te updaten of ongeldige data
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Opdracht niet gevonden
 */
router.put('/admin/assignments/:assignmentId/settings', authenticateToken, async (req, res) => {
  const logger = require('../utils/logger');
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const assignmentId = parseInt(req.params.assignmentId);
  const { rubric, ai_guidelines } = req.body;

  logger.info('Admin-AssignmentSettings', `Admin ${adminId || 'unknown'} updating settings for assignment ${assignmentId}`);

  try {
    if (!adminId) {
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    if (!assignmentId || isNaN(assignmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig opdracht ID',
        error: 'BAD_REQUEST'
      });
    }

    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze functie',
        error: 'FORBIDDEN'
      });
    }

    if (rubric === undefined && ai_guidelines === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Minimaal één veld (rubric, ai_guidelines) moet worden opgegeven',
        error: 'BAD_REQUEST'
      });
    }

    if (rubric !== undefined && rubric !== null && typeof rubric !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Rubric moet een string zijn',
        error: 'BAD_REQUEST'
      });
    }

    if (ai_guidelines !== undefined && ai_guidelines !== null && typeof ai_guidelines !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'AI guidelines moet een string zijn',
        error: 'BAD_REQUEST'
      });
    }

    const updatedSettings = await adminController.updateAssignmentSettings(assignmentId, {
      rubric,
      ai_guidelines
    });

    logger.success('Admin-AssignmentSettings', `Admin ${adminId} updated settings for assignment ${assignmentId}`);

    res.status(200).json({
      success: true,
      data: updatedSettings,
      message: 'Opdracht instellingen succesvol bijgewerkt',
      error: null
    });
  } catch (error) {
    if (error.message === 'ASSIGNMENT_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Opdracht niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    logger.error('Admin-AssignmentSettings', `Failed to update settings for assignment ${assignmentId}`, error);
    res.status(500).json({
      success: false,
      message: 'Fout bij bijwerken opdracht instellingen',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/assignments/{assignmentId}:
 *   put:
 *     tags:
 *       - Admin - Assignments
 *     summary: Update opdracht (alle velden)
 *     description: Werk alle velden van een opdracht bij inclusief title, description, due_date, rubric en ai_guidelines (alleen voor admins)
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
 *             properties:
 *               title:
 *                 type: string
 *                 description: Titel van de opdracht (max 255 karakters)
 *                 example: "REST API Implementatie - Updated"
 *               description:
 *                 type: string
 *                 description: Beschrijving van de opdracht
 *                 example: "Bouw een volledige RESTful API met authenticatie"
 *               due_date:
 *                 type: string
 *                 format: date-time
 *                 description: Deadline voor de opdracht (ISO 8601 formaat)
 *                 example: "2025-12-31T23:59:59Z"
 *               rubric:
 *                 type: string
 *                 description: Beoordelingsrubric voor de opdracht
 *                 example: "Code kwaliteit: 40%, Functionaliteit: 40%, Documentatie: 20%"
 *               ai_guidelines:
 *                 type: string
 *                 description: AI feedback richtlijnen
 *                 example: "Focus op API design, error handling en security"
 *     responses:
 *       200:
 *         description: Opdracht succesvol bijgewerkt
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
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     course_id:
 *                       type: integer
 *                     due_date:
 *                       type: string
 *                     rubric:
 *                       type: string
 *                     ai_guidelines:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                     updated_at:
 *                       type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Geen velden om te updaten of ongeldige data
 *       403:
 *         description: Geen admin rechten
 *       404:
 *         description: Opdracht niet gevonden
 */
router.put('/admin/assignments/:assignmentId', authenticateToken, async (req, res) => {
  const logger = require('../utils/logger');
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const assignmentId = parseInt(req.params.assignmentId);
  const { title, description, due_date, rubric, ai_guidelines } = req.body;

  console.log(`[API] Admin ${adminId || 'unknown'} updating assignment ${assignmentId} at ${new Date().toISOString()}`);

  try {
    // Validatie: controleer of admin ID aanwezig is
    if (!adminId) {
      console.log(`[API] Request denied: no admin ID provided`);
      return res.status(400).json({
        success: false,
        message: 'Admin ID is verplicht',
        error: 'BAD_REQUEST'
      });
    }

    // Validatie: controleer of opdracht ID geldig is
    if (!assignmentId || isNaN(assignmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Ongeldig opdracht ID',
        error: 'BAD_REQUEST'
      });
    }

    // Autorisatie: controleer of gebruiker admin is
    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[API] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze functie',
        error: 'FORBIDDEN'
      });
    }

    // Update de opdracht
    const updatedAssignment = await adminController.updateAssignment(assignmentId, {
      title,
      description,
      due_date,
      rubric,
      ai_guidelines
    });

    logger.success('Admin-Assignment', `Admin ${adminId} updated assignment ${assignmentId}`);

    res.status(200).json({
      success: true,
      data: updatedAssignment,
      message: 'Opdracht succesvol bijgewerkt',
      error: null
    });
  } catch (error) {
    if (error.message === 'ASSIGNMENT_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Opdracht niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    if (error.message === 'TITLE_EMPTY') {
      return res.status(400).json({
        success: false,
        message: 'Titel mag niet leeg zijn',
        error: 'TITLE_EMPTY'
      });
    }

    if (error.message === 'TITLE_TOO_LONG') {
      return res.status(400).json({
        success: false,
        message: 'Titel mag niet langer zijn dan 255 karakters',
        error: 'TITLE_TOO_LONG'
      });
    }

    if (error.message === 'INVALID_DUE_DATE') {
      return res.status(400).json({
        success: false,
        message: 'Ongeldige datum formaat voor deadline',
        error: 'INVALID_DUE_DATE'
      });
    }

    if (error.message === 'NO_FIELDS_TO_UPDATE') {
      return res.status(400).json({
        success: false,
        message: 'Minimaal één veld moet worden opgegeven om bij te werken',
        error: 'NO_FIELDS_TO_UPDATE'
      });
    }

    logger.error('Admin-Assignment', `Failed to update assignment ${assignmentId}`, error);
    res.status(500).json({
      success: false,
      message: 'Fout bij bijwerken opdracht',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

module.exports = router;