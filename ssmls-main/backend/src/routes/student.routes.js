const express = require('express');
const router = express.Router();
const { getAllStudents, getStudent, createStudent, updateStudent, deleteStudent, resetStudentPassword } = require('../controllers/student.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/',       authorize('admin', 'teacher'), getAllStudents);
router.get('/:id',    authorize('admin', 'teacher', 'student'), getStudent);
router.post('/',      authorize('admin'), createStudent);
router.put('/:id',    authorize('admin'), updateStudent);
router.delete('/:id',                    authorize('admin'), deleteStudent);
router.post('/:id/reset-password',       authorize('admin'), resetStudentPassword);

module.exports = router;
