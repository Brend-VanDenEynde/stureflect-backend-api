const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authenticateToken = require('../middleware/authMiddleware');

/**
 * @swagger
 * /api/admin/students:
 *   get:
 *     tags:
 *       - Admin - Users
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
 * /api/admin/admins:
 *   get:
 *     tags:
 *       - Admin - Users
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
 *       - Admin - Users
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
 * /api/admin/users/{userId}/role/teacher:
 *   put:
 *     tags:
 *       - Admin - Users
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
 *       - Admin - Users
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
 *       - Admin - Users
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
router.get('/admin/courses/:courseId/assignments', authenticateToken, async (req, res) => {
  const adminId = req.user?.id || parseInt(req.query.adminId);
  const courseId = parseInt(req.params.courseId);

  console.log(`[API] Admin ${adminId || 'unknown'} requested assignments for course ${courseId} at ${new Date().toISOString()}`);

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

    const assignments = await adminController.getCourseAssignments(courseId);

    console.log(`[API] Admin ${adminId} retrieved ${assignments.length} assignments for course ${courseId}`);

    res.status(200).json({
      success: true,
      data: assignments,
      message: `${assignments.length} opdrachten gevonden voor vak '${course.title}'`,
      error: null
    });
  } catch (error) {
    console.error(`[API] Admin ${adminId} failed to retrieve assignments for course ${courseId}`, error.message);
    res.status(500).json({
      success: false,
      message: 'Fout bij ophalen opdrachten',
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

module.exports = router;




