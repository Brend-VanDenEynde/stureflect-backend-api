const express = require('express');
const router = express.Router();
const { getEnrolledStudents, addStudentToCourse, removeStudentFromCourse } = require('../controllers/docentController');

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