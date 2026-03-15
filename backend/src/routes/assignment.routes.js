const express = require('express');
const router  = express.Router();
const { getAssignments, createAssignment, submitAssignment, gradeSubmission } = require('../controllers/main.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);
router.get('/',                          getAssignments);
router.post('/',                         authorize('teacher','admin'), createAssignment);
router.post('/submit',                   authorize('student'), submitAssignment);
router.patch('/submissions/:id/grade',   authorize('teacher','admin'), gradeSubmission);

// GET submissions for a specific assignment (teacher/admin)
router.get('/:id/submissions', authorize('teacher','admin'), async (req, res) => {
  try {
    const { pool } = require('../config/database');
    const [rows] = await pool.execute(
      `SELECT sub.id, sub.text_answer, sub.score, sub.feedback,
         sub.status, sub.submitted_at, sub.graded_at,
         sub.file_name, sub.file_type, sub.file_size, sub.file_data,
         u.first_name, u.last_name, st.lrn
       FROM submissions sub
       JOIN students st ON st.id = sub.student_id
       JOIN users u ON u.id = st.user_id
       WHERE sub.assignment_id = ?
       ORDER BY sub.submitted_at ASC`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE assignment (teacher/admin)
router.delete('/:id', authorize('teacher','admin'), async (req, res) => {
  try {
    const { pool } = require('../config/database');
    await pool.execute(`DELETE FROM submissions WHERE assignment_id = ?`, [req.params.id]);
    await pool.execute(`DELETE FROM assignments WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Assignment deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
