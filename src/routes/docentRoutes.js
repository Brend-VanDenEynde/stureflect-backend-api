const express = require('express');
const router = express.Router();
const { getEnrolledStudents, addStudentToCourse, removeStudentFromCourse } = require('../controllers/docentController');

router.get('/courses/:courseId/students', getEnrolledStudents);
router.post('/courses/:courseId/students', addStudentToCourse);
router.delete('/courses/:courseId/students/:studentId', removeStudentFromCourse);

module.exports = router;