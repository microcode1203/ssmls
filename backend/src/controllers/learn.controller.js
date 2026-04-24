// learn.controller.js
const { pool } = require('../config/database');

// Ensure learn_content table exists
const ensureTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS learn_content (
      id SERIAL PRIMARY KEY,
      type VARCHAR(20) NOT NULL DEFAULT 'quiz',
      title VARCHAR(200) NOT NULL,
      description TEXT,
      schedule_id INT NULL REFERENCES schedules(id) ON DELETE SET NULL,
      questions JSONB DEFAULT '[]',
      video_url VARCHAR(500),
      content TEXT,
      time_limit INT DEFAULT 30,
      is_published BOOLEAN DEFAULT FALSE,
      allow_retake BOOLEAN DEFAULT TRUE,
      play_count INT DEFAULT 0,
      created_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
};
ensureTable().catch(err => console.warn('learn_content table warning:', err.message));

// GET /api/learn/content
const getContent = async (req, res) => {
  try {
    const { role, id: userId } = req.user;

    let query, params = [];

    if (role === 'student') {
      // Students see published content assigned to their section
      const { rows: sRows } = await pool.query(
        `SELECT section_id FROM students WHERE user_id = $1`, [userId]
      );
      const sectionId = sRows[0]?.section_id;

      query = `
        SELECT lc.*, 
          u.first_name, u.last_name,
          sub.name as subject_name,
          sec.section_name, sec.grade_level
        FROM learn_content lc
        LEFT JOIN users u ON u.id = lc.created_by
        LEFT JOIN schedules sc ON sc.id = lc.schedule_id
        LEFT JOIN subjects sub ON sub.id = sc.subject_id
        LEFT JOIN sections sec ON sec.id = sc.section_id
        WHERE lc.is_published = TRUE
          AND (lc.schedule_id IS NULL OR sc.section_id = $1)
        ORDER BY lc.created_at DESC
      `;
      params = [sectionId];

    } else if (role === 'teacher') {
      // Teachers see all their own content
      query = `
        SELECT lc.*,
          u.first_name, u.last_name,
          sub.name as subject_name,
          sec.section_name, sec.grade_level
        FROM learn_content lc
        LEFT JOIN users u ON u.id = lc.created_by
        LEFT JOIN schedules sc ON sc.id = lc.schedule_id
        LEFT JOIN subjects sub ON sub.id = sc.subject_id
        LEFT JOIN sections sec ON sec.id = sc.section_id
        WHERE lc.created_by = $1
        ORDER BY lc.created_at DESC
      `;
      params = [userId];

    } else {
      // Admin sees everything
      query = `
        SELECT lc.*,
          u.first_name, u.last_name,
          sub.name as subject_name,
          sec.section_name, sec.grade_level
        FROM learn_content lc
        LEFT JOIN users u ON u.id = lc.created_by
        LEFT JOIN schedules sc ON sc.id = lc.schedule_id
        LEFT JOIN subjects sub ON sub.id = sc.subject_id
        LEFT JOIN sections sec ON sec.id = sc.section_id
        ORDER BY lc.created_at DESC
      `;
    }

    const { rows } = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('getContent error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/learn/content
const createContent = async (req, res) => {
  try {
    const { type, title, description, scheduleId, questions, videoUrl, content, timeLimit, isPublished, allowRetake } = req.body;

    if (!title?.trim())
      return res.status(400).json({ success: false, message: 'Title is required.' });

    const { rows } = await pool.query(
      `INSERT INTO learn_content
        (type, title, description, schedule_id, questions, video_url, content, time_limit, is_published, allow_retake, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        type || 'quiz',
        title.trim(),
        description || null,
        scheduleId || null,
        JSON.stringify(questions || []),
        videoUrl || null,
        content || null,
        timeLimit || 30,
        isPublished || false,
        allowRetake !== false,
        req.user.id,
      ]
    );

    res.status(201).json({ success: true, message: 'Content created.', data: { id: rows[0].id } });
  } catch (err) {
    console.error('createContent error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/learn/content/:id
const deleteContent = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`DELETE FROM learn_content WHERE id = $1 AND created_by = $2`, [id, req.user.id]);
    res.json({ success: true, message: 'Content deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/learn/content/:id/complete
const completeContent = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query(`UPDATE learn_content SET play_count = play_count + 1 WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/learn/schedules — teacher's sections for the class selector
const getMySchedules = async (req, res) => {
  try {
    const { role, id: userId } = req.user;

    let rows;

    if (role === 'admin') {
      // Admin sees all approved schedules
      const result = await pool.query(`
        SELECT sc.id, sc.day_of_week, sc.start_time, sc.end_time,
          sub.name as subject_name,
          sec.section_name, sec.grade_level, sec.strand, sec.id as section_id
        FROM schedules sc
        JOIN subjects sub ON sub.id = sc.subject_id
        JOIN sections sec ON sec.id = sc.section_id
        WHERE sc.status = 'approved'
        ORDER BY sec.grade_level, sec.section_name, sub.name
      `);
      rows = result.rows;
    } else {
      // Teacher sees only their schedules
      const result = await pool.query(`
        SELECT sc.id, sc.day_of_week, sc.start_time, sc.end_time,
          sub.name as subject_name,
          sec.section_name, sec.grade_level, sec.strand, sec.id as section_id
        FROM schedules sc
        JOIN subjects sub ON sub.id = sc.subject_id
        JOIN sections sec ON sec.id = sc.section_id
        JOIN teachers t ON t.id = sc.teacher_id
        WHERE sc.status = 'approved' AND t.user_id = $1
        ORDER BY sec.grade_level, sec.section_name, sub.name
      `, [userId]);
      rows = result.rows;
    }

    // Deduplicate by subject + section
    const seen = new Set();
    const unique = rows.filter(s => {
      const key = `${s.subject_name}_${s.section_id}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    res.json({ success: true, data: unique });
  } catch (err) {
    console.error('getMySchedules error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getContent, createContent, deleteContent, completeContent, getMySchedules };
