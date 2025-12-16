const express = require('express');
const router = express.Router();
const { getAllCourses } = require('../controllers/courseController');

/**
 * @swagger
 * /api/courses:
 *   get:
 *     tags:
 *       - Cursussen
 *     summary: Haal alle cursussen op
 *     description: Verkrijg een lijst van alle beschikbare cursussen
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lijst van cursussen
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Course'
 *       401:
 *         description: Niet geauthenticeerd
 */
router.get('/', getAllCourses);

module.exports = router;
