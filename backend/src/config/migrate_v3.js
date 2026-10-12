// Migration V3 — exam anti-cheat locking + personal student QR attendance
const { pool } = require('./database');

const STATEMENTS = [
  // Lets a submission be permanently locked once an exam is finished
  // (student manually submits, or the anti-cheat system auto-submits).
  `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE`,
  `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS lock_reason VARCHAR(200)`,

  // NOTE: fixes a pre-existing bug — submitAssignment() already read/wrote
  // file_data/file_name/file_type/file_size, but no migration ever created
  // these columns, so every file-attached submission (including exams)
  // would fail with "column does not exist".
  `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS file_data TEXT`,
  `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)`,
  `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS file_type VARCHAR(100)`,
  `ALTER TABLE submissions ADD COLUMN IF NOT EXISTS file_size INT`,

  // Personal QR attendance: each student is scanned by the teacher, so we
  // record which mode was used to produce the "present" entry.
  `ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_scanned_via_check`,
  `ALTER TABLE attendance ADD CONSTRAINT attendance_scanned_via_check
     CHECK (scanned_via IN ('qr','manual','auto'))`,

  // Forms Library — blank official/administrative form templates
  // (DepEd School Forms, request forms, waivers, etc.) that any teacher
  // can upload once and everyone can browse and download.
  `CREATE TABLE IF NOT EXISTS school_forms (
     id SERIAL PRIMARY KEY,
     title VARCHAR(200) NOT NULL,
     category VARCHAR(50) NOT NULL DEFAULT 'other'
       CHECK (category IN ('deped_form','request_form','health_form','enrollment','other')),
     description TEXT,
     file_data TEXT NOT NULL,
     file_name VARCHAR(255) NOT NULL,
     file_type VARCHAR(100),
     file_size INT,
     uploaded_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE INDEX IF NOT EXISTS idx_school_forms_category ON school_forms(category)`,

  // Settings page reads/writes these, but no earlier migration created them,
  // so GET /api/settings/profile failed for every user.
  `ALTER TABLE users    ADD COLUMN IF NOT EXISTS avatar_url TEXT`,
  `ALTER TABLE teachers ADD COLUMN IF NOT EXISTS bio TEXT`,

  // Learn (quizzes / videos / lessons). Created here — after the schedules table
  // exists — instead of when the controller loads, which failed on a fresh database.
  `CREATE TABLE IF NOT EXISTS learn_content (
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
   )`,
];

async function runMigrationsV3() {
  const client = await pool.connect();
  try {
    for (const sql of STATEMENTS) {
      await client.query(sql);
    }
    console.log('✅ V3 migrations ready');
  } catch (err) {
    console.error('❌ V3 migration error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrationsV3().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { STATEMENTS, runMigrationsV3 };
