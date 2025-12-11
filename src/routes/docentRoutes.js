const express = require('express');
const router = express.Router();
const { getEnrolledStudents, addStudentToCourse } = require('../controllers/docentController');

router.get('/courses/:courseId/students', getEnrolledStudents);
router.post('/courses/:courseId/students', addStudentToCourse);

module.exports = router;