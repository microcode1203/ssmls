const { pool } = require('../config/database');

// ─── DASHBOARD ───────────────────────────────────────────────────────────────
const getDashboard = async (req, res) => {
  try {
    const role = req.user.role;

    if (role === 'admin') {
      const [[totals]] = await pool.execute(`
        SELECT
          (SELECT COUNT(*) FROM students WHERE status='active') as total_students,
          (SELECT COUNT(*) FROM teachers) as total_teachers,
          (SELECT COUNT(*) FROM sections) as total_sections,
          (SELECT COUNT(*) FROM schedules WHERE status='approved') as total_classes,
          (SELECT COUNT(*) FROM schedules WHERE status='pending') as pending_schedules
      `);
      const [recentLogs] = await pool.execute(
        `SELECT l.*, u.first_name, u.last_name FROM audit_logs l JOIN users u ON u.id=l.user_id ORDER BY l.timestamp DESC LIMIT 8`
      );
      const [attendanceToday] = await pool.execute(
        `SELECT COUNT(*) as count, status FROM attendance a
         JOIN classes c ON c.id=a.class_id
         WHERE DATE(c.class_date)=CURDATE() GROUP BY a.status`
      );
      return res.json({ success:true, data:{ totals, recentLogs, attendanceToday } });
    }

    if (role === 'teacher') {
      const [tRows] = await pool.execute(`SELECT id FROM teachers WHERE user_id=?`, [req.user.id]);
      if (!tRows.length) return res.status(404).json({ success:false, message:'Teacher not found.' });
      const teacherId = tRows[0].id;

      const [myClasses] = await pool.execute(
        `SELECT s.id, sub.name as subject, sec.section_name, sec.grade_level, s.day_of_week, s.start_time, s.end_time, s.room, s.status
         FROM schedules s JOIN subjects sub ON sub.id=s.subject_id JOIN sections sec ON sec.id=s.section_id
         WHERE s.teacher_id=? AND s.status='approved'
         ORDER BY FIELD(s.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday'), s.start_time`,
        [teacherId]
      );
      const [[attStats]] = await pool.execute(
        `SELECT COUNT(*) as total,
           SUM(a.status='present') as present,
           SUM(a.status='late') as late,
           SUM(a.status='absent') as absent
         FROM attendance a
         JOIN classes c ON c.id=a.class_id
         JOIN schedules s ON s.id=c.schedule_id
         WHERE s.teacher_id=? AND DATE(c.class_date)=CURDATE()`,
        [teacherId]
      );
      const [pendingGrades] = await pool.execute(
        `SELECT COUNT(*) as count FROM submissions sub2
         JOIN assignments a ON a.id=sub2.assignment_id
         JOIN schedules s ON s.id=a.schedule_id
         WHERE s.teacher_id=? AND sub2.status='submitted'`,
        [teacherId]
      );
      return res.json({ success:true, data:{ myClasses, attStats, pendingGradesCount: pendingGrades[0].count } });
    }

    if (role === 'student') {
      const [sRows] = await pool.execute(
        `SELECT s.id, s.section_id, s.grade_level FROM students s WHERE s.user_id=?`, [req.user.id]
      );
      if (!sRows.length) return res.status(404).json({ success:false, message:'Student not found.' });
      const student = sRows[0];

      const [schedule] = await pool.execute(
        `SELECT s.id, sub.name as subject, u.first_name, u.last_name, s.day_of_week, s.start_time, s.end_time, s.room
         FROM schedules s JOIN subjects sub ON sub.id=s.subject_id
         JOIN teachers t ON t.id=s.teacher_id JOIN users u ON u.id=t.user_id
         WHERE s.section_id=? AND s.status='approved'
         ORDER BY FIELD(s.day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday'), s.start_time`,
        [student.section_id]
      );
      const [pendingAssignments] = await pool.execute(
        `SELECT a.id, a.title, a.due_date, sub.name as subject FROM assignments a
         JOIN schedules s ON s.id=a.schedule_id JOIN subjects sub ON sub.id=s.subject_id
         WHERE s.section_id=? AND a.due_date >= NOW()
           AND a.id NOT IN (SELECT assignment_id FROM submissions WHERE student_id=?)
         ORDER BY a.due_date LIMIT 5`,
        [student.section_id, student.id]
      );
      const [[attSummary]] = await pool.execute(
        `SELECT COUNT(*) as total,
           SUM(status='present') as present, SUM(status='late') as late, SUM(status='absent') as absent
         FROM attendance WHERE student_id=?`,
        [student.id]
      );
      return res.json({ success:true, data:{ schedule, pendingAssignments, attSummary } });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success:false, message:'Server error.' });
  }
};

// ─── SECTIONS ────────────────────────────────────────────────────────────────
const getSections = async (req, res) => {
  const { gradeLevel } = req.query;
  const [rows] = await pool.execute(
    `SELECT s.*, u.first_name, u.last_name,
       (SELECT COUNT(*) FROM students WHERE section_id=s.id AND status='active') as student_count
     FROM sections s LEFT JOIN users u ON u.id=s.adviser_id
     ${gradeLevel ? 'WHERE s.grade_level=?' : ''}
     ORDER BY s.grade_level, s.section_name`,
    gradeLevel ? [gradeLevel] : []
  );
  res.json({ success:true, data:rows });
};

const createSection = async (req, res) => {
  const { sectionName, gradeLevel, strand, adviserId } = req.body;
  await pool.execute(
    `INSERT INTO sections (section_name, grade_level, strand, adviser_id) VALUES (?,?,?,?)`,
    [sectionName, gradeLevel, strand, adviserId||null]
  );
  res.status(201).json({ success:true, message:'Section created.' });
};

// ─── ANNOUNCEMENTS ───────────────────────────────────────────────────────────
const getAnnouncements = async (req, res) => {
  const role = req.user.role;
  const [rows] = await pool.execute(
    `SELECT a.*, u.first_name, u.last_name
     FROM announcements a JOIN users u ON u.id=a.created_by
     WHERE a.target_role='all' OR a.target_role=?
     ORDER BY a.created_at DESC LIMIT 20`,
    [role]
  );
  res.json({ success:true, data:rows });
};

const createAnnouncement = async (req, res) => {
  const { title, content, targetRole, sectionId } = req.body;
  await pool.execute(
    `INSERT INTO announcements (title, content, target_role, section_id, created_by) VALUES (?,?,?,?,?)`,
    [title, content, targetRole||'all', sectionId||null, req.user.id]
  );
  res.status(201).json({ success:true, message:'Announcement created.' });
};

// ─── ASSIGNMENTS ─────────────────────────────────────────────────────────────
const getAssignments = async (req, res) => {
  const { scheduleId, sectionId } = req.query;
  let q = `SELECT a.*, sub.name as subject_name, u.first_name, u.last_name
           FROM assignments a JOIN schedules s ON s.id=a.schedule_id
           JOIN subjects sub ON sub.id=s.subject_id
           JOIN users u ON u.id=a.created_by WHERE 1=1`;
  const p = [];
  if (scheduleId) { q+=' AND a.schedule_id=?'; p.push(scheduleId); }
  if (sectionId)  { q+=' AND s.section_id=?';  p.push(sectionId); }
  q += ' ORDER BY a.due_date ASC';
  const [rows] = await pool.execute(q, p);
  res.json({ success:true, data:rows });
};

const createAssignment = async (req, res) => {
  const { scheduleId, title, description, dueDate, maxScore, type } = req.body;
  const [r] = await pool.execute(
    `INSERT INTO assignments (schedule_id, title, description, due_date, max_score, type, created_by)
     VALUES (?,?,?,?,?,?,?)`,
    [scheduleId, title, description||null, dueDate, maxScore||100, type||'homework', req.user.id]
  );
  res.status(201).json({ success:true, message:'Assignment created.', data:{ id: r.insertId } });
};

const submitAssignment = async (req, res) => {
  const { assignmentId, textAnswer } = req.body;
  const [sRows] = await pool.execute(`SELECT id FROM students WHERE user_id=?`, [req.user.id]);
  if (!sRows.length) return res.status(403).json({ success:false, message:'Student not found.' });
  await pool.execute(
    `INSERT INTO submissions (assignment_id, student_id, text_answer, status)
     VALUES (?,?,?,'submitted')
     ON DUPLICATE KEY UPDATE text_answer=?, submitted_at=NOW(), status='submitted'`,
    [assignmentId, sRows[0].id, textAnswer||null, textAnswer||null]
  );
  res.json({ success:true, message:'Assignment submitted.' });
};

const gradeSubmission = async (req, res) => {
  const { score, feedback } = req.body;
  await pool.execute(
    `UPDATE submissions SET score=?, feedback=?, status='graded', graded_at=NOW(), graded_by=? WHERE id=?`,
    [score, feedback||null, req.user.id, req.params.id]
  );
  res.json({ success:true, message:'Submission graded.' });
};

// ─── GRADES ──────────────────────────────────────────────────────────────────
const getGrades = async (req, res) => {
  const { studentId, scheduleId } = req.query;
  const [rows] = await pool.execute(
    `SELECT g.*, sub.name as subject_name, sec.section_name
     FROM grades g JOIN schedules s ON s.id=g.schedule_id
     JOIN subjects sub ON sub.id=s.subject_id JOIN sections sec ON sec.id=s.section_id
     WHERE g.student_id=? ${scheduleId ? 'AND g.schedule_id=?' : ''}
     ORDER BY sub.name, g.quarter`,
    scheduleId ? [studentId, scheduleId] : [studentId]
  );
  res.json({ success:true, data:rows });
};

const upsertGrade = async (req, res) => {
  const { studentId, scheduleId, quarter, writtenWorks, performanceTasks, quarterlyAssessment } = req.body;
  const final = ((writtenWorks||0)*.25 + (performanceTasks||0)*.50 + (quarterlyAssessment||0)*.25).toFixed(2);
  const remarks = parseFloat(final) >= 75 ? 'Passed' : 'Failed';
  await pool.execute(
    `INSERT INTO grades (student_id, schedule_id, quarter, written_works, performance_tasks, quarterly_assessment, final_grade, remarks)
     VALUES (?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE written_works=?, performance_tasks=?, quarterly_assessment=?, final_grade=?, remarks=?`,
    [studentId, scheduleId, quarter, writtenWorks, performanceTasks, quarterlyAssessment, final, remarks,
     writtenWorks, performanceTasks, quarterlyAssessment, final, remarks]
  );
  res.json({ success:true, message:'Grade saved.', data:{ finalGrade:final, remarks } });
};

// ─── MATERIALS ───────────────────────────────────────────────────────────────
const getMaterials = async (req, res) => {
  const { scheduleId } = req.query;
  const [rows] = await pool.execute(
    `SELECT m.*, u.first_name, u.last_name, sub.name as subject_name
     FROM learning_materials m JOIN users u ON u.id=m.uploaded_by
     JOIN schedules s ON s.id=m.schedule_id JOIN subjects sub ON sub.id=s.subject_id
     ${scheduleId ? 'WHERE m.schedule_id=?' : ''}
     ORDER BY m.created_at DESC`,
    scheduleId ? [scheduleId] : []
  );
  res.json({ success:true, data:rows });
};

const createMaterial = async (req, res) => {
  const { scheduleId, title, description, fileUrl, fileType } = req.body;
  await pool.execute(
    `INSERT INTO learning_materials (schedule_id, title, description, file_url, file_type, uploaded_by) VALUES (?,?,?,?,?,?)`,
    [scheduleId, title, description||null, fileUrl||null, fileType||null, req.user.id]
  );
  res.status(201).json({ success:true, message:'Material uploaded.' });
};

module.exports = {
  getDashboard, getSections, createSection,
  getAnnouncements, createAnnouncement,
  getAssignments, createAssignment, submitAssignment, gradeSubmission,
  getGrades, upsertGrade, getMaterials, createMaterial
};
