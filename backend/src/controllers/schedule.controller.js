const { pool } = require('../config/database');
const { logAction } = require('../utils/audit');

// Conflict detection algorithm
const checkConflict = async (teacherId, day, startTime, endTime, excludeId = null) => {
  let query = `
    SELECT id, day_of_week, start_time, end_time
    FROM schedules
    WHERE teacher_id = ?
      AND day_of_week = ?
      AND status != 'rejected'
      AND (
        (start_time < ? AND end_time > ?)
        OR (start_time >= ? AND start_time < ?)
      )
  `;
  const params = [teacherId, day, endTime, startTime, startTime, endTime];
  if (excludeId) { query += ` AND id != ?`; params.push(excludeId); }

  const [rows] = await pool.execute(query, params);
  return rows;
};

// POST /api/schedules
const createSchedule = async (req, res) => {
  try {
    const { subjectId, sectionId, room, dayOfWeek, startTime, endTime, schoolYear } = req.body;

    // Get teacher ID from user
    const [teacherRows] = await pool.execute(
      `SELECT id FROM teachers WHERE user_id = ?`, [req.user.id]
    );
    if (teacherRows.length === 0)
      return res.status(403).json({ success: false, message: 'Teacher profile not found.' });

    const teacherId = teacherRows[0].id;

    // Conflict detection
    const conflicts = await checkConflict(teacherId, dayOfWeek, startTime, endTime);
    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        message: '⚠️ Schedule Conflict Detected! You already have a class at this time.',
        conflicts: conflicts.map(c => ({
          day: c.day_of_week,
          start: c.start_time,
          end: c.end_time
        }))
      });
    }

    const status = req.user.role === 'admin' ? 'approved' : 'pending';
    const [result] = await pool.execute(
      `INSERT INTO schedules (teacher_id, subject_id, section_id, room, day_of_week, start_time, end_time, status, school_year)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [teacherId, subjectId, sectionId, room, dayOfWeek, startTime, endTime, status, schoolYear || '2025-2026']
    );

    await logAction(req.user.id, 'CREATE_SCHEDULE', 'schedules', result.insertId, req.body, req.ip);

    res.status(201).json({
      success: true,
      message: status === 'approved' ? 'Schedule created and approved.' : 'Schedule submitted for admin approval.',
      data: { id: result.insertId, status }
    });
  } catch (err) {
    console.error('Create schedule error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/schedules/teacher/:teacherId
const getTeacherSchedule = async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { schoolYear } = req.query;
    const [rows] = await pool.execute(
      `SELECT s.*, sub.name as subject_name, sub.code,
         sec.section_name, sec.grade_level, sec.strand,
         u.first_name, u.middle_name, u.last_name
       FROM schedules s
       JOIN subjects sub ON sub.id = s.subject_id
       JOIN sections sec ON sec.id = s.section_id
       JOIN teachers t ON t.id = s.teacher_id
       JOIN users u ON u.id = t.user_id
       WHERE s.teacher_id = ?
         ${schoolYear ? 'AND s.school_year = ?' : ''}
       ORDER BY FIELD(s.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'), s.start_time`,
      schoolYear ? [teacherId, schoolYear] : [teacherId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/schedules/section/:sectionId
const getSectionSchedule = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const [rows] = await pool.execute(
      `SELECT s.*, sub.name as subject_name, sub.code,
         u.first_name, u.middle_name, u.last_name
       FROM schedules s
       JOIN subjects sub ON sub.id = s.subject_id
       JOIN teachers t ON t.id = s.teacher_id
       JOIN users u ON u.id = t.user_id
       WHERE s.section_id = ? AND s.status = 'approved'
       ORDER BY FIELD(s.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday'), s.start_time`,
      [sectionId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/schedules/pending  (admin) — returns ALL schedules, not just pending
// GET /api/schedules/all  (admin — all schedules with filter)
const getAllSchedules = async (req, res) => {
  try {
    const { status, teacherId, sectionId } = req.query;
    let query = `
      SELECT s.*, sub.name as subject_name, sec.section_name, sec.grade_level,
        sec.strand, u.first_name, u.middle_name, u.last_name
      FROM schedules s
      JOIN subjects sub ON sub.id = s.subject_id
      JOIN sections sec ON sec.id = s.section_id
      JOIN teachers t ON t.id = s.teacher_id
      JOIN users u ON u.id = t.user_id
      WHERE 1=1`;
    const params = [];
    if (status)    { query += ` AND s.status = ?`;     params.push(status); }
    if (teacherId) { query += ` AND s.teacher_id = ?`; params.push(teacherId); }
    if (sectionId) { query += ` AND s.section_id = ?`; params.push(sectionId); }
    query += ` ORDER BY sec.grade_level, sec.section_name,
      FIELD(s.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'),
      s.start_time`;
    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getAllSchedules error:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

const getPendingSchedules = async (req, res) => {
  try {
    const { status } = req.query; // optional filter: pending | approved | rejected
    let query = `SELECT s.*, sub.name as subject_name, sec.section_name, sec.grade_level,
         sec.strand, u.first_name, u.middle_name, u.last_name
       FROM schedules s
       JOIN subjects sub ON sub.id = s.subject_id
       JOIN sections sec ON sec.id = s.section_id
       JOIN teachers t ON t.id = s.teacher_id
       JOIN users u ON u.id = t.user_id`;
    const params = [];
    if (status) {
      query += ` WHERE s.status = ?`;
      params.push(status);
    }
    query += ` ORDER BY
      CASE s.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
      FIELD(s.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'),
      s.start_time`;
    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/schedules/:id/approve  (admin)
const approveSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // 'approved' | 'rejected'
    await pool.execute(`UPDATE schedules SET status = ? WHERE id = ?`, [action, id]);
    await logAction(req.user.id, `SCHEDULE_${action.toUpperCase()}`, 'schedules', id, null, req.ip);
    res.json({ success: true, message: `Schedule ${action}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/schedules/:id
const deleteSchedule = async (req, res) => {
  try {
    await pool.execute(`DELETE FROM schedules WHERE id = ?`, [req.params.id]);
    res.json({ success: true, message: 'Schedule deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { createSchedule, getTeacherSchedule, getSectionSchedule, getPendingSchedules, getAllSchedules, approveSchedule, deleteSchedule };
