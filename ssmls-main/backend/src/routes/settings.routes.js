const express = require('express');
const router  = express.Router();
const {
  getProfile, changePassword, updateAvatar,
  updateStudentProfile, updateTeacherProfile
} = require('../controllers/settings.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/profile',                              getProfile);
router.put('/password',                             changePassword);
router.put('/avatar',                               updateAvatar);
router.put('/student-profile', authorize('student'), updateStudentProfile);
router.put('/teacher-profile', authorize('teacher'), updateTeacherProfile);

module.exports = router;
