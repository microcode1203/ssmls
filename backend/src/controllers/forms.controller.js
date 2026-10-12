// Forms Library — blank form templates (DepEd School Forms, request forms,
// health forms, enrollment forms, etc.) uploaded once by an admin. Templates
// can contain {{placeholder}} tags that get auto-filled per student from
// their registration record, attendance, and grades — a teacher just picks
// a student (and optionally a subject/quarter) and downloads the filled copy.
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { pool } = require('../config/database');
const { logAction } = require('../utils/audit');

const MAX_FILE_CHARS = 8000000; // ~6MB raw file, base64-encoded
const VALID_CATEGORIES = ['deped_form', 'request_form', 'health_form', 'enrollment', 'other'];

const isDocx = (form) =>
  (form.file_type || '').includes('wordprocessingml') || /\.docx$/i.test(form.file_name || '');

// The placeholder tags a template designer (admin) can use inside a .docx
// file. Loop fields (grades) use docxtemplater's {#grades}...{/grades} syntax.
const FIELD_REFERENCE = {
  student: ['student_name', 'student_first_name', 'student_middle_name', 'student_last_name',
    'lrn', 'grade_level', 'section', 'strand', 'birthday', 'birthplace',
    'guardian_name', 'guardian_phone', 'student_phone', 'email'],
  meta: ['school_year', 'date_generated'],
  attendance: ['days_present', 'days_absent', 'days_late', 'days_total', 'attendance_rate'],
  grade_context: ['subject_name', 'quarter', 'written_works', 'performance_tasks', 'quarterly_assessment', 'final_grade', 'remarks'],
  grade_loop: ['grades (loop: {#grades}{subject_name} {quarter} {final_grade}{/grades})'],
};

const schoolYear = () => {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() + 1 >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
};

// Gathers everything a template could ask for, for one student.
const buildTemplateData = async (studentId, { scheduleId, quarter } = {}) => {
  const { rows: sRows } = await pool.query(
    `SELECT s.id, s.lrn, s.grade_level, s.strand, s.birthday, s.birthplace,
            s.guardian_name, s.guardian_phone, s.phone,
            u.first_name, u.middle_name, u.last_name, u.email,
            sec.section_name
     FROM students s JOIN users u ON u.id = s.user_id
     LEFT JOIN sections sec ON sec.id = s.section_id
     WHERE s.id = $1`,
    [studentId]
  );
  if (!sRows.length) return null;
  const s = sRows[0];

  const attParams = [studentId];
  let attJoin = '';
  if (scheduleId) { attParams.push(scheduleId); attJoin = ` AND c.schedule_id = $2`; }
  const { rows: attRows } = await pool.query(
    `SELECT a.status, COUNT(*)::int as count
     FROM attendance a JOIN classes c ON c.id = a.class_id
     WHERE a.student_id = $1 ${attJoin} GROUP BY a.status`,
    attParams
  );
  const attByStatus = Object.fromEntries(attRows.map(r => [r.status, r.count]));
  const present = attByStatus.present || 0, absent = attByStatus.absent || 0, late = attByStatus.late || 0;
  const total = present + absent + late;
  const attendanceRate = total > 0 ? (((present + late) / total) * 100).toFixed(1) : null;

  const gradeParams = [studentId];
  let gradeWhere = '';
  if (scheduleId) { gradeParams.push(scheduleId); gradeWhere += ` AND g.schedule_id = $${gradeParams.length}`; }
  if (quarter) { gradeParams.push(quarter); gradeWhere += ` AND g.quarter = $${gradeParams.length}`; }
  const { rows: gradeRows } = await pool.query(
    `SELECT g.quarter, g.written_works, g.performance_tasks, g.quarterly_assessment, g.final_grade, g.remarks, sub.name as subject_name
     FROM grades g JOIN schedules sch ON sch.id = g.schedule_id JOIN subjects sub ON sub.id = sch.subject_id
     WHERE g.student_id = $1 ${gradeWhere} ORDER BY sub.name ASC, g.quarter ASC`,
    gradeParams
  );
  const primaryGrade = gradeRows[0] || {};

  return {
    student_name: [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(' '),
    student_first_name: s.first_name, student_middle_name: s.middle_name || '', student_last_name: s.last_name,
    lrn: s.lrn, grade_level: s.grade_level, section: s.section_name || '', strand: s.strand || '',
    birthday: s.birthday ? new Date(s.birthday).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '',
    birthplace: s.birthplace || '', guardian_name: s.guardian_name || '', guardian_phone: s.guardian_phone || '',
    student_phone: s.phone || '', email: s.email || '',
    school_year: schoolYear(),
    date_generated: new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
    days_present: present, days_absent: absent, days_late: late, days_total: total,
    attendance_rate: attendanceRate ?? '',
    subject_name: primaryGrade.subject_name || '', quarter: primaryGrade.quarter || quarter || '',
    written_works: primaryGrade.written_works ?? '', performance_tasks: primaryGrade.performance_tasks ?? '',
    quarterly_assessment: primaryGrade.quarterly_assessment ?? '', final_grade: primaryGrade.final_grade ?? '',
    remarks: primaryGrade.remarks || '',
    grades: gradeRows.map(g => ({
      subject_name: g.subject_name, quarter: g.quarter,
      written_works: g.written_works ?? '', performance_tasks: g.performance_tasks ?? '',
      quarterly_assessment: g.quarterly_assessment ?? '', final_grade: g.final_grade ?? '', remarks: g.remarks || '',
    })),
  };
};

// GET /api/forms?category=&search=
const getForms = async (req, res) => {
  try {
    const { category, search } = req.query;
    const params = [];
    let where = 'WHERE 1=1';
    if (category) { params.push(category); where += ` AND category = $${params.length}`; }
    if (search) { params.push(`%${search}%`); where += ` AND (title ILIKE $${params.length} OR description ILIKE $${params.length})`; }

    const { rows } = await pool.query(
      `SELECT f.id, f.title, f.category, f.description, f.file_name, f.file_type, f.file_size, f.created_at,
              u.first_name as uploader_first_name, u.last_name as uploader_last_name, f.uploaded_by
       FROM school_forms f JOIN users u ON u.id = f.uploaded_by
       ${where} ORDER BY f.category ASC, f.title ASC`,
      params
    );
    res.json({ success: true, data: rows.map(r => ({ ...r, is_fillable: isDocx(r) })) });
  } catch (err) {
    console.error('getForms error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to load forms.' });
  }
};

// GET /api/forms/fields  (reference list for admins designing a template)
const getFieldReference = async (req, res) => {
  res.json({ success: true, data: FIELD_REFERENCE });
};

// GET /api/forms/:id  (returns the blank file itself for download)
const downloadForm = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT file_data, file_name, file_type FROM school_forms WHERE id = $1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Form not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('downloadForm error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to download form.' });
  }
};

// POST /api/forms/:id/generate  (teacher/admin — fill a template for one student)
const generateForm = async (req, res) => {
  try {
    const { studentId, scheduleId, quarter } = req.body;
    if (!studentId) return res.status(400).json({ success: false, message: 'studentId is required.' });

    const { rows: formRows } = await pool.query(`SELECT * FROM school_forms WHERE id = $1`, [req.params.id]);
    if (!formRows.length) return res.status(404).json({ success: false, message: 'Form not found.' });
    const form = formRows[0];
    if (!isDocx(form))
      return res.status(400).json({ success: false, message: 'Only .docx templates support auto-fill. PDF/other files can only be downloaded blank.' });

    // Teachers may only generate forms for students in one of their own class sections
    if (req.user.role === 'teacher') {
      const { rows: ownRows } = await pool.query(
        `SELECT 1 FROM students st JOIN schedules sch ON sch.section_id = st.section_id
         JOIN teachers t ON t.id = sch.teacher_id
         WHERE st.id = $1 AND t.user_id = $2 LIMIT 1`,
        [studentId, req.user.id]
      );
      if (!ownRows.length) return res.status(403).json({ success: false, message: 'You can only generate forms for your own students.' });
    }

    const data = await buildTemplateData(studentId, { scheduleId, quarter });
    if (!data) return res.status(404).json({ success: false, message: 'Student not found.' });

    const zip = new PizZip(Buffer.from(form.file_data, 'base64'));
    const docTemplate = new Docxtemplater(zip, {
      paragraphLoop: true, linebreaks: true,
      delimiters: { start: '{{', end: '}}' },
      nullGetter: () => '________',
    });

    try {
      docTemplate.render(data);
    } catch (renderErr) {
      console.error('Template render error:', renderErr);
      return res.status(400).json({ success: false, message: 'This template has a formatting error and could not be filled. Please check the placeholder tags.' });
    }

    const outBuffer = docTemplate.getZip().generate({ type: 'nodebuffer' });
    await logAction(req.user.id, 'GENERATE_FORM', 'school_forms', form.id, { studentId, scheduleId, quarter }, req.ip);

    res.json({
      success: true,
      data: {
        fileData: outBuffer.toString('base64'),
        fileName: `${form.title.replace(/[^\w\-]+/g, '_')}_${data.lrn || studentId}.docx`,
        fileType: form.file_type,
        student: { name: data.student_name, lrn: data.lrn },
      }
    });
  } catch (err) {
    console.error('generateForm error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to generate filled form.' });
  }
};

// POST /api/forms  (admin only — uploads the blank/placeholder template)
const uploadForm = async (req, res) => {
  try {
    const { title, category, description, fileData, fileName, fileType, fileSize } = req.body;
    if (!title || !fileData || !fileName)
      return res.status(400).json({ success: false, message: 'Title and file are required.' });
    if (fileData.length > MAX_FILE_CHARS)
      return res.status(400).json({ success: false, message: 'File too large. Maximum size is ~6MB.' });

    const cat = VALID_CATEGORIES.includes(category) ? category : 'other';

    const { rows } = await pool.query(
      `INSERT INTO school_forms (title, category, description, file_data, file_name, file_type, file_size, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [title, cat, description || null, fileData, fileName, fileType || null, fileSize || null, req.user.id]
    );

    await logAction(req.user.id, 'UPLOAD_FORM', 'school_forms', rows[0].id, { title }, req.ip);
    res.status(201).json({ success: true, message: 'Form uploaded.', data: { id: rows[0].id } });
  } catch (err) {
    console.error('uploadForm error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to upload form.' });
  }
};

// DELETE /api/forms/:id  (admin only)
const deleteForm = async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id FROM school_forms WHERE id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Form not found.' });

    await pool.query(`DELETE FROM school_forms WHERE id = $1`, [req.params.id]);
    await logAction(req.user.id, 'DELETE_FORM', 'school_forms', req.params.id, {}, req.ip);
    res.json({ success: true, message: 'Form removed.' });
  } catch (err) {
    console.error('deleteForm error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to delete form.' });
  }
};

module.exports = { getForms, getFieldReference, downloadForm, generateForm, uploadForm, deleteForm };
