// Exam tables. Runs automatically at server start-up (see server.js);
// it can also be run alone:  node src/config/migrate_exams.js
const { pool } = require('./database');

const SQL = `
CREATE TABLE IF NOT EXISTS exams (
  id              SERIAL PRIMARY KEY,
  title           VARCHAR(200) NOT NULL,
  subject_label   VARCHAR(120) DEFAULT '',
  section_label   VARCHAR(120) DEFAULT '',
  instructions    TEXT DEFAULT '',
  teacher_user_id INTEGER NOT NULL,
  total_points    NUMERIC(8,2) DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exam_questions (
  id          SERIAL PRIMARY KEY,
  exam_id     INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  type        VARCHAR(10) NOT NULL,
  prompt      TEXT NOT NULL,
  choices     JSONB,
  answer      JSONB NOT NULL,
  points      NUMERIC(6,2) NOT NULL DEFAULT 1,
  explanation TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON exam_questions(exam_id, position);

CREATE TABLE IF NOT EXISTS exam_results (
  id            SERIAL PRIMARY KEY,
  exam_id       INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_key   VARCHAR(160) NOT NULL,
  student_id    INTEGER,
  student_label VARCHAR(120) NOT NULL DEFAULT '',
  answers       JSONB,
  item_scores   JSONB,
  score         NUMERIC(8,2) NOT NULL DEFAULT 0,
  total         NUMERIC(8,2) NOT NULL DEFAULT 0,
  needs_review  BOOLEAN DEFAULT FALSE,
  graded_by     INTEGER,
  created_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE (exam_id, student_key)
);
`;

async function runMigrationsExams() {
  const client = await pool.connect();
  try {
    await client.query(SQL);
    console.log('✅ Exam migrations ready');
  } catch (err) {
    console.error('❌ Exam migration error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrationsExams().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { SQL, runMigrationsExams };
