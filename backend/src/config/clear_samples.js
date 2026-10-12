// Removes the old sample teachers, students, subjects and sections that earlier
// versions of seed.js created. Subjects/sections that are already in use are kept.
// Usage: npm run clear-samples
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { pool } = require('./database');

const SAMPLE_EMAILS = [
  'joana@ssmls.edu.ph', 'jdelavega@ssmls.edu.ph', 'areyes@ssmls.edu.ph',
  'juan.dela@student.ssmls.edu.ph', 'maria.santos@student.ssmls.edu.ph',
  'ana.reyes@student.ssmls.edu.ph', 'carlo.mendoza@student.ssmls.edu.ph',
  'sofia.garcia@student.ssmls.edu.ph', 'miguel.torres@student.ssmls.edu.ph',
  'isabella.ramos@student.ssmls.edu.ph',
];

const SAMPLE_SUBJECT_CODES = ['MATH11', 'SCI11', 'ENG11', 'STAT12', 'PHILO12', 'STEM11'];
const SAMPLE_SECTIONS = [
  ['STEM-A', 'Grade 11'], ['STEM-B', 'Grade 11'], ['HUMSS-A', 'Grade 11'],
  ['ABM-A', 'Grade 11'], ['STEM-A', 'Grade 12'], ['HUMSS-A', 'Grade 12'],
];

(async () => {
  try {
    // teachers/students rows are removed automatically (ON DELETE CASCADE)
    const r = await pool.query(`DELETE FROM users WHERE email = ANY($1::text[]) AND role <> 'admin'`, [SAMPLE_EMAILS]);
    console.log(`✅ Removed ${r.rowCount} sample account(s).`);

    let subjects = 0, keptSubjects = 0;
    for (const code of SAMPLE_SUBJECT_CODES) {
      try {
        const d = await pool.query(`DELETE FROM subjects WHERE code = $1`, [code]);
        subjects += d.rowCount;
      } catch (e) { keptSubjects++; } // still referenced by a schedule/grade
    }
    console.log(`✅ Removed ${subjects} default subject(s)` + (keptSubjects ? ` (${keptSubjects} kept — in use).` : '.'));

    let sections = 0;
    for (const [name, grade] of SAMPLE_SECTIONS) {
      try {
        const d = await pool.query(
          `DELETE FROM sections WHERE section_name = $1 AND grade_level = $2
             AND NOT EXISTS (SELECT 1 FROM students st WHERE st.section_id = sections.id)`,
          [name, grade]);
        sections += d.rowCount;
      } catch (e) { /* in use — keep */ }
    }
    console.log(`✅ Removed ${sections} default section(s) that had no students.`);
  } catch (err) {
    console.error('❌ Failed:', err.message);
    process.exitCode = 1;
  } finally { await pool.end(); }
})();
