const { pool } = require('../config/database');
const { logAction } = require('../utils/audit');

// Conflict detection
const checkConflict = async (teacherId, day, startTime, endTime, excludeId = null) => {
  let query = `
    SELECT id, day_of_week, start_time, end_time
    FROM schedules
    WHERE teacher_id = $1
      AND day_of_week = $2
      AND status != 'rejected'
      AND (
        (start_time < $3 AND end_time > $4)
        OR (start_time >= $5 AND start_time < $6)
      )
  `;
  const params = [teacherId, day, endTime, startTime, startTime, endTime];
  if (excludeId) { query += ` AND id != $7`; params.push(excludeId); }
  const { rows } = await pool.query(query, params);
  return rows;
};

// POST /api/schedules
const createSchedule = async (req, res) => {
  try {
    const { subjectId, sectionId, room, dayOfWeek, startTime, endTime, schoolYear } = req.body;

    const { rows: teacherRows } = await pool.query(
      `SELECT id FROM teachers WHERE user_id = $1`, [req.user.id]
    );
    if (teacherRows.length === 0)
      return res.status(403).json({ success: false, message: 'Teacher profile not found.' });

    const teacherId = teacherRows[0].id;

    const conflicts = await checkConflict(teacherId, dayOfWeek, startTime, endTime);
    if (conflicts.length > 0) {
      return res.status(409).json({
        success: false,
        message: '⚠️ Schedule Conflict Detected! You already have a class at this time.',
        conflicts: conflicts.map(c => ({ day: c.day_of_week, start: c.start_time, end: c.end_time }))
      });
    }

    const status = req.user.role === 'admin' ? 'approved' : 'pending';
    const { rows: result } = await pool.query(
      `INSERT INTO schedules (teacher_id, subject_id, section_id, room, day_of_week, start_time, end_time, status, school_year)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [teacherId, subjectId, sectionId, room, dayOfWeek, startTime, endTime, status, schoolYear || '2025-2026']
    );

    await logAction(req.user.id, 'CREATE_SCHEDULE', 'schedules', result[0].id, req.body, req.ip);
    res.status(201).json({
      success: true,
      message: status === 'approved' ? 'Schedule created and approved.' : 'Schedule submitted for admin approval.',
      data: { id: result[0].id, status }
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
    const params = [teacherId];
    let extra = '';
    if (schoolYear) { extra = ` AND s.school_year = $2`; params.push(schoolYear); }

    const { rows } = await pool.query(
      `SELECT s.*, sub.name as subject_name, sub.code,
         sec.section_name, sec.grade_level, sec.strand,
         u.first_name, u.middle_name, u.last_name
       FROM schedules s
       JOIN subjects sub ON sub.id = s.subject_id
       JOIN sections sec ON sec.id = s.section_id
       JOIN teachers t ON t.id = s.teacher_id
       JOIN users u ON u.id = t.user_id
       WHERE s.teacher_id = $1 ${extra}
       ORDER BY
         CASE s.day_of_week
           WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
           WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6
         END, s.start_time`,
      params
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
    const { rows } = await pool.query(
      `SELECT s.*, sub.name as subject_name, sub.code,
         u.first_name, u.middle_name, u.last_name
       FROM schedules s
       JOIN subjects sub ON sub.id = s.subject_id
       JOIN teachers t ON t.id = s.teacher_id
       JOIN users u ON u.id = t.user_id
       WHERE s.section_id = $1 AND s.status = 'approved'
       ORDER BY
         CASE s.day_of_week
           WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
           WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5
         END, s.start_time`,
      [sectionId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/schedules/pending
const getPendingSchedules = async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let where = '';
    if (status) { where = ` WHERE s.status = $1`; params.push(status); }

    const { rows } = await pool.query(
      `SELECT s.*, sub.name as subject_name, sec.section_name, sec.grade_level,
         sec.strand, u.first_name, u.middle_name, u.last_name
       FROM schedules s
       JOIN subjects sub ON sub.id = s.subject_id
       JOIN sections sec ON sec.id = s.section_id
       JOIN teachers t ON t.id = s.teacher_id
       JOIN users u ON u.id = t.user_id
       ${where}
       ORDER BY
         CASE s.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
         CASE s.day_of_week
           WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
           WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6
         END, s.start_time`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// GET /api/schedules/all
const getAllSchedules = async (req, res) => {
  try {
    const { status, teacherId, sectionId } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (status)    { params.push(status);    where += ` AND s.status = $${params.length}`; }
    if (teacherId) { params.push(teacherId); where += ` AND s.teacher_id = $${params.length}`; }
    if (sectionId) { params.push(sectionId); where += ` AND s.section_id = $${params.length}`; }

    const { rows } = await pool.query(
      `SELECT s.*, sub.name as subject_name, sec.section_name, sec.grade_level,
         sec.strand, u.first_name, u.middle_name, u.last_name
       FROM schedules s
       JOIN subjects sub ON sub.id = s.subject_id
       JOIN sections sec ON sec.id = s.section_id
       JOIN teachers t ON t.id = s.teacher_id
       JOIN users u ON u.id = t.user_id
       ${where}
       ORDER BY sec.grade_level, sec.section_name,
         CASE s.day_of_week
           WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
           WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6
         END, s.start_time`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getAllSchedules error:', err.message);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/schedules/:id/approve
const approveSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    await pool.query(`UPDATE schedules SET status = $1 WHERE id = $2`, [action, id]);
    await logAction(req.user.id, `SCHEDULE_${action.toUpperCase()}`, 'schedules', id, null, req.ip);
    res.json({ success: true, message: `Schedule ${action}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// DELETE /api/schedules/:id
const deleteSchedule = async (req, res) => {
  try {
    await pool.query(`DELETE FROM schedules WHERE id = $1`, [req.params.id]);
    res.json({ success: true, message: 'Schedule deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { createSchedule, getTeacherSchedule, getSectionSchedule, getPendingSchedules, getAllSchedules, approveSchedule, deleteSchedule };
