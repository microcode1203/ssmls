const express = require('express');
const router = express.Router();
const { getAllStudents, getStudent, createStudent, updateStudent, deleteStudent } = require('../controllers/student.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/',       authorize('admin', 'teacher'), getAllStudents);
router.get('/:id',    authorize('admin', 'teacher', 'student'), getStudent);
router.post('/',      authorize('admin'), createStudent);
router.put('/:id',    authorize('admin'), updateStudent);
router.delete('/:id', authorize('admin'), deleteStudent);

module.exports = router;
