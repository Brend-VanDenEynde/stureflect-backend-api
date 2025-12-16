const express = require('express');
const router = express.Router();
const {
	getEnrolledStudents,
	getStudentStatusByCourse,
	getStudentStatusForStudent,
	addStudentToCourse,
	removeStudentFromCourse
} = require('../controllers/docentController');

router.get('/courses/:courseId/students', getEnrolledStudents);
router.get('/courses/:courseId/student-status', getStudentStatusByCourse);
router.get('/courses/:courseId/students/:studentId/status', getStudentStatusForStudent);
router.post('/courses/:courseId/students', addStudentToCourse);
router.delete('/courses/:courseId/students/:studentId', removeStudentFromCourse);

module.exports = router;