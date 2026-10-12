// @v2-fixed-imports
const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);
router.use(authorize('admin'));

// POST /api/import/students — bulk create from parsed CSV rows
router.post('/students', async (req, res) => {
  const { students } = req.body;
  if (!Array.isArray(students) || !students.length)
    return res.status(400).json({ success: false, message: 'No student data provided.' });
  if (students.length > 200)
    return res.status(400).json({ success: false, message: 'Maximum 200 students per import.' });

  const results = { created: 0, skipped: 0, errors: [] };
  const hash = await bcrypt.hash('Student@2026', 12);

  for (let i = 0; i < students.length; i++) {
    const row = students[i];
    const rowNum = i + 2; // +2 because row 1 is header

    const firstName = String(row.first_name || row.firstName || '').trim();
    const lastName  = String(row.last_name  || row.lastName  || '').trim();
    const middleName = String(row.middle_name || row.middleName || '').trim() || null;
    const lrn       = String(row.lrn || '').trim();
    const email     = String(row.email || '').trim().toLowerCase();
    const gradeLevel = String(row.grade_level || row.gradeLevel || 'Grade 11').trim();
    const strand    = String(row.strand || 'STEM').trim().toUpperCase();
    const phone     = String(row.phone || '').trim() || null;

    // Validate required fields
    if (!firstName || !lastName) {
      results.errors.push({ row: rowNum, lrn, message: 'First name and last name are required.' });
      results.skipped++;
      continue;
    }
    if (!/^\d{12}$/.test(lrn)) {
      results.errors.push({ row: rowNum, lrn, message: 'LRN must be exactly 12 digits.' });
      results.skipped++;
      continue;
    }
    if (!email || !email.includes('@')) {
      results.errors.push({ row: rowNum, lrn, message: 'Valid email is required.' });
      results.skipped++;
      continue;
    }
    if (!['Grade 11','Grade 12'].includes(gradeLevel)) {
      results.errors.push({ row: rowNum, lrn, message: `Invalid grade level: "${gradeLevel}". Use "Grade 11" or "Grade 12".` });
      results.skipped++;
      continue;
    }
    if (!['STEM','HUMSS','ABM','TVL','GAS'].includes(strand)) {
      results.errors.push({ row: rowNum, lrn, message: `Invalid strand: "${strand}". Use STEM, HUMSS, ABM, TVL, or GAS.` });
      results.skipped++;
      continue;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Check duplicates
      const [emailCheck] = await conn.execute(
        `SELECT id FROM users WHERE email=? AND is_active=1`, [email]
      );
      if (emailCheck.length) {
        results.errors.push({ row: rowNum, lrn, message: `Email "${email}" already in use.` });
        results.skipped++;
        await conn.rollback();
        conn.release();
        continue;
      }

      const [lrnCheck] = await conn.execute(
        `SELECT s.id FROM students s JOIN users u ON u.id=s.user_id WHERE s.lrn=? AND u.is_active=1`, [lrn]
      );
      if (lrnCheck.length) {
        results.errors.push({ row: rowNum, lrn, message: `LRN "${lrn}" already registered.` });
        results.skipped++;
        await conn.rollback();
        conn.release();
        continue;
      }

      const [userRes] = await conn.execute(
        `INSERT INTO users (first_name, middle_name, last_name, email, password_hash, role)
         VALUES (?,?,?,?,?,'student')`,
        [firstName, middleName, lastName, email, hash]
      );

      await conn.execute(
        `INSERT INTO students (user_id, lrn, grade_level, strand, phone)
         VALUES (?,?,?,?,?)`,
        [userRes.insertId, lrn, gradeLevel, strand, phone]
      );

      await conn.commit();
      results.created++;
    } catch (err) {
      await conn.rollback();
      results.errors.push({ row: rowNum, lrn, message: err.message?.slice(0,80) || 'Insert failed.' });
      results.skipped++;
    } finally {
      conn.release();
    }
  }

  res.json({
    success: true,
    message: `Import complete: ${results.created} created, ${results.skipped} skipped.`,
    results,
  });
});

module.exports = router;
