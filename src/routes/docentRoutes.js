const express = require('express');
const router = express.Router();
const { getEnrolledStudents } = require('../controllers/docentController');

router.get('/courses/:courseId/students', getEnrolledStudents);

module.exports = router;