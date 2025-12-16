const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authenticateToken = require('../middleware/authMiddleware');

/**
 * @swagger
 * /api/admin/students:
 *   get:
 *     tags:
 *       - Admin
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
  console.log(`[AUDIT] Admin ${adminId || 'unknown'} requested all students at ${new Date().toISOString()}`);

  try {
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

    const students = await adminController.getAllStudents();

    // Audit log: succesvolle request
    console.log(`[AUDIT] Admin ${adminId} retrieved ${students.length} students`);

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
    console.error(`[AUDIT] Admin ${adminId} failed to retrieve students:`, error);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen studenten',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/admins:
 *   get:
 *     tags:
 *       - Admin
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

  console.log(`[AUDIT] Admin ${adminId || 'unknown'} requested all admins at ${new Date().toISOString()}`);

  try {
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

    const admins = await adminController.getAllAdmins();

    console.log(`[AUDIT] Admin ${adminId} retrieved ${admins.length} admins`);

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
    console.error(`[AUDIT] Admin ${adminId} failed to retrieve admins:`, error);
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
 *       - Admin
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
  console.log(`[AUDIT] Admin ${adminId || 'unknown'} requested all teachers at ${new Date().toISOString()}`);

  try {
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

    const teachers = await adminController.getAllTeachers();

    // Audit log: succesvolle request
    console.log(`[AUDIT] Admin ${adminId} retrieved ${teachers.length} teachers`);

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
    console.error(`[AUDIT] Admin ${adminId} failed to retrieve teachers:`, error);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen docenten',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/users/{userId}/role/teacher:
 *   put:
 *     tags:
 *       - Admin
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

  console.log(`[AUDIT] Admin ${adminId || 'unknown'} requested to change user ${targetUserId} to teacher at ${new Date().toISOString()}`);

  try {
    // Validatie: controleer admin ID
    if (!adminId) {
      console.log(`[AUDIT] Request denied: no admin ID in token`);
      return res.status(401).json({
        success: false,
        message: 'Authenticatie vereist',
        error: 'UNAUTHORIZED'
      });
    }

    // Autorisatie: controleer of gebruiker admin is
    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[AUDIT] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins kunnen rollen wijzigen',
        error: 'FORBIDDEN'
      });
    }

    // Validatie: controleer of target user bestaat
    const targetUser = await adminController.getUserById(targetUserId);
    if (!targetUser) {
      console.log(`[AUDIT] User ${targetUserId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Gebruiker niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    // Validatie: voorkom dat admin zichzelf demoveert
    if (targetUser.role === 'admin' && adminId === targetUserId) {
      console.log(`[AUDIT] Admin ${adminId} attempted to demote themselves`);
      return res.status(400).json({
        success: false,
        message: 'Je kunt je eigen admin rol niet wijzigen',
        error: 'BAD_REQUEST'
      });
    }

    // Validatie: controleer of rol al correct is
    if (targetUser.role === 'teacher') {
      console.log(`[AUDIT] User ${targetUserId} already has teacher role`);
      return res.status(400).json({
        success: false,
        message: 'Gebruiker is al een docent',
        error: 'BAD_REQUEST'
      });
    }

    // Rol wijzigen
    const updatedUser = await adminController.changeUserRole(targetUserId, 'teacher');

    console.log(`[AUDIT] Admin ${adminId} changed user ${targetUserId} role from ${targetUser.role} to teacher`);

    res.status(200).json({
      success: true,
      data: updatedUser,
      message: 'Gebruiker is succesvol omgezet naar docent',
      error: null
    });
  } catch (error) {
    console.error(`[AUDIT] Admin ${adminId} failed to change user ${targetUserId} to teacher:`, error);
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
 *       - Admin
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

  console.log(`[AUDIT] Admin ${adminId || 'unknown'} requested to change user ${targetUserId} to student at ${new Date().toISOString()}`);

  try {
    // Validatie: controleer admin ID
    if (!adminId) {
      console.log(`[AUDIT] Request denied: no admin ID in token`);
      return res.status(401).json({
        success: false,
        message: 'Authenticatie vereist',
        error: 'UNAUTHORIZED'
      });
    }

    // Autorisatie: controleer of gebruiker admin is
    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[AUDIT] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins kunnen rollen wijzigen',
        error: 'FORBIDDEN'
      });
    }

    // Validatie: controleer of target user bestaat
    const targetUser = await adminController.getUserById(targetUserId);
    if (!targetUser) {
      console.log(`[AUDIT] User ${targetUserId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Gebruiker niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    // Validatie: voorkom dat admin zichzelf demoveert
    if (targetUser.role === 'admin' && adminId === targetUserId) {
      console.log(`[AUDIT] Admin ${adminId} attempted to demote themselves`);
      return res.status(400).json({
        success: false,
        message: 'Je kunt je eigen admin rol niet wijzigen',
        error: 'BAD_REQUEST'
      });
    }

    // Validatie: controleer of rol al correct is
    if (targetUser.role === 'student') {
      console.log(`[AUDIT] User ${targetUserId} already has student role`);
      return res.status(400).json({
        success: false,
        message: 'Gebruiker is al een student',
        error: 'BAD_REQUEST'
      });
    }

    // Rol wijzigen
    const updatedUser = await adminController.changeUserRole(targetUserId, 'student');

    console.log(`[AUDIT] Admin ${adminId} changed user ${targetUserId} role from ${targetUser.role} to student`);

    res.status(200).json({
      success: true,
      data: updatedUser,
      message: 'Gebruiker is succesvol omgezet naar student',
      error: null
    });
  } catch (error) {
    console.error(`[AUDIT] Admin ${adminId} failed to change user ${targetUserId} to student:`, error);
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
 *       - Admin
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

  console.log(`[AUDIT] Admin ${adminId || 'unknown'} requested to change user ${targetUserId} to admin at ${new Date().toISOString()}`);

  try {
    // Validatie: controleer admin ID
    if (!adminId) {
      console.log(`[AUDIT] Request denied: no admin ID in token`);
      return res.status(401).json({
        success: false,
        message: 'Authenticatie vereist',
        error: 'UNAUTHORIZED'
      });
    }

    // Autorisatie: controleer of gebruiker admin is
    const isAdmin = await adminController.isUserAdmin(adminId);
    if (!isAdmin) {
      console.log(`[AUDIT] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins kunnen rollen wijzigen',
        error: 'FORBIDDEN'
      });
    }

    // Validatie: controleer of target user bestaat
    const targetUser = await adminController.getUserById(targetUserId);
    if (!targetUser) {
      console.log(`[AUDIT] User ${targetUserId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Gebruiker niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    // Validatie: controleer of gebruiker al admin is
    if (targetUser.role === 'admin') {
      console.log(`[AUDIT] User ${targetUserId} is already an admin`);
      return res.status(400).json({
        success: false,
        message: 'Gebruiker is al een admin',
        error: 'BAD_REQUEST'
      });
    }

    // Rol wijzigen
    const updatedUser = await adminController.changeUserRole(targetUserId, 'admin');

    console.log(`[AUDIT] Admin ${adminId} changed user ${targetUserId} role from ${targetUser.role} to admin`);

    res.status(200).json({
      success: true,
      data: updatedUser,
      message: 'Gebruiker is succesvol omgezet naar admin',
      error: null
    });
  } catch (error) {
    console.error(`[AUDIT] Admin ${adminId} failed to change user ${targetUserId} to admin:`, error);
    res.status(500).json({
      success: false,
      message: 'Fout bij wijzigen van gebruikersrol',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/courses:
 *   get:
 *     tags:
 *       - Admin
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
 *                         type: string
 *                       teacher_count:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                       updated_at:
 *                         type: string
 *       403:
 *         description: Geen admin rechten
 */
router.get('/admin/courses', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);

  console.log(`[AUDIT] Admin ${adminId || 'unknown'} requested all courses at ${new Date().toISOString()}`);

  try {
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

    const courses = await adminController.getAllCourses();

    console.log(`[AUDIT] Admin ${adminId} retrieved ${courses.length} courses`);

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
    console.error(`[AUDIT] Admin ${adminId} failed to retrieve courses:`, error);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen vakken',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

/**
 * @swagger
 * /api/admin/courses/{courseId}:
 *   get:
 *     tags:
 *       - Admin
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

  console.log(`[AUDIT] Admin ${adminId || 'unknown'} requested details for course ${courseId} at ${new Date().toISOString()}`);

  try {
    if (!adminId) {
      console.log(`[AUDIT] Request denied: no admin ID provided`);
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
      console.log(`[AUDIT] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze data',
        error: 'FORBIDDEN'
      });
    }

    const courseDetails = await adminController.getCourseDetails(courseId);

    if (!courseDetails) {
      console.log(`[AUDIT] Course ${courseId} not found`);
      return res.status(404).json({
        success: false,
        message: 'Vak niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    console.log(`[AUDIT] Admin ${adminId} retrieved details for course ${courseId}`);

    res.status(200).json({
      success: true,
      data: courseDetails,
      message: 'Vak details succesvol opgehaald',
      error: null
    });
  } catch (error) {
    console.error(`[AUDIT] Admin ${adminId} failed to retrieve course ${courseId} details:`, error);
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
 *       - Admin
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

  console.log(`[AUDIT] Admin ${adminId || 'unknown'} requested to delete course ${courseId} at ${new Date().toISOString()}`);

  try {
    if (!adminId) {
      console.log(`[AUDIT] Request denied: no admin ID provided`);
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
      console.log(`[AUDIT] Access denied for user ${adminId}: not an admin`);
      return res.status(403).json({
        success: false,
        message: 'Alleen admins hebben toegang tot deze functie',
        error: 'FORBIDDEN'
      });
    }

    const deletedCourse = await adminController.deleteCourse(courseId);

    if (!deletedCourse) {
      console.log(`[AUDIT] Course ${courseId} not found for deletion`);
      return res.status(404).json({
        success: false,
        message: 'Vak niet gevonden',
        error: 'NOT_FOUND'
      });
    }

    console.log(`[AUDIT] Admin ${adminId} deleted course ${courseId}: ${deletedCourse.title}`);

    res.status(200).json({
      success: true,
      data: deletedCourse,
      message: `Vak '${deletedCourse.title}' succesvol verwijderd`,
      error: null
    });
  } catch (error) {
    console.error(`[AUDIT] Admin ${adminId} failed to delete course ${courseId}:`, error);
    res.status(500).json({
      success: false,
      message: 'Fout bij verwijderen vak',
      error: 'INTERNAL_SERVER_ERROR'
    });
  }
});

module.exports = router;
