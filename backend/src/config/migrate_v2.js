// @v2-fixed-imports
// Migration V2 — new feature tables (PostgreSQL version)

const NEW_TABLES = [

  // Notifications
  `CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL DEFAULT 'announcement' CHECK (type IN ('grade','attendance','assignment','announcement','alert','message')),
    title VARCHAR(120) NOT NULL,
    body TEXT,
    link VARCHAR(200),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at)`,

  // Messages (direct messaging)
  `CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject VARCHAR(150),
    body TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    parent_id INT NULL REFERENCES messages(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id, is_read)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)`,

  // School calendar events
  `CREATE TABLE IF NOT EXISTS calendar_events (
    id SERIAL PRIMARY KEY,
    title VARCHAR(120) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    end_date DATE NULL,
    type VARCHAR(15) NOT NULL DEFAULT 'other' CHECK (type IN ('exam','holiday','activity','deadline','other')),
    target_role VARCHAR(15) NOT NULL DEFAULT 'all' CHECK (target_role IN ('all','admin','teacher','student')),
    created_by INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_events(event_date)`,

  // Grade appeals
  `CREATE TABLE IF NOT EXISTS grade_appeals (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    grade_id INT NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status VARCHAR(15) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','resolved','rejected')),
    teacher_response TEXT,
    reviewed_by INT NULL REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE INDEX IF NOT EXISTS idx_appeals_student ON grade_appeals(student_id)`,
  `CREATE INDEX IF NOT EXISTS idx_appeals_status ON grade_appeals(status)`,

  // School year config
  `CREATE TABLE IF NOT EXISTS school_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(60) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    updated_by INT NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

];

const { pool } = require('./database');

async function runMigrationsV2() {
  const client = await pool.connect();
  try {
    for (const sql of NEW_TABLES) {
      await client.query(sql);
    }
    console.log('✅ V2 migrations ready');
  } catch (err) {
    console.error('❌ V2 migration error:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrationsV2().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { NEW_TABLES, runMigrationsV2 };
