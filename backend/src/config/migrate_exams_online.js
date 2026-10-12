// Online exam tables. Runs automatically at server start-up (see server.js);
// it can also be run alone:  node src/config/migrate_exams_online.js
const { pool } = require('./database');

const SQL = `
ALTER TABLE exams ADD COLUMN IF NOT EXISTS access_code        VARCHAR(12);
ALTER TABLE exams ADD COLUMN IF NOT EXISTS published          BOOLEAN DEFAULT FALSE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS duration_minutes   INTEGER;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS opens_at           TIMESTAMPTZ;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS closes_at          TIMESTAMPTZ;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS max_violations     INTEGER DEFAULT 3;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS shuffle_questions  BOOLEAN DEFAULT FALSE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS show_result        BOOLEAN DEFAULT FALSE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS enforce_fullscreen BOOLEAN DEFAULT TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_exams_access_code ON exams(access_code);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id              SERIAL PRIMARY KEY,
  exam_id         INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  user_id         INTEGER NOT NULL,
  student_label   VARCHAR(120) NOT NULL DEFAULT '',
  status          VARCHAR(16) NOT NULL DEFAULT 'in_progress',
  submit_reason   VARCHAR(20),
  question_order  JSONB,
  answers         JSONB DEFAULT '{}'::jsonb,
  essay_scores    JSONB DEFAULT '{}'::jsonb,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  deadline_at     TIMESTAMPTZ,
  submitted_at    TIMESTAMPTZ,
  last_seen_at    TIMESTAMPTZ DEFAULT NOW(),
  violation_count INTEGER NOT NULL DEFAULT 0,
  score           NUMERIC(8,2),
  total           NUMERIC(8,2),
  needs_review    BOOLEAN DEFAULT FALSE,
  UNIQUE (exam_id, user_id)
);

CREATE TABLE IF NOT EXISTS exam_events (
  id         SERIAL PRIMARY KEY,
  attempt_id INTEGER NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  type       VARCHAR(30) NOT NULL,
  detail     VARCHAR(200) DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_exam_events_attempt ON exam_events(attempt_id, created_at);
`;

async function runMigrationsExamsOnline() {
  const client = await pool.connect();
  try {
    await client.query(SQL);
    console.log('✅ Online exam migrations ready');
  } catch (err) {
    console.error('❌ Online exam migration error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrationsExamsOnline().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { SQL, runMigrationsExamsOnline };
