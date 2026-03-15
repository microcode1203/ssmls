// @v2-fixed-imports
const express = require('express');
const router  = express.Router();
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { logAction } = require('../utils/audit');

router.use(authenticate);
router.use(authorize('admin'));

// GET preview — show what will be affected before committing
router.get('/preview', async (req, res) => {
  try {
    const [g11] = await pool.execute(
      `SELECT COUNT(*) as count FROM students s
       JOIN users u ON u.id=s.user_id
       WHERE s.grade_level='Grade 11' AND s.status='active' AND u.is_active=1`
    );
    const [g12] = await pool.execute(
      `SELECT COUNT(*) as count FROM students s
       JOIN users u ON u.id=s.user_id
       WHERE s.grade_level='Grade 12' AND s.status='active' AND u.is_active=1`
    );
    const [currentYear] = await pool.execute(
      `SELECT config_value FROM school_config WHERE config_key='school_year'`
    ).catch(() => [[{ config_value: '2025-2026' }]]);

    const schoolYear = currentYear[0]?.config_value || '2025-2026';
    const [startY, endY] = schoolYear.split('-').map(Number);
    const nextYear = `${endY}-${endY + 1}`;

    res.json({
      success: true,
      data: {
        currentYear: schoolYear,
        nextYear,
        grade11Count: Number(g11[0].count),
        grade12Count: Number(g12[0].count),
        willPromote:  Number(g11[0].count),
        willGraduate: Number(g12[0].count),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/promotion/promote — execute school year rollover
router.post('/promote', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Graduate all active Grade 12 students
    const [g12res] = await conn.execute(
      `UPDATE students SET status='graduated', section_id=NULL
       WHERE grade_level='Grade 12' AND status='active'`
    );

    // 2. Promote all active Grade 11 → Grade 12, clear section
    const [g11res] = await conn.execute(
      `UPDATE students SET grade_level='Grade 12', section_id=NULL
       WHERE grade_level='Grade 11' AND status='active'`
    );

    // 3. Archive all approved schedules (mark as archived)
    await conn.execute(
      `UPDATE schedules SET status='rejected' WHERE status='approved'`
    );

    // 4. Advance school year in config
    const [cfgRows] = await conn.execute(
      `SELECT config_value FROM school_config WHERE config_key='school_year'`
    ).catch(() => [[{ config_value: '2025-2026' }]]);

    const currentYear = cfgRows[0]?.config_value || '2025-2026';
    const [, endY] = currentYear.split('-').map(Number);
    const nextYear = `${endY}-${endY + 1}`;

    await conn.execute(
      `INSERT INTO school_config (config_key, config_value, updated_by)
       VALUES ('school_year', ?, ?)
       ON DUPLICATE KEY UPDATE config_value=?, updated_by=?`,
      [nextYear, req.user.id, nextYear, req.user.id]
    );

    // 5. Reset semester to 1st
    await conn.execute(
      `INSERT INTO school_config (config_key, config_value, updated_by)
       VALUES ('semester', '1st Semester', ?)
       ON DUPLICATE KEY UPDATE config_value='1st Semester', updated_by=?`,
      [req.user.id, req.user.id]
    );

    await conn.commit();

    await logAction(req.user.id, 'SCHOOL_YEAR_PROMOTION', 'students', null, {
      graduated: g12res.affectedRows,
      promoted:  g11res.affectedRows,
      newYear:   nextYear,
    }, req.ip);

    res.json({
      success: true,
      message: `School year advanced to ${nextYear}.`,
      data: {
        graduated: g12res.affectedRows,
        promoted:  g11res.affectedRows,
        newYear:   nextYear,
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error('Promotion error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
